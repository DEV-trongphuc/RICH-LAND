<?php
// cron_sync.php
// Script to pull data from Google Sheets based on active connections

require_once __DIR__ . '/db_connect.php';

// Đặt thời gian thực thi không giới hạn để tránh timeout khi xử lý file lớn hoặc gửi nhiều Email/Zalo
set_time_limit(0);

// --- PREVENT CONCURRENT EXECUTION (CHỐNG XUNG ĐỘT) ---
if (!defined('BYPASS_CRON_LOCK')) {
    $lockFile = sys_get_temp_dir() . '/cron_sync_' . md5(__DIR__) . '.lock';
    $lockFp = @fopen($lockFile, 'w');
    if (!$lockFp) {
        $lockMsg = "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Please check folder permissions. Exiting.\n";
        if (php_sapi_name() === 'cli') {
            echo $lockMsg;
            exit(1);
        } else {
            throw new Exception("Lỗi hệ thống: Không thể ghi file khóa tại $lockFile. Vui lòng kiểm tra quyền thư mục tạm.");
        }
    }
    if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
        $lockMsg = "[" . date('Y-m-d H:i:s') . "] Another instance of cron_sync.php is already running. Exiting.\n";
        fclose($lockFp);
        if (php_sapi_name() === 'cli') {
            echo $lockMsg;
            exit(0);
        } else {
            throw new Exception("Hệ thống đồng bộ đang bận (hoặc đang chạy ngầm). Vui lòng thử lại sau.");
        }
    }
}
// --- END PREVENT CONCURRENT EXECUTION ---

if (!defined('DIAG_TOKEN')) {
    // Auto-recover any sheet connections stuck in 'syncing' status from a previous crashed run (older than 10 minutes)
    $conn->query("UPDATE sheet_connections SET sync_status = 'idle' WHERE sync_status = 'syncing' AND (last_sync_at IS NULL OR last_sync_at <= DATE_SUB(NOW(), INTERVAL 10 MINUTE))");

    // Ensure sheet_sync_records table exists
    $conn->query("CREATE TABLE IF NOT EXISTS sheet_sync_records (
        connection_id INT,
        row_hash VARCHAR(64),
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (connection_id, row_hash),
        FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE
    )");
}

// Helper for routing
require_once __DIR__ . '/webhook_logic.php'; // We will extract routing logic into a separate file or just redefine them if not too complex. But better to extract.
// BUG-03 fix: require_once mailer NGOÀI vòng lặp, tránh kiểm tra filesystem mỗi iteration
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/zalo_bot.php';

if (!function_exists('logSync')) {
    function logSync($msg) {
        echo "[" . date('Y-m-d H:i:s') . "] " . $msg . "\n";
    }
}

if (!function_exists('syncInventoryConnection')) {
    function syncInventoryConnection($conn, $connItem) {
        logSync("Running syncInventoryConnection for ID {$connItem['id']} - {$connItem['sheet_name']}...");
        
        // Fetch field mappings
        $mapStmt = $conn->prepare("SELECT sheet_column, system_field, custom_label FROM field_mappings WHERE connection_id = ?");
        $mapStmt->bind_param("i", $connItem['id']);
        $mapStmt->execute();
        $mappingsResult = $mapStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $mapStmt->close();
        
        $mappings = [];
        foreach ($mappingsResult as $row) {
            $sysField = $row['system_field'];
            if (!isset($mappings[$sysField])) {
                $mappings[$sysField] = [];
            }
            $mappings[$sysField][] = $row['sheet_column'];
        }
        
        if (empty($mappings['sku'])) {
            throw new Exception("Bản đồ trường bị thiếu trường khóa 'sku' (Mã căn) để so khớp.");
        }
        
        $csvUrl = "https://docs.google.com/spreadsheets/d/" . trim($connItem['spreadsheet_id']) . "/gviz/tq?tqx=out:csv";
        if (!empty($connItem['sheet_name'])) {
            $csvUrl .= "&sheet=" . urlencode($connItem['sheet_name']);
        }
        
        $ch = curl_init($csvUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows); CRM Inventory Agent");
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($httpCode !== 200 || empty($csvData) || stripos($csvData, '<html') !== false || stripos($csvData, '<!DOCTYPE') !== false) {
            $errDetail = $curlError ? " (cURL Error: $curlError)" : "";
            throw new Exception("Không thể lấy dữ liệu CSV từ Google Sheets. HTTP Code: $httpCode$errDetail.");
        }
        
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $csvData);
        rewind($stream);
        
        $headers = [];
        $rowCount = 0;
        $updatedCount = 0;
        $insertedCount = 0;
        
        while (($row = fgetcsv($stream)) !== FALSE) {
            $row = array_map(function($val) { return trim($val ?? '', "\" "); }, $row);
            if ($rowCount === 0) {
                $headers = $row;
                $rowCount++;
                continue;
            }
            $rowCount++;
            
            if (empty(array_filter($row))) continue;
            
            $rowData = [];
            foreach ($headers as $colIdx => $colName) {
                $rowData[$colName] = $row[$colIdx] ?? '';
            }
            
            $valExtractor = function($sysField) use ($mappings, $rowData) {
                if (empty($mappings[$sysField])) return '';
                foreach ($mappings[$sysField] as $colName) {
                    if (isset($rowData[$colName]) && $rowData[$colName] !== '') {
                        return $rowData[$colName];
                    }
                }
                return '';
            };
            
            $sku = trim($valExtractor('sku'));
            if (empty($sku)) {
                continue;
            }
            
            $productName = trim($valExtractor('product_name'));
            if (empty($productName)) {
                $productName = 'Sản phẩm mới ' . $sku;
            }
            
            $priceStr = $valExtractor('price');
            $price = (float)str_replace([',', ' '], '', $priceStr);
            
            $importPriceStr = $valExtractor('import_price');
            $importPrice = (float)str_replace([',', ' '], '', $importPriceStr);
            if ($importPrice <= 0) $importPrice = $price;
            
            $qtyText = $valExtractor('qty');
            $qty = 1;
            if ($qtyText !== '') {
                $normalizedQty = mb_strtolower(trim($qtyText));
                if (in_array($normalizedQty, ['0', 'đã bán', 'sold', 'đã cọc', 'deposit', 'đã bán/đã cọc', 'đã khóa', 'đã đặt cọc'])) {
                    $qty = 0;
                } elseif (is_numeric($qtyText)) {
                    $qty = (int)$qtyText;
                }
            }
            
            $statusText = mb_strtolower(trim($valExtractor('status')));
            if ($statusText !== '') {
                if (in_array($statusText, ['0', 'đã bán', 'sold', 'đã cọc', 'deposit', 'đã bán/đã cọc', 'đã khóa', 'đã đặt cọc'])) {
                    $qty = 0;
                }
            }
            
            $category = trim($valExtractor('category'));
            if (empty($category)) $category = 'Căn hộ';
            
            $unit = trim($valExtractor('unit'));
            if (empty($unit)) $unit = 'Căn';
            
            $notes = trim($valExtractor('notes'));
            
            $extraNotes = [];
            foreach ($mappings as $sysField => $cols) {
                if (!in_array($sysField, ['sku', 'product_name', 'price', 'import_price', 'qty', 'status', 'category', 'unit', 'notes'])) {
                    foreach ($cols as $colName) {
                        if (isset($rowData[$colName]) && $rowData[$colName] !== '') {
                            $extraNotes[] = $sysField . ': ' . $rowData[$colName];
                        }
                    }
                }
            }
            if (!empty($extraNotes)) {
                $notes = (empty($notes) ? '' : $notes . "\n") . implode("\n", $extraNotes);
            }
            
            $tenantId = 1;
            
            $prodQuery = $conn->prepare("SELECT id FROM products WHERE sku = ? AND tenant_id = ? LIMIT 1");
            $prodQuery->bind_param("si", $sku, $tenantId);
            $prodQuery->execute();
            $prodRes = $prodQuery->get_result()->fetch_assoc();
            $prodQuery->close();
            
            if ($prodRes) {
                $productId = $prodRes['id'];
                
                $upProd = $conn->prepare("UPDATE products SET name = ?, price = ?, stock_quantity = ?, category = ?, unit = ? WHERE id = ?");
                $upProd->bind_param("sdissi", $productName, $price, $qty, $category, $unit, $productId);
                $upProd->execute();
                $upProd->close();
                
                $batchQuery = $conn->prepare("SELECT id FROM batches WHERE product_id = ? AND tenant_id = ? LIMIT 1");
                $batchQuery->bind_param("ii", $productId, $tenantId);
                $batchQuery->execute();
                $batchRes = $batchQuery->get_result()->fetch_assoc();
                $batchQuery->close();
                
                if ($batchRes) {
                    $upBatch = $conn->prepare("UPDATE batches SET current_qty = ?, import_price = ?, notes = ? WHERE id = ?");
                    $upBatch->bind_param("idsi", $qty, $importPrice, $notes, $batchRes['id']);
                    $upBatch->execute();
                    $upBatch->close();
                } else {
                    $batchCode = 'SHEET-' . strtoupper(substr(md5($sku), 0, 8));
                    $insBatch = $conn->prepare("INSERT INTO batches (tenant_id, product_id, batch_code, import_date, import_price, initial_qty, current_qty, notes, status) VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, 'active')");
                    $insBatch->bind_param("iisdiis", $tenantId, $productId, $batchCode, $importPrice, $qty, $qty, $notes);
                    $insBatch->execute();
                    $insBatch->close();
                }
                $updatedCount++;
            } else {
                $insProd = $conn->prepare("INSERT INTO products (tenant_id, name, sku, price, category, unit, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
                $insProd->bind_param("issdssi", $tenantId, $productName, $sku, $price, $category, $unit, $qty);
                $insProd->execute();
                $productId = $insProd->insert_id;
                $insProd->close();
                
                $batchCode = 'SHEET-' . strtoupper(substr(md5($sku), 0, 8));
                $insBatch = $conn->prepare("INSERT INTO batches (tenant_id, product_id, batch_code, import_date, import_price, initial_qty, current_qty, notes, status) VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, 'active')");
                $insBatch->bind_param("iisdiis", $tenantId, $productId, $batchCode, $importPrice, $qty, $qty, $notes);
                $insBatch->execute();
                $insBatch->close();
                
                $insertedCount++;
            }
        }
        fclose($stream);
        logSync("Completed inventory sync. Updated: $updatedCount. Inserted: $insertedCount.");
    }
}

if (!function_exists('sendSheetSyncErrorAlert')) {
    function sendSheetSyncErrorAlert($conn, $connItem, $errorMessage) {
        logSync("Sending sync error notification for connection {$connItem['sheet_name']}...");
        
        $sheetName = $connItem['sheet_name'];
        $spreadsheetId = $connItem['spreadsheet_id'] ?? 'Không rõ';
        $timeStr = date('d/m/Y H:i:s');
        
        // Fetch ticket admins
        $admins = getTicketNotifyAdmins($conn);
        if (empty($admins)) {
            logSync("No admin accounts to notify.");
            return;
        }
        
        // 1. Zalo Alert
        $botToken = get_system_setting($conn, 'zalo_bot_token');
        if (!empty($botToken)) {
            $zaloMsg = "⚠️ [ CẢNH BÁO LỖI ĐỒNG BỘ TRANG TÍNH ]\n\n"
                     . "- Kết nối: $sheetName\n"
                     . "- ID Bảng tính: " . (strlen($spreadsheetId) > 20 ? substr($spreadsheetId, 0, 10) . '...' . substr($spreadsheetId, -10) : $spreadsheetId) . "\n"
                     . "- Thời gian: $timeStr\n"
                     . "- Chi tiết lỗi: $errorMessage\n\n"
                     . "Vui lòng kiểm tra lại thiết lập kết nối Sheets hoặc liên kết Google Sheets.";
                     
            foreach ($admins as $admin) {
                if (!empty($admin['zalo_chat_id'])) {
                    try {
                        sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg, false);
                    } catch (Exception $zEx) {
                        logSync("Error sending Zalo alert to admin {$admin['name']}: " . $zEx->getMessage());
                    }
                }
            }
        }
        
        // 2. Email Alert
        $frontendUrl = get_system_setting($conn, 'frontend_url');
        if (empty($frontendUrl)) {
            $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $frontendUrl = $proto . '://' . preg_replace('/\/backend.*$/', '', $host);
        }
        $frontendUrl = rtrim($frontendUrl, '/');
        
        $emailContent = '
        <p>Xin chào Admin,</p>
        <p>Hệ thống vừa phát hiện lỗi đồng bộ Google Sheets đối với kết nối sau:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px;">
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 150px; background-color: #f8fafc;">Tên kết nối:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">' . htmlspecialchars($sheetName) . '</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Spreadsheet ID:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">' . htmlspecialchars($spreadsheetId) . '</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Thời gian lỗi:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">' . $timeStr . '</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #dc2626;">Chi tiết lỗi:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: 500;">' . htmlspecialchars($errorMessage) . '</td>
            </tr>
        </table>
        <p>Vui lòng truy cập trang quản trị <a href="' . $frontendUrl . '/integrations">Cấu hình tích hợp</a> để kiểm tra và khắc phục lỗi.</p>
        ';
        
        foreach ($admins as $admin) {
            if (!empty($admin['email'])) {
                try {
                    sendEmailNotification(
                        $admin['email'],
                        "[CẢNH BÁO] Lỗi đồng bộ Google Sheets - " . $sheetName,
                        "LỖI ĐỒNG BỘ TRANG TÍNH",
                        $emailContent,
                        '',
                        false
                    );
                } catch (Exception $eEx) {
                    logSync("Error sending Email alert to admin {$admin['name']}: " . $eEx->getMessage());
                }
            }
        }
    }
}

if (!function_exists('sendSheetSyncDeescalateAlert')) {
    function sendSheetSyncDeescalateAlert($conn, $connItem) {
        logSync("Sending de-escalation final alert for connection {$connItem['sheet_name']}...");
        
        $sheetName = $connItem['sheet_name'];
        $spreadsheetId = $connItem['spreadsheet_id'] ?? 'Không rõ';
        $lastError = $connItem['last_error'] ?? 'Không rõ';
        $timeStr = date('d/m/Y H:i:s');
        
        $admins = getTicketNotifyAdmins($conn);
        if (empty($admins)) {
            return;
        }
        
        $botToken = get_system_setting($conn, 'zalo_bot_token');
        if (!empty($botToken)) {
            $zaloMsg = "🚨 [ CẢNH BÁO: TỰ ĐỘNG TẠM DỪNG KẾT NỐI SHEETS ]\n\n"
                     . "- Kết nối: $sheetName\n"
                     . "- ID Bảng tính: " . (strlen($spreadsheetId) > 20 ? substr($spreadsheetId, 0, 10) . '...' . substr($spreadsheetId, -10) : $spreadsheetId) . "\n"
                     . "- Trạng thái: Đã tự động TẠM DỪNG HOẠT ĐỘNG (is_active = 0)\n"
                     . "- Lý do: Lỗi đồng bộ liên tục kéo dài hơn 24 giờ.\n"
                     . "- Chi tiết lỗi cuối: $lastError\n\n"
                     . "Vui lòng kiểm tra lại quyền truy cập hoặc thiết lập trang tính, sau đó BẬT lại kết nối trong CRM.";
                     
            foreach ($admins as $admin) {
                if (!empty($admin['zalo_chat_id'])) {
                    try {
                        sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg, false);
                    } catch (Exception $zEx) {
                        logSync("Error sending Zalo de-escalation alert: " . $zEx->getMessage());
                    }
                }
            }
        }
        
        $frontendUrl = get_system_setting($conn, 'frontend_url');
        if (empty($frontendUrl)) {
            $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $frontendUrl = $proto . '://' . preg_replace('/\/backend.*$/', '', $host);
        }
        $frontendUrl = rtrim($frontendUrl, '/');
        
        $emailContent = '
        <p>Xin chào Admin,</p>
        <p>Hệ thống đã <strong>TỰ ĐỘNG TẠM DỪNG HOẠT ĐỘNG</strong> của kết nối trang tính sau do lỗi liên tục kéo dài hơn 24 giờ:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px;">
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 150px; background-color: #f8fafc;">Tên kết nối:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">' . htmlspecialchars($sheetName) . '</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Spreadsheet ID:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">' . htmlspecialchars($spreadsheetId) . '</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #dc2626;">Trạng thái mới:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">TẠM DỪNG (is_active = 0)</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Chi tiết lỗi cuối:</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; color: #475569;">' . htmlspecialchars($lastError) . '</td>
            </tr>
        </table>
        <p>Sau khi sửa xong lỗi trang tính, vui lòng bật lại tại trang quản trị <a href="' . $frontendUrl . '/integrations">Cấu hình tích hợp</a>.</p>
        ';
        
        foreach ($admins as $admin) {
            if (!empty($admin['email'])) {
                try {
                    sendEmailNotification(
                        $admin['email'],
                        "[CẢNH BÁO HỆ THỐNG] Tự động tạm dừng kết nối Google Sheets - " . $sheetName,
                        "TỰ ĐỘNG TẠM DỪNG KẾT NỐI SHEETS",
                        $emailContent,
                        '',
                        false
                    );
                } catch (Exception $eEx) {
                    logSync("Error sending Email de-escalation alert: " . $eEx->getMessage());
                }
            }
        }
    }
}

if (!function_exists('deescalateFailedConnections')) {
    function deescalateFailedConnections($conn) {
        logSync("Checking for failed sheet connections to de-escalate...");
        
        $sql = "SELECT * FROM sheet_connections 
                WHERE is_active = 1 
                  AND sync_status = 'error' 
                  AND (
                      (last_sync_at IS NOT NULL AND last_sync_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR))
                      OR (last_sync_at IS NULL AND created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR))
                  )";
        $res = $conn->query($sql);
        if ($res && $res->num_rows > 0) {
            while ($connItem = $res->fetch_assoc()) {
                logSync("De-escalating Connection ID {$connItem['id']} - {$connItem['sheet_name']} (In error for > 24 hours).");
                
                $upStmt = $conn->prepare("UPDATE sheet_connections SET is_active = 0, sync_status = 'idle', last_error = CONCAT(last_error, ' [Tự động tắt do lỗi liên tục > 24h]') WHERE id = ?");
                if ($upStmt) {
                    $upStmt->bind_param("i", $connItem['id']);
                    $upStmt->execute();
                    $upStmt->close();
                }
                
                sendSheetSyncDeescalateAlert($conn, $connItem);
            }
        }
    }
}

if (!function_exists('releasePendingWorkHoursLeads')) {
    function releasePendingWorkHoursLeads($conn) {
        logSync("Checking for pending work hours leads to release...");
        
        // Select all logs pending work hours, including status and leave dates to check if they went on leave
        $sql = "SELECT dl.id as log_id, dl.lead_id, dl.assigned_to, dl.round_id, dl.message, dl.status as log_status, COALESCE(dl.received_at, NOW()) AS received_at,
                       l.name as lead_name, l.phone as lead_phone, l.email as lead_email,
                       l.source as lead_source, l.type as lead_type, l.note as lead_note,
                       c.name as consultant_name, c.email as consultant_email, c.work_start_time, c.work_end_time, c.work_schedule,
                       c.status as consultant_status, c.leave_start, c.leave_end,
                       u.id AS user_id,
                       r.round_name, r.cc_emails
                FROM distribution_logs dl
                JOIN leads l ON dl.lead_id = l.id
                LEFT JOIN consultants c ON dl.assigned_to = c.id
                LEFT JOIN users u ON c.email = u.email
                LEFT JOIN distribution_rounds r ON dl.round_id = r.id
                WHERE dl.status = 'pending_work_hours' OR dl.status = 'pending'";
                 
        $res = $conn->query($sql);
        if (!$res) {
            logSync("Error querying pending work hours / pending leads.");
            return;
        }
        
        $currentTime = date('H:i');
        $releasedCount = 0;
        $readyToRelease = [];
        
        while ($row = $res->fetch_assoc()) {
            $targetUserId = (int) ($row['user_id'] ?? 0);
            $status = $row['consultant_status'];
            $leaveStart = $row['leave_start'] ?? null;
            $leaveEnd = $row['leave_end'] ?? null;
            $today = date('Y-m-d');
            $isLateCheckinRealloc = false;
            
            // Check if consultant is actually on leave or inactive, or if it is a pending log
            $isActuallyOnLeaveOrInactive = false;
            if ($row['log_status'] === 'pending') {
                $isActuallyOnLeaveOrInactive = true;
            } else if ($status !== 'active') {
                $isActuallyOnLeaveOrInactive = true;
            } else if (!empty($leaveStart) && !empty($leaveEnd)) {
                if ($today >= $leaveStart && $today <= $leaveEnd) {
                    $isActuallyOnLeaveOrInactive = true;
                }
            }

            // Check-in grace period timeout verification for pending_work_hours
            if (!$isActuallyOnLeaveOrInactive && $row['log_status'] === 'pending_work_hours') {
                $whStart = $row['work_start_time'] ?? '00:00';
                $whEnd = $row['work_end_time'] ?? '23:59';
                $workSchedule = $row['work_schedule'] ?? null;
                
                if (isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                    // Check if consultant has checked in today (Gate 2 Check-in constraint)
                    // Check if today is holiday or rest day, and check registrations
                    $currDate = date('Y-m-d');
                    $dayOfWeek = date('N');
                    $holidayName = '';
                    $holidaySchedulesJson = '[]';
                    $resHol = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'holiday_schedules' LIMIT 1");
                    if ($resHol && $hRow = $resHol->fetch_assoc()) {
                        $holidaySchedulesJson = !empty($hRow['setting_value']) ? $hRow['setting_value'] : '[]';
                    }
                    $holidays = json_decode($holidaySchedulesJson, true);
                    if (is_array($holidays)) {
                        foreach ($holidays as $h) {
                            if ($currDate >= $h['start'] && $currDate <= $h['end']) {
                                $holidayName = $h['name'];
                                break;
                            }
                        }
                    }

                    $isRestDay = false;
                    if ($dayOfWeek == 7) {
                        $isRestDay = true;
                    } else if ($dayOfWeek == 6) {
                        $stmtSched = $conn->prepare("SELECT work_schedule FROM users WHERE id = ?");
                        if ($stmtSched) {
                            $stmtSched->bind_param("i", $targetUserId);
                            $stmtSched->execute();
                            $sRow = $stmtSched->get_result()->fetch_assoc();
                            $stmtSched->close();
                            if ($sRow && !empty($sRow['work_schedule'])) {
                                $sched = json_decode($sRow['work_schedule'], true);
                                if (isset($sched[6]) && isset($sched[6]['active']) && !(bool)$sched[6]['active']) {
                                    $isRestDay = true;
                                }
                            }
                        }
                    }

                    $hasReg = false;
                    $isHoliday = !empty($holidayName);

                    if ($isHoliday) {
                        $stmtCheckReg = $conn->prepare("SELECT 1 FROM holiday_shift_registrations WHERE user_id = ? AND shift_date = ? AND approved = 1 LIMIT 1");
                        $stmtCheckReg->bind_param("is", $targetUserId, $currDate);
                        $stmtCheckReg->execute();
                        $hasReg = (bool)$stmtCheckReg->get_result()->fetch_assoc();
                        $stmtCheckReg->close();
                    }

                    if (!$hasReg && $isRestDay) {
                        $stmtCheckReg = $conn->prepare("SELECT 1 FROM weekend_shift_registrations WHERE user_id = ? AND shift_date = ? AND approved = 1 LIMIT 1");
                        $stmtCheckReg->bind_param("is", $targetUserId, $currDate);
                        $stmtCheckReg->execute();
                        $hasReg = (bool)$stmtCheckReg->get_result()->fetch_assoc();
                        $stmtCheckReg->close();
                    }

                    if (!$isHoliday && !$isRestDay) {
                        $hasReg = true; // Normal weekday workday
                    }

                    $isWeekendOrHoliday = (!empty($holidayName) || $isRestDay);
                    $reqWknd = (int) get_system_setting($conn, 'require_checkin_weekend_lead');
                    $reqHoli = (int) get_system_setting($conn, 'require_checkin_holiday_lead');
                    $mustCheckinWknd = ($isRestDay && $reqWknd === 1);
                    $mustCheckinHoli = (!empty($holidayName) && $reqHoli === 1);

                    if ($isWeekendOrHoliday && !$mustCheckinWknd && !$mustCheckinHoli) {
                        $hasCheckIn = $hasReg; // No check-in required for weekend/holiday shift if setting is OFF
                    } else {
                        // Must check check_ins table
                        $stmtCheck = $conn->prepare("SELECT 1 FROM check_ins WHERE user_id = ? AND check_in_date = ? AND status = 'approved' LIMIT 1");
                        if ($stmtCheck) {
                            $stmtCheck->bind_param("is", $targetUserId, $currDate);
                            $stmtCheck->execute();
                            $hasCheckIn = (bool)$stmtCheck->get_result()->fetch_assoc();
                            $stmtCheck->close();
                        }
                    }
                    if (!$hasCheckIn) {
                        // Exceeded grace period check
                        $timeoutMins = (int) get_system_setting($conn, 'lead_response_timeout_minutes');
                        if ($timeoutMins <= 0) {
                            $timeoutMins = 2;
                        }
                        
                        $gracePeriodStart = strtotime($today . ' ' . $whStart . ':00');
                        $gracePeriodExpires = $gracePeriodStart + ($timeoutMins * 60);
                        
                        if (time() > $gracePeriodExpires) {
                            logSync("Lead ID {$row['lead_id']}: check-in grace period expired for consultant {$row['consultant_name']}. Triggering reallocation...");
                            $isActuallyOnLeaveOrInactive = true;
                            $isLateCheckinRealloc = true;
                        }
                    }
                }
            }
            
            if ($isActuallyOnLeaveOrInactive) {
                logSync("Lead ID {$row['lead_id']} is pending or owner is inactive. Checking for new allocation...");
                
                $assignedConsultantId = null;
                $assignResult = null;
                if ($row['round_id'] > 0) {
                    $assignResult = getNextConsultantInRound($conn, $row['round_id']);
                    if ($assignResult) {
                        $assignedConsultantId = $assignResult['id'];
                    }
                }
                
                $isFallbackAdmin = false;
                $fallbackAdminData = null;
                $fallbackCcEmails = '';
                if (!$assignedConsultantId) {
                    $fbSettings = [];
                    $fbRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('fallback_type', 'fallback_round_id', 'fallback_admin_id', 'fallback_cc_email')");
                    if ($fbRes) {
                        while ($fbRow = $fbRes->fetch_assoc()) {
                            $fbSettings[$fbRow['setting_key']] = $fbRow['setting_value'];
                        }
                    }
                    $fbAdminId = (int) ($fbSettings['fallback_admin_id'] ?? 0);
                    $fbCc = $fbSettings['fallback_cc_email'] ?? '';
                    
                    if ($fbAdminId > 0) {
                        $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND (role = 'admin') LIMIT 1");
                        if ($admStmt) {
                            $admStmt->bind_param("i", $fbAdminId);
                            $admStmt->execute();
                            $admRes = $admStmt->get_result();
                            if ($admRes->num_rows > 0) {
                                $fallbackAdminData = $admRes->fetch_assoc();
                                $isFallbackAdmin = true;
                                $fallbackCcEmails = $fbCc;
                            }
                            $admStmt->close();
                        }
                    }
                }

                $oldAssignedTo = $row['assigned_to'] !== null ? (int)$row['assigned_to'] : null;
                $newAssignedTo = $assignedConsultantId !== null ? (int)$assignedConsultantId : ($isFallbackAdmin ? (int)$fallbackAdminData['id'] : null);
                
                if ($newAssignedTo === $oldAssignedTo && $row['log_status'] === 'pending') {
                    // Nothing changed, skip to avoid spam
                    continue;
                }
                
                $conn->begin_transaction();
                try {
                    $newStatus = 'assigned';
                    $logMsg = !empty($row['consultant_name']) ? "Thu hồi từ Sale nghỉ phép/không hoạt động ({$row['consultant_name']}). " : "Phân bổ lại lead đang chờ xử lý. ";
                    $newConsultantName = '';
                    $newConsultantEmail = '';
                    
                    if ($assignedConsultantId) {
                        $whStmt = $conn->prepare("SELECT name, email, work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
                        $whStmt->bind_param("i", $assignedConsultantId);
                        $whStmt->execute();
                        $whRes = $whStmt->get_result();
                        if ($whRes && $whRow = $whRes->fetch_assoc()) {
                            $whStart = $whRow['work_start_time'] ?? '00:00';
                            $whEnd = $whRow['work_end_time'] ?? '23:59';
                            $workSchedule = $whRow['work_schedule'] ?? null;
                            $tempTime = date('H:i');
                            if (!isConsultantInWorkHours($tempTime, $whStart, $whEnd, $workSchedule)) {
                                $newStatus = 'pending_work_hours';
                                $compSuffix = ($assignResult && $assignResult['is_compensation']) ? ' (Bù lượt)' : '';
                                $logMsg .= "Gán cho Sale mới: {$whRow['name']} (Chờ ngoài giờ làm việc){$compSuffix}.";
                            } else {
                                $newStatus = ($assignResult && $assignResult['is_compensation']) ? 'compensation' : 'assigned';
                                $logMsg .= "Tái phân bổ thành công cho Sale mới: {$whRow['name']}.";
                            }
                            $newConsultantName = $whRow['name'];
                            $newConsultantEmail = $whRow['email'];
                        }
                        $whStmt->close();
                    } else if ($isFallbackAdmin && $fallbackAdminData) {
                        $newStatus = 'assigned';
                        $logMsg .= "Không có Sale hoạt động khác trong vòng, chuyển fallback về Admin: " . $fallbackAdminData['name'];
                    } else {
                        $newStatus = 'pending';
                        $logMsg .= "Không có Sale hoạt động khác trong vòng hoặc Admin fallback. Lead chuyển về Chờ xử lý.";
                    }
                    
                    // Update lead table
                    $upLead = $conn->prepare("UPDATE leads SET assigned_to = ? WHERE id = ?");
                    $upLead->bind_param("ii", $assignedConsultantId, $row['lead_id']);
                    $upLead->execute();
                    $upLead->close();
                    
                    // Revoke old distribution log
                    $upLog = $conn->prepare("UPDATE distribution_logs SET status = 'reallocated', message = CONCAT(message, '\n[Thu hồi/phân bổ lại lúc ', NOW(), ']') WHERE id = ?");
                    $upLog->bind_param("i", $row['log_id']);
                    $upLog->execute();
                    $upLog->close();

                    // Bù lead cho Sale bị thu hồi - chỉ khi Sale cũ có tồn tại
                    if ($row['round_id'] > 0 && $row['assigned_to'] !== null) {
                        $shouldCompensate = true;
                        if ($isLateCheckinRealloc) {
                            $lateCompEnabled = (int) get_system_setting($conn, 'late_checkin_compensation_enabled');
                            if ($lateCompEnabled !== 1) {
                                $shouldCompensate = false;
                            }
                        } else {
                            $leaveCompEnabled = (int) get_system_setting($conn, 'leave_compensation_enabled');
                            if ($leaveCompEnabled !== 1) {
                                $shouldCompensate = false;
                            }
                        }
                        if ($shouldCompensate) {
                            $compUpStmt = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                            $compUpStmt->bind_param("ii", $row['round_id'], $row['assigned_to']);
                            $compUpStmt->execute();
                            $compUpStmt->close();
                        }
                    }
                    
                    logDistribution($conn, $row['lead_id'], $assignedConsultantId, $row['round_id'], $newStatus, $logMsg, false);
                    
                    $conn->commit();
                    
                    // Post-commit: trigger live write-back
                    triggerTwoWaySync($conn, $row['lead_id']);
                    
                    // Trigger notifications out-of-transaction to avoid locking DB during API/SMTP delay
                    if ($assignedConsultantId && $newStatus !== 'pending_work_hours') {
                        try {
                            sendLeadAssignedEmailToSale(
                                $newConsultantEmail,
                                $newConsultantName,
                                $row['lead_name'] ?: 'Khách hàng ẩn danh',
                                $row['lead_phone'] ?: '',
                                $row['lead_note'] ?: '',
                                $row['lead_source'] ?: '',
                                $row['cc_emails'] ?? '',
                                $row['round_name'] ?? '',
                                $row['lead_id'],
                                $assignedConsultantId,
                                $row['round_id'] ?? 0
                            );
                        } catch (Exception $mailEx) {
                            logSync("Error sending email to new consultant: " . $mailEx->getMessage());
                        }
                        
                        try {
                            sendLeadAssignedZaloMessageToSale(
                                $assignedConsultantId,
                                $newConsultantName,
                                $row['lead_name'] ?: 'Khách hàng ẩn danh',
                                $row['lead_phone'] ?: '',
                                $row['lead_note'] ?: '',
                                $row['lead_source'] ?: '',
                                $row['round_name'] ?? '',
                                $row['lead_id'],
                                $row['round_id'] ?? 0,
                                $row['lead_email'] ?: '',
                                $row['lead_type'] ?: ''
                            );
                        } catch (Exception $zaloEx) {
                            logSync("Error sending Zalo to new consultant: " . $zaloEx->getMessage());
                        }
                    } else if ($isFallbackAdmin && $fallbackAdminData) {
                        try {
                            sendLeadAssignedEmailToSale(
                                $fallbackAdminData['email'],
                                $fallbackAdminData['name'],
                                $row['lead_name'] ?: 'Khách hàng ẩn danh',
                                $row['lead_phone'] ?: '',
                                $row['lead_note'] ?: '',
                                $row['lead_source'] ?: '',
                                $fallbackCcEmails,
                                'Fallback Admin',
                                $row['lead_id'],
                                0,
                                0
                            );
                        } catch (Exception $mailEx) {
                            logSync("Error sending email to fallback admin: " . $mailEx->getMessage());
                        }
                        if (!empty($fallbackAdminData['zalo_chat_id'])) {
                            try {
                                sendLeadAssignedZaloMessageToAdmin(
                                    $fallbackAdminData['zalo_chat_id'],
                                    $fallbackAdminData['name'],
                                    $row['lead_name'] ?: 'Khách hàng ẩn danh',
                                    $row['lead_phone'] ?: '',
                                    $row['lead_note'] ?: '',
                                    $row['lead_source'] ?: '',
                                    $row['lead_id'],
                                    $row['lead_email'] ?: '',
                                    $row['lead_type'] ?: ''
                                );
                            } catch (Exception $zaloEx) {
                                logSync("Error sending Zalo to fallback admin: " . $zaloEx->getMessage());
                            }
                        }
                    }
                    
                    $releasedCount++;
                } catch (Exception $e) {
                    $conn->rollback();
                    logSync("Error reallocating lead ID {$row['lead_id']} from on-leave consultant: " . $e->getMessage());
                }
            } else {
                // Sale is active and working normal - check standard work hours release
                $whStart = $row['work_start_time'] ?? '00:00';
                $whEnd = $row['work_end_time'] ?? '23:59';
                $workSchedule = $row['work_schedule'] ?? null;
                
                if (isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                    // Check if consultant has an approved check-in for today (Gate 2 Check-in constraint)
                    // Check if today is holiday or rest day, and check registrations
                    $currDate = date('Y-m-d');
                    $dayOfWeek = date('N');
                    $holidayName = '';
                    $holidaySchedulesJson = '[]';
                    $resHol = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'holiday_schedules' LIMIT 1");
                    if ($resHol && $hRow = $resHol->fetch_assoc()) {
                        $holidaySchedulesJson = !empty($hRow['setting_value']) ? $hRow['setting_value'] : '[]';
                    }
                    $holidays = json_decode($holidaySchedulesJson, true);
                    if (is_array($holidays)) {
                        foreach ($holidays as $h) {
                            if ($currDate >= $h['start'] && $currDate <= $h['end']) {
                                $holidayName = $h['name'];
                                break;
                            }
                        }
                    }

                    $isRestDay = false;
                    if ($dayOfWeek == 7) {
                        $isRestDay = true;
                    } else if ($dayOfWeek == 6) {
                        $stmtSched = $conn->prepare("SELECT work_schedule FROM users WHERE id = ?");
                        if ($stmtSched) {
                            $stmtSched->bind_param("i", $targetUserId);
                            $stmtSched->execute();
                            $sRow = $stmtSched->get_result()->fetch_assoc();
                            $stmtSched->close();
                            if ($sRow && !empty($sRow['work_schedule'])) {
                                $sched = json_decode($sRow['work_schedule'], true);
                                if (isset($sched[6]) && isset($sched[6]['active']) && !(bool)$sched[6]['active']) {
                                    $isRestDay = true;
                                }
                            }
                        }
                    }

                    $hasReg = true;
                    if (!empty($holidayName)) {
                        $stmtCheckReg = $conn->prepare("SELECT 1 FROM holiday_shift_registrations WHERE user_id = ? AND shift_date = ? AND approved = 1 LIMIT 1");
                        $stmtCheckReg->bind_param("is", $targetUserId, $currDate);
                        $stmtCheckReg->execute();
                        $hasReg = (bool)$stmtCheckReg->get_result()->fetch_assoc();
                        $stmtCheckReg->close();
                    } else if ($isRestDay) {
                        $stmtCheckReg = $conn->prepare("SELECT 1 FROM weekend_shift_registrations WHERE user_id = ? AND shift_date = ? AND approved = 1 LIMIT 1");
                        $stmtCheckReg->bind_param("is", $targetUserId, $currDate);
                        $stmtCheckReg->execute();
                        $hasReg = (bool)$stmtCheckReg->get_result()->fetch_assoc();
                        $stmtCheckReg->close();
                    }

                    $isWeekendOrHoliday = (!empty($holidayName) || $isRestDay);
                    $reqWknd = (int) get_system_setting($conn, 'require_checkin_weekend_lead');
                    $reqHoli = (int) get_system_setting($conn, 'require_checkin_holiday_lead');
                    $mustCheckinWknd = ($isRestDay && $reqWknd === 1);
                    $mustCheckinHoli = (!empty($holidayName) && $reqHoli === 1);

                    if ($isWeekendOrHoliday && !$mustCheckinWknd && !$mustCheckinHoli) {
                        $hasCheckIn = $hasReg; // No check-in required for weekend/holiday shift if setting is OFF
                    } else {
                        // Must check check_ins table
                        $stmtCheck = $conn->prepare("SELECT 1 FROM check_ins WHERE user_id = ? AND check_in_date = ? AND status = 'approved' LIMIT 1");
                        if ($stmtCheck) {
                            $stmtCheck->bind_param("is", $targetUserId, $currDate);
                            $stmtCheck->execute();
                            $hasCheckIn = (bool)$stmtCheck->get_result()->fetch_assoc();
                            $stmtCheck->close();
                        }
                    }
                    
                    if ($hasCheckIn) {
                        $readyToRelease[$row['assigned_to']][] = $row;
                    }
                }
            }
        }
        
        // Process standard releases (grouped by consultant to support summary notification)
        foreach ($readyToRelease as $consultantId => $group) {
            $count = count($group);
            $consultantName = $group[0]['consultant_name'];
            
            if ($count > 1) {
                // Determine received_at range
                $minTimestamp = null;
                $maxTimestamp = null;
                foreach ($group as $item) {
                    $ts = strtotime($item['received_at']);
                    if ($ts > 0) {
                        if ($minTimestamp === null || $ts < $minTimestamp) {
                            $minTimestamp = $ts;
                        }
                        if ($maxTimestamp === null || $ts > $maxTimestamp) {
                            $maxTimestamp = $ts;
                        }
                    }
                }
                
                if ($minTimestamp !== null && $maxTimestamp !== null) {
                    $minTimeStr = date('H:i d/m', $minTimestamp);
                    $maxTimeStr = date('H:i d/m', $maxTimestamp);
                    
                    // Send Zalo greeting summary
                    logSync("Sending Zalo summary message to consultant $consultantName ($count leads)...");
                    try {
                        sendZaloReleaseSummaryMessageToSale($consultantId, $consultantName, $minTimeStr, $maxTimeStr, $count);
                    } catch (Exception $sumEx) {
                        logSync("Error sending Zalo summary: " . $sumEx->getMessage());
                    }
                }
            }
            
            // Release each lead individually
            foreach ($group as $row) {
                // Determine original status (assigned or compensation)
                $newStatus = (strpos($row['message'], 'compensation') !== false || strpos($row['message'], 'đền bù') !== false || strpos($row['message'], 'Bù lượt') !== false) ? 'compensation' : 'assigned';
                
                $conn->begin_transaction();
                try {
                    $stmtUp = $conn->prepare("UPDATE distribution_logs SET status = ?, message = CONCAT(message, '\n[Released at ', NOW(), ']') WHERE id = ? AND status = 'pending_work_hours'");
                    $stmtUp->bind_param("si", $newStatus, $row['log_id']);
                    $stmtUp->execute();
                    $affected = $stmtUp->affected_rows;
                    $stmtUp->close();
                    $conn->commit();
                    
                    if ($affected > 0) {
                        // Post-commit: kích hoạt đồng bộ 2 chiều lên Google Sheets
                        triggerTwoWaySync($conn, $row['lead_id']);
 
                        logSync("Releasing lead ID {$row['lead_id']} to consultant {$row['consultant_name']} ({$row['consultant_email']})...");
                        
                        // Send Email
                        try {
                            sendLeadAssignedEmailToSale(
                                $row['consultant_email'],
                                $row['consultant_name'],
                                $row['lead_name'] ?: 'Khách hàng ẩn danh',
                                $row['lead_phone'] ?: '',
                                $row['lead_note'] ?: '',
                                $row['lead_source'] ?: '',
                                $row['cc_emails'] ?? '',
                                $row['round_name'] ?? '',
                                $row['lead_id'],
                                $row['assigned_to'],
                                $row['round_id'] ?? 0
                            );
                        } catch (Exception $mailEx) {
                            logSync("Error sending release email to consultant: " . $mailEx->getMessage());
                        }
                        
                        // Send Zalo Message
                        try {
                            sendLeadAssignedZaloMessageToSale(
                                $row['assigned_to'],
                                $row['consultant_name'],
                                $row['lead_name'] ?: 'Khách hàng ẩn danh',
                                $row['lead_phone'] ?: '',
                                $row['lead_note'] ?: '',
                                $row['lead_source'] ?: '',
                                $row['round_name'] ?? '',
                                $row['lead_id'],
                                $row['round_id'] ?? 0,
                                $row['lead_email'] ?: '',
                                $row['lead_type'] ?: ''
                            );
                        } catch (Exception $zaloEx) {
                            logSync("Error sending release Zalo to consultant: " . $zaloEx->getMessage());
                        }
                        
                        $releasedCount++;
                    }
                } catch (Exception $e) {
                    $conn->rollback();
                    logSync("Error releasing log ID {$row['log_id']}: " . $e->getMessage());
                }
            }
        }
        
        if ($releasedCount > 0) {
            logSync("Successfully released/reallocated $releasedCount pending leads.");
        } else {
            logSync("No pending leads released.");
        }
    }
}
if (!function_exists('recallInactiveLeads')) {
    function recallInactiveLeads($conn) {
        logSync("Checking for inactive unaccepted leads to recall...");
        
        $sql = "SELECT l.id as lead_id, l.name as lead_name, l.phone as lead_phone, l.email as lead_email,
                       l.source as lead_source, l.type as lead_type, l.note as lead_note,
                       l.assigned_to as old_consultant_id, l.connection_id, l.last_interaction_date,
                       c.name as old_consultant_name, c.email as old_consultant_email,
                       IFNULL(sc.lead_recall_minutes, 0) as connection_recall_minutes
                FROM leads l
                JOIN consultants c ON l.assigned_to = c.id
                LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
                WHERE l.is_accepted = 0
                  AND l.assigned_to IS NOT NULL
                ORDER BY l.id ASC";
                
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            logSync("Error preparing recall query.");
            return;
        }
        $stmt->execute();
        $res = $stmt->get_result();
        $allLeads = $res->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        if (empty($allLeads)) {
            logSync("No inactive unaccepted leads found.");
            return;
        }

        $leads = [];
        foreach ($allLeads as $row) {
            $leadRecallMins = get_lead_recall_minutes($conn, $row['last_interaction_date'], $row['connection_recall_minutes']);

            $elapsedSeconds = time() - strtotime($row['last_interaction_date']);
            if ($elapsedSeconds >= $leadRecallMins * 60) {
                $leads[] = $row;
            }
        }

        if (empty($leads)) {
            logSync("No inactive unaccepted leads exceeded timeout.");
            return;
        }

        logSync("Found " . count($leads) . " unaccepted leads that exceeded the recall threshold.");

        foreach ($leads as $row) {
            $leadId = $row['lead_id'];
            $oldConsultantId = $row['old_consultant_id'];
            $oldConsultantName = $row['old_consultant_name'];

            $conn->begin_transaction();
            try {
                // Lock and re-verify that the lead is still unaccepted to avoid race conditions
                $verifyStmt = $conn->prepare("SELECT is_accepted FROM leads WHERE id = ? FOR UPDATE");
                $verifyStmt->bind_param("i", $leadId);
                $verifyStmt->execute();
                $vRes = $verifyStmt->get_result()->fetch_assoc();
                $verifyStmt->close();

                if (!$vRes || (int)$vRes['is_accepted'] !== 0) {
                    $conn->commit();
                    continue;
                }

                // Find latest distribution log for this lead
                $logStmt = $conn->prepare("SELECT id, round_id FROM distribution_logs WHERE lead_id = ? AND assigned_to = ? AND status IN ('assigned', 'compensation') ORDER BY id DESC LIMIT 1");
                $logStmt->bind_param("ii", $leadId, $oldConsultantId);
                $logStmt->execute();
                $logRes = $logStmt->get_result();
                $logData = $logRes->fetch_assoc();
                $logStmt->close();

                $roundId = $logData ? (int)$logData['round_id'] : 0;
                $logId = $logData ? (int)$logData['id'] : 0;

                // 1. Mark the old distribution log as 'recalled'
                if ($logId > 0) {
                    $upOldLog = $conn->prepare("UPDATE distribution_logs SET status = 'recalled', message = CONCAT(message, '\n[Thu hồi tự động do Sale không tiếp nhận sau ', ?, ' phút]') WHERE id = ?");
                    $upOldLog->bind_param("ii", $row['lead_recall_minutes'], $logId);
                    $upOldLog->execute();
                    $upOldLog->close();
                }

                // 2. Increment compensation count - DISABLED: Sale who does not accept lead should NOT get compensated
                /*
                if ($roundId > 0) {
                    $chkComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                    $chkComp->bind_param("ii", $roundId, $oldConsultantId);
                    $chkComp->execute();
                    $chkComp->close();
                }
                */

                // 3. Find next consultant in the round (or fallback to admin)
                $newConsultantId = null;
                $newStatus = 'assigned';
                $newConsultantName = '';
                $newConsultantEmail = '';
                $roundName = 'Không rõ';
                $ccEmails = '';
                $isFallbackAdmin = false;
                $fallbackAdminData = null;
                $fallbackCcEmails = '';

                if ($roundId > 0) {
                    // Fetch round info
                    $rStmt = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
                    $rStmt->bind_param("i", $roundId);
                    $rStmt->execute();
                    $rRes = $rStmt->get_result()->fetch_assoc();
                    if ($rRes) {
                        $roundName = $rRes['round_name'];
                        $ccEmails = $rRes['cc_emails'];
                    }
                    $rStmt->close();

                    $assignResult = getNextConsultantInRound($conn, $roundId);
                    if ($assignResult) {
                        $newConsultantId = $assignResult['id'];
                        $newStatus = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                    }
                }

                if ($newConsultantId) {
                    // Fetch new consultant info
                    $ncStmt = $conn->prepare("SELECT name, email, work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
                    $ncStmt->bind_param("i", $newConsultantId);
                    $ncStmt->execute();
                    $ncRow = $ncStmt->get_result()->fetch_assoc();
                    if ($ncRow) {
                        $newConsultantName = $ncRow['name'];
                        $newConsultantEmail = $ncRow['email'];
                        
                        // Check working hours
                        $currentTime = date('H:i');
                        if (!isConsultantInWorkHours($currentTime, $ncRow['work_start_time'], $ncRow['work_end_time'], $ncRow['work_schedule'])) {
                            $newStatus = 'pending_work_hours';
                        }
                    }
                    $ncStmt->close();
                } else {
                    // Fallback to Admin
                    $fbSettings = get_system_setting($conn);
                    $fbAdminId = (int)($fbSettings['fallback_admin_id'] ?? 0);
                    $fbCc = $fbSettings['fallback_cc_email'] ?? '';
                    
                    if ($fbAdminId > 0) {
                        $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND (role = 'admin' OR role = 'superadmin') LIMIT 1");
                        $admStmt->bind_param("i", $fbAdminId);
                        $admStmt->execute();
                        $admRes = $admStmt->get_result();
                        if ($admRes->num_rows > 0) {
                            $fallbackAdminData = $admRes->fetch_assoc();
                            $newConsultantId = null;
                            $isFallbackAdmin = true;
                            $fallbackCcEmails = $fbCc;
                        }
                        $admStmt->close();
                    }
                }

                // 4. Update leads table
                $upLead = $conn->prepare("UPDATE leads SET assigned_to = ?, last_interaction_date = NOW(), is_accepted = 0 WHERE id = ?");
                $upLead->bind_param("ii", $newConsultantId, $leadId);
                $upLead->execute();
                $upLead->close();

                // 5. Log the new distribution
                $compSuffix = ($assignResult && $assignResult['is_compensation']) ? ' (Bù lượt)' : '';
                $logMsg = "Tái phân bổ tự động do Sale {$oldConsultantName} không tiếp nhận.{$compSuffix}";
                if ($isFallbackAdmin && $fallbackAdminData) {
                    $logMsg = "Thu hồi từ Sale {$oldConsultantName} và chuyển fallback về Admin: " . $fallbackAdminData['name'];
                } else if (!$newConsultantId) {
                    $newStatus = 'pending';
                    $logMsg = "Thu hồi từ Sale {$oldConsultantName}. Không tìm thấy Sale hoạt động khác trong vòng, chuyển lead về trạng thái Chờ xử lý (Pending).";
                }
                logDistribution($conn, $leadId, $newConsultantId, $roundId, $newStatus, $logMsg, false);

                $conn->commit();

                // Post-commit: trigger live write-back
                triggerTwoWaySync($conn, $leadId);

                // Send notifications
                if ($newConsultantId && $newStatus !== 'pending_work_hours') {
                    try {
                        sendLeadAssignedEmailToSale(
                            $newConsultantEmail,
                            $newConsultantName,
                            $row['lead_name'] ?: 'Khách hàng ẩn danh',
                            $row['lead_phone'] ?: '',
                            $row['lead_note'] ?: '',
                            $row['lead_source'] ?: '',
                            $ccEmails,
                            $roundName,
                            $leadId,
                            $newConsultantId,
                            $roundId
                        );
                    } catch (Exception $mailEx) {
                        logSync("Error sending email to new consultant: " . $mailEx->getMessage());
                    }
                    try {
                        sendLeadAssignedZaloMessageToSale(
                            $newConsultantId,
                            $newConsultantName,
                            $row['lead_name'] ?: 'Khách hàng ẩn danh',
                            $row['lead_phone'] ?: '',
                            $row['lead_note'] ?: '',
                            $row['lead_source'] ?: '',
                            $roundName,
                            $leadId,
                            $roundId,
                            $row['lead_email'] ?: '',
                            $row['lead_type'] ?: ''
                        );
                    } catch (Exception $zaloEx) {
                        logSync("Error sending Zalo to new consultant: " . $zaloEx->getMessage());
                    }
                } else if ($isFallbackAdmin && $fallbackAdminData) {
                    try {
                        sendLeadAssignedEmailToSale(
                            $fallbackAdminData['email'],
                            $fallbackAdminData['name'],
                            $row['lead_name'] ?: 'Khách hàng ẩn danh',
                            $row['lead_phone'] ?: '',
                            $row['lead_note'] ?: '',
                            $row['lead_source'] ?: '',
                            $fallbackCcEmails,
                            'Fallback Admin',
                            $leadId,
                            0,
                            0
                        );
                    } catch (Exception $mailEx) {
                        logSync("Error sending email to fallback admin: " . $mailEx->getMessage());
                    }
                }
                
                // Notify the old consultant about the recall
                try {
                    $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                    $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
                    
                    $oldCZalo = null;
                    $cZaloStmt = $conn->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
                    $cZaloStmt->bind_param("i", $oldConsultantId);
                    $cZaloStmt->execute();
                    $cZaloRes = $cZaloStmt->get_result()->fetch_assoc();
                    if ($cZaloRes) {
                        $oldCZalo = $cZaloRes['zalo_chat_id'];
                    }
                    $cZaloStmt->close();

                    if (!empty($botToken) && !empty($oldCZalo)) {
                        $lName = $row['lead_name'] ?: 'Khách hàng ẩn danh';
                        $recallMsg = "⚠️ [ THÔNG BÁO THU HỒI DATA ] ⚠️\n"
                                   . "━━━━━━━━━━━━━━━━━━━━━\n"
                                   . "Chào $oldConsultantName,\n\n"
                                   . "Data \"$lName\" đã bị hệ thống THU HỒI do bạn không tiếp nhận trong vòng " . $row['lead_recall_minutes'] . " phút.\n"
                                   . "Hệ thống đã bù lại 1 lượt nhận data cho bạn tại vòng: $roundName.\n\n"
                                   . "Trân trọng,\nHệ thống Quản lý Rich Land DATA\n"
                                   . "━━━━━━━━━━━━━━━━━━━━━";
                        sendZaloMessage($botToken, $oldCZalo, $recallMsg);
                    }
                } catch (Exception $recZaloEx) {
                    logSync("Error sending recall warning Zalo: " . $recZaloEx->getMessage());
                }

                logSync("Recalled lead ID $leadId from sale $oldConsultantName successfully.");

            } catch (Exception $e) {
                $conn->rollback();
                logSync("Error recalling lead ID $leadId: " . $e->getMessage());
            }
        }
    }
}

logSync("Starting Google Sheets Sync Cronjob...");
if (!isset($argv[1])) {
    deescalateFailedConnections($conn);
    releasePendingWorkHoursLeads($conn);
    recallInactiveLeads($conn);
}

// Get active connections
$sql = "SELECT * FROM sheet_connections WHERE is_active = 1";
$params = [];
$types = "";

// Check if a specific connection ID was passed via CLI argument
if (isset($argv[1]) && is_numeric($argv[1])) {
    $sql .= " AND id = ?";
    $params[] = (int)$argv[1];
    $types .= "i";
} else {
    // Filter by sync interval for normal connections, and select uninitialized silent connections
    $sql .= " AND (
        (is_silent = 0 AND (last_sync_at IS NULL OR DATE_ADD(last_sync_at, INTERVAL sync_interval MINUTE) <= NOW()))
        OR (is_silent = 1 AND is_initialized = 0)
    )";
}

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$connections = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

logSync("Found " . count($connections) . " active connections.");

foreach ($connections as $connItem) {
    if (empty($connItem['spreadsheet_id'])) {
        logSync("Skipping ID {$connItem['id']}: No spreadsheet_id provided.");
        continue;
    }

    logSync("Syncing Connection ID {$connItem['id']} - {$connItem['sheet_name']}...");
    
    // Update status to syncing atomically to prevent concurrent sync executions
    $upStmt = $conn->prepare("UPDATE sheet_connections SET sync_status = 'syncing' WHERE id = ? AND sync_status = 'idle'");
    $upStmt->bind_param("i", $connItem['id']);
    $upStmt->execute();
    $affected = $upStmt->affected_rows;
    $upStmt->close();

    if ($affected === 0) {
        logSync("Skipping ID {$connItem['id']}: Connection is in error status or already syncing.");
        continue;
    }

    if ($connItem['connection_type'] === 'inventory_sheets') {
        try {
            syncInventoryConnection($conn, $connItem);
            
            $upStmt = $conn->prepare("UPDATE sheet_connections SET last_sync_at = NOW(), sync_status = 'idle', last_error = NULL, sync_error_count = 0, is_initialized = 1 WHERE id = ?");
            $upStmt->bind_param("i", $connItem['id']);
            $upStmt->execute();
            $upStmt->close();
        } catch (Exception $e) {
            logSync("Error syncing inventory connection {$connItem['id']}: " . $e->getMessage());
            
            $err = $e->getMessage();
            $upStmt = $conn->prepare("UPDATE sheet_connections SET sync_status = 'error', last_error = ?, sync_error_count = sync_error_count + 1 WHERE id = ?");
            $upStmt->bind_param("si", $err, $connItem['id']);
            $upStmt->execute();
            $upStmt->close();
        }
        continue;
    }

    try {
        // Fetch field mappings
        $mapStmt = $conn->prepare("SELECT sheet_column, system_field, custom_label FROM field_mappings WHERE connection_id = ?");
        $mapStmt->bind_param("i", $connItem['id']);
        $mapStmt->execute();
        $mappingsResult = $mapStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $mapStmt->close();
        
        $mappings = [];
        foreach ($mappingsResult as $row) {
            $sysField = $row['system_field'];
            if (!isset($mappings[$sysField])) {
                $mappings[$sysField] = [];
            }
            $mappings[$sysField][] = [
                'sheet_column' => $row['sheet_column'],
                'custom_label' => $row['custom_label']
            ];
        }

        // Helper function for extraction
        if (!function_exists('extractMappedValues')) {
            function extractMappedValues($mappingsArray, $systemField, $data) {
                if (!isset($mappingsArray[$systemField])) return '';
                $values = [];
                foreach ($mappingsArray[$systemField] as $mapItem) {
                    $colName = $mapItem['sheet_column'];
                    $customLabel = $mapItem['custom_label'];
                    if (isset($data[$colName]) && $data[$colName] !== '') {
                        $label = !empty($customLabel) ? $customLabel : $colName;
                        $values[] = $label . ': ' . $data[$colName];
                    }
                }
                // For unique/specific system fields & custom fields, return the raw value directly of the first matched non-empty column
                $knownSingleFields = [
                    'phone', 'phone2', 'name', 'email', 'source', 'type', 'assigned_to', 'saleperson',
                    'gender', 'dob', 'citizen_id', 'address', 'city', 'district', 'company', 'job_title', 'tax_code',
                    'budget', 'demand_type', 'property_type', 'bedroom_count', 'preferred_location',
                    'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'platform', 'form_name',
                    'zalo_phone', 'facebook_link'
                ];
                if (in_array($systemField, $knownSingleFields) || strpos($systemField, 'cf_') === 0 || strpos($systemField, 'custom_field_') === 0) {
                    foreach ($mappingsArray[$systemField] as $mapItem) {
                        $colName = $mapItem['sheet_column'];
                        if (isset($data[$colName]) && $data[$colName] !== '') {
                            return $data[$colName];
                        }
                    }
                    return '';
                }
                return implode("\n", $values);
            }
        }

        // Fetch CSV from Google Sheets using gviz/tq, supporting specific sheet names
        $csvUrl = "https://docs.google.com/spreadsheets/d/" . trim($connItem['spreadsheet_id']) . "/gviz/tq?tqx=out:csv";
        if (!empty($connItem['sheet_name'])) {
            $csvUrl .= "&sheet=" . urlencode($connItem['sheet_name']);
        }
        
        $ch = curl_init($csvUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $timeout = (php_sapi_name() === 'cli') ? 60 : 15;
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        // Force IPv4 to prevent misconfigured IPv6 gateway from causing 60s operation timeout
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode !== 200 || empty($csvData) || stripos($csvData, '<html') !== false || stripos($csvData, '<!DOCTYPE') !== false) {
            $errDetail = $curlError ? " (cURL Error: $curlError)" : "";
            throw new Exception("Failed to fetch CSV. HTTP Code: $httpCode$errDetail. Spreadsheet might be private or invalid.");
        }

        // Parse CSV data using php://temp to prevent RAM exhaustion (writes to disk if > 2MB)
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $csvData);
        rewind($stream);

        $headers = [];
        $syncedCount = 0;
        $rowCount = 0;

        // Fetch all existing hashes to prevent N+1 Queries (Bottleneck Fix)
        $hashMap = [];
        $existingHashesStmt = $conn->prepare("SELECT row_hash FROM sheet_sync_records WHERE connection_id = ?");
        $existingHashesStmt->bind_param("i", $connItem['id']);
        $existingHashesStmt->execute();
        $existingHashesRes = $existingHashesStmt->get_result();
        while ($hRow = $existingHashesRes->fetch_assoc()) {
            $hashMap[$hRow['row_hash']] = true;
        }
        $existingHashesStmt->close();

        // Check if this connection requires Silent Sync (First run of 'new_only' mode)
        $isSilentSync = (!empty($connItem['sync_mode']) && $connItem['sync_mode'] === 'new_only' && empty($connItem['is_initialized']));

        // Preload all rounds for this connection sync to avoid N+1 queries in the loop
        $roundsCache = [];
        $roundsRes = $conn->query("SELECT id, is_active, round_name, cc_emails FROM distribution_rounds");
        if ($roundsRes) {
            while ($rRow = $roundsRes->fetch_assoc()) {
                $roundsCache[(int)$rRow['id']] = $rRow;
            }
        }

        // Prepare statements outside the CSV row parsing loop to optimize performance
        $recordStmt = $conn->prepare("INSERT IGNORE INTO sheet_sync_records (connection_id, row_hash) VALUES (?, ?)");
        $lockStmt = $conn->prepare("SELECT GET_LOCK(?, 10) as get_lock");
        $relStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
        $updHeldPending = $conn->prepare("UPDATE leads SET status = 'pending_approval', target_round_id = ?, ai_screener_status = 'pending', ai_evaluation = 'Chờ AI đánh giá', assigned_to = NULL WHERE id = ?");
        $updHeldFailed = $conn->prepare("UPDATE leads SET status = 'pending_approval', target_round_id = ?, ai_screener_status = ?, ai_evaluation = ?, assigned_to = NULL WHERE id = ?");
        $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
        $updAi = $conn->prepare("UPDATE leads SET ai_screener_status = ?, ai_evaluation = ? WHERE id = ?");

        while (($row = fgetcsv($stream)) !== FALSE) {
            $row = array_map(function($val) { return trim($val ?? '', "\" "); }, $row);
            if ($rowCount === 0) {
                // Headers
                $headers = $row;
                $rowCount++;
                continue;
            }
            $rowCount++;

            if (empty(array_filter($row))) continue; // skip empty rows

            $rowData = [];
            foreach ($headers as $colIdx => $colName) {
                $rowData[$colName] = $row[$colIdx] ?? '';
            }

            // Calculate MD5 hash of this row to check if already synced
            $rowHash = md5(json_encode($rowData));
            
            // O(1) Memory check instead of DB query
            if (isset($hashMap[$rowHash])) {
                continue; // Row is EXACTLY same as before, skip completely!
            }

            if ($isSilentSync) {
                // Lần đầu tiên chạy với tùy chọn "Chỉ quét Data mới": 
                // Chỉ đánh dấu hash để các lần sau bỏ qua dòng này, tuyệt đối không chia số.
                $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                $recordStmt->execute();
                $hashMap[$rowHash] = true;
                continue; // Chuyển sang dòng tiếp theo
            }

            // Extract fields based on mapping — BUG-13/14 fix: normalizePhone now canonical
            $phone = normalizePhone(extractMappedValues($mappings, 'phone', $rowData));
            $email = extractMappedValues($mappings, 'email', $rowData);
            $source = extractMappedValues($mappings, 'source', $rowData);
            $type = extractMappedValues($mappings, 'type', $rowData);
            $note = extractMappedValues($mappings, 'note', $rowData);
            $name = extractMappedValues($mappings, 'name', $rowData);

            if (!empty($connItem['require_both_contact'])) {
                if (empty($phone) || empty($email)) {
                    continue; // Must have BOTH phone and email
                }
            } else {
                if (empty($phone) && empty($email)) {
                    continue; // Must have at least one
                }
            }

            // Check Blocked Leads
            if (isLeadBlocked($conn, $phone, $email)) {
                logSync("Row rejected: Lead is blocked (phone: $phone, email: $email)");
                $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                $recordStmt->execute();
                $hashMap[$rowHash] = true;
                continue;
            }

            // --- 0. Check Global Blacklist / Exclusions ---
            if (checkGlobalExclusion($conn, $rowData, $phone, $email, true, $name, $source, $type, $note)) {
                // Record hash so we don't process this blacklisted row again
                $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                $recordStmt->execute();
                $hashMap[$rowHash] = true;
                continue;
            }

            // --- 0.5. Advisory Lock to prevent simultaneous processing of the same lead ---
            // Normalize lock key to target normalized phone (if set) or email (if set) individually
            $lockKey = '';
            if (!empty($phone)) {
                $lockKey = 'webhook_lead_phone_' . $phone;
            } else if (!empty($email)) {
                $lockKey = 'webhook_lead_email_' . md5($email);
            } else {
                $lockKey = 'webhook_lead_empty_' . md5(json_encode($rowData));
            }

            $lockRes = null;
            if ($lockStmt) {
                $lockStmt->bind_param("s", $lockKey);
                $lockStmt->execute();
                $lockRes = $lockStmt->get_result()->fetch_assoc();
            }
            if (!$lockRes || $lockRes['get_lock'] != 1) {
                logSync("Skip row $rowCount: Lock busy for $phone / $email.");
                continue;
            }

            try {
                // --- 1. Evaluate Dynamic Rules to determine Target Round & Apply Injects ---
                $rowDataForRules = $rowData;
                $rowDataForRules['phone'] = $phone;
                $rowDataForRules['email'] = $email;
                $rowDataForRules['name'] = $name;
                $rowDataForRules['note'] = $note;
                $rowDataForRules['source'] = $source;
                $rowDataForRules['type'] = $type;

                $ruleResult = evaluateRules($conn, $rowDataForRules, $source, $type, $connItem['id'], 'sheets');
                $targetRoundId = null;
                $inject = [];
                $cronStatus = 'unassigned';
                $cronMessage = 'No matching rule found via cron_sync.';
                $isFallbackAdmin = false;
                $fallbackAdminData = null;
                $fallbackCcEmails = '';

                if (is_array($ruleResult)) {
                    $targetRoundId = $ruleResult['target_round_id'];
                    $inject = $ruleResult['inject'] ?? [];
                    
                    // Áp dụng ghi đè dữ liệu (Inject Fields)
                    $standardFields = ['source', 'type', 'note', 'name', 'phone', 'email'];
                    foreach ($inject as $k => $v) {
                        if (in_array($k, $standardFields)) {
                            if ($k === 'source') $source = $v;
                            if ($k === 'type') $type = $v;
                            if ($k === 'note') $note = $v;
                            if ($k === 'name') $name = $v;
                            if ($k === 'phone') $phone = normalizePhone($v);
                            if ($k === 'email') $email = trim($v);
                        } else {
                            // Append custom fields to note
                            $note .= "\n[$k]: $v";
                        }
                    }
                } else {
                    $targetRoundId = $ruleResult;
                }

                $inactiveRoundName = '';
                if ($targetRoundId) {
                    $chkRes = $roundsCache[(int)$targetRoundId] ?? null;
                    if (!$chkRes || (int)$chkRes['is_active'] !== 1) {
                        $inactiveRoundName = $chkRes['round_name'] ?? ('ID ' . $targetRoundId);
                        $targetRoundId = null;
                    }
                }

                if (!$targetRoundId) {
                    $fbSettings = get_system_setting($conn);
                    
                    $fbType = $fbSettings['fallback_type'] ?? 'round';
                    $fbCc = $fbSettings['fallback_cc_email'] ?? '';
                    
                    if ($fbType === 'admin') {
                        $fbAdminId = (int)($fbSettings['fallback_admin_id'] ?? 0);
                        if ($fbAdminId > 0) {
                            static $fallbackAdminCache = [];
                            if (!isset($fallbackAdminCache[$fbAdminId])) {
                                $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND (role = 'admin' OR role = 'superadmin') LIMIT 1");
                                $admStmt->bind_param("i", $fbAdminId);
                                $admStmt->execute();
                                $admRes = $admStmt->get_result();
                                $fallbackAdminCache[$fbAdminId] = ($admRes->num_rows > 0) ? $admRes->fetch_assoc() : null;
                                $admStmt->close();
                            }
                            
                            $fallbackAdminData = $fallbackAdminCache[$fbAdminId];
                            if ($fallbackAdminData) {
                                $isFallbackAdmin = true;
                                $cronStatus = 'fallback';
                                $cronMessage = !empty($inactiveRoundName)
                                    ? "Vòng matched ($inactiveRoundName) tạm dừng. Chuyển hướng sang Admin dự phòng: " . $fallbackAdminData['name']
                                    : 'No matching rule. Routed directly to fallback Admin via cron_sync: ' . $fallbackAdminData['name'];
                                $fallbackCcEmails = $fbCc;
                            }
                        }
                    } else {
                        $fbRoundId = (int)($fbSettings['fallback_round_id'] ?? 0);
                        if ($fbRoundId > 0) {
                            $chkFbRes = $roundsCache[$fbRoundId] ?? null;
                            if ($chkFbRes && (int)$chkFbRes['is_active'] === 1) {
                                $targetRoundId = $fbRoundId;
                                $isFallbackRound = true;
                                $cronMessage = !empty($inactiveRoundName)
                                    ? "Vòng matched ($inactiveRoundName) tạm dừng. Chuyển hướng sang vòng dự phòng."
                                    : 'No matching rule found. Routed to fallback round.';
                            } else {
                                $targetRoundId = null;
                            }
                        }
                    }
                }

                // Fetch round details (cc_emails, round_name)
                $ccEmails = '';
                $roundName = '';
                if ($targetRoundId) {
                    $rRes = $roundsCache[(int)$targetRoundId] ?? null;
                    if ($rRes) {
                        $ccEmails = $rRes['cc_emails'] ?? '';
                        $roundName = $rRes['round_name'] ?? '';
                    }
                } else if ($isFallbackAdmin && !empty($fallbackCcEmails)) {
                    $ccEmails = $fallbackCcEmails;
                }

                // --- 2. Check CRM (Duplication & dynamic threshold rule) ---
                $crmCheckResult = checkCRMInteraction($conn, $phone, $email);

                // Load dynamic duplicate check threshold from system settings cache
                $fbSettings = get_system_setting($conn);
                $dupCheckMonths = (int)($fbSettings['duplicate_check_months'] ?? 6);
                if ($dupCheckMonths <= 0) {
                    $dupCheckMonths = 6;
                }

                if (!empty($connItem['is_silent'])) {
                    $assignedToId = null;
                    if (!empty($connItem['sync_saleperson'])) {
                        $assignedToVal = extractMappedValues($mappings, 'saleperson', $rowData);
                        if (empty($assignedToVal)) {
                            $assignedToVal = extractMappedValues($mappings, 'assigned_to', $rowData);
                        }
                        if (!empty($assignedToVal)) {
                            $assignedToId = findConsultantByEmailOrName($conn, $assignedToVal);
                        }
                    }
                    
                    $conn->begin_transaction();
                    try {
                        if ($crmCheckResult['leadExists']) {
                            $ownerId = !empty($crmCheckResult['assignedTo']) ? $crmCheckResult['assignedTo'] : $assignedToId;
                            $leadId = updateLead($conn, $phone, $email, $ownerId, $source, $type, $note, $connItem['id'], null, $name, false, true);
                        } else {
                            $leadId = insertLead($conn, $rowData, $assignedToId, $phone, $email, $name, $source, $type, $note, $connItem['id'], null, true);
                        }
                        $actualOwnerId = ($crmCheckResult['isDuplicate'] && !empty($crmCheckResult['assignedTo'])) ? $crmCheckResult['assignedTo'] : $assignedToId;
                        logDistribution($conn, $leadId, $actualOwnerId, null, 'silent', 'Chỉ đồng bộ check trùng, không định tuyến.', false);
                        
                        $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                        $recordStmt->execute();
                        $hashMap[$rowHash] = true;
                        
                        $conn->commit();
                        
                        // Post-commit: trigger live write-back
                        triggerTwoWaySync($conn, $leadId);
                    } catch (Exception $txE) {
                        $conn->rollback();
                        logSync("Transaction failed for silent row: " . $txE->getMessage());
                        continue;
                    }

                    // If duplicate, check if we need to send duplicate reminder
                    if ($crmCheckResult['isDuplicate'] && !empty($connItem['sync_saleperson'])) {
                        $ownerId = $crmCheckResult['assignedTo'];
                        if (!empty($ownerId) && (empty($assignedToId) || (int)$ownerId === (int)$assignedToId)) {
                            static $consultantCache = [];
                            if (!isset($consultantCache[$ownerId])) {
                                $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
                                $stmtC->bind_param("i", $ownerId);
                                $stmtC->execute();
                                $consultantCache[$ownerId] = $stmtC->get_result()->fetch_assoc();
                                $stmtC->close();
                            }
                            $cRow = $consultantCache[$ownerId];
                            
                            if ($cRow && ($cRow['status'] === 'active' || $cRow['status'] === 'leave')) {
                                $timeline = getLeadHistoryTimeline($conn, $leadId, true);
                                try {
                                    sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline, $leadId);
                                } catch (Exception $mailEx) {
                                    logSync("Error sending silent sync email: " . $mailEx->getMessage());
                                }
                                try {
                                    sendLeadReminderZaloMessageToSale($ownerId, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline, $leadId, $email, $type);
                                } catch (Exception $zaloEx) {
                                    logSync("Error sending silent sync Zalo: " . $zaloEx->getMessage());
                                }
                            }
                        }
                    }
                    
                    continue;
                }

                if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
                    // Duplicate < threshold months, skip assigning to new round but update last interaction
                    $assignedTo = $crmCheckResult['assignedTo'];
                    
                    $conn->begin_transaction();
                    try {
                        $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note, $connItem['id'], null, $name);
                        logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng (đồng bộ hệ thống).', false);
                        
                        // Record hash so we don't spam duplicate logs on next run
                        $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                        $recordStmt->execute();
                        $hashMap[$rowHash] = true;
                        
                        $conn->commit();
                        
                        // Post-commit: trigger live write-back
                        triggerTwoWaySync($conn, $leadId);
                    } catch (Exception $txE) {
                        $conn->rollback();
                        logSync("Transaction failed for duplicate row: " . $txE->getMessage());
                        continue;
                    }
                    
                    static $consultantCache = [];
                    if (!isset($consultantCache[$assignedTo])) {
                        $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
                        $stmtC->bind_param("i", $assignedTo);
                        $stmtC->execute();
                        $consultantCache[$assignedTo] = $stmtC->get_result()->fetch_assoc();
                        $stmtC->close();
                    }
                    $cRow = $consultantCache[$assignedTo];
                    
                    if ($cRow && ($cRow['status'] === 'active' || $cRow['status'] === 'leave')) {
                        $timeline = getLeadHistoryTimeline($conn, $leadId, true);
                        try {
                            sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline, $leadId);
                        } catch (Exception $mailEx) {
                            logSync("Error sending duplicate reminder email: " . $mailEx->getMessage());
                        }
                        try {
                            sendLeadReminderZaloMessageToSale($assignedTo, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline, $leadId, $email, $type);
                        } catch (Exception $zaloEx) {
                            logSync("Error sending duplicate reminder Zalo: " . $zaloEx->getMessage());
                        }
                    }
                    
                    continue;
                }

                // --- 2.2. If existing lead is currently held in pending_approval, keep it held and skip assignment/AI ---
                if ($crmCheckResult['leadExists'] && $crmCheckResult['leadStatus'] === 'pending_approval') {
                    $conn->begin_transaction();
                    try {
                        $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, $connItem['id'], null, $name);
                        
                        $updStmt = $conn->prepare("UPDATE leads SET status = 'pending_approval', assigned_to = NULL WHERE id = ?");
                        if ($updStmt) {
                            $updStmt->bind_param("i", $leadId);
                            $updStmt->execute();
                            $updStmt->close();
                        }
                        
                        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', 'Dữ liệu trùng lặp đang chờ AI/Admin phê duyệt (đồng bộ hệ thống).', false);
                        
                        // Record hash so we don't process this row again on next cron run
                        $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                        $recordStmt->execute();
                        $hashMap[$rowHash] = true;
                        
                        $conn->commit();
                        triggerTwoWaySync($conn, $leadId);
                    } catch (Exception $txE) {
                        $conn->rollback();
                        logSync("Transaction failed for duplicate pending_approval row: " . $txE->getMessage());
                    }
                    continue;
                }

                // --- 2.5. AI Screener & Gatekeeper evaluation (Only if new lead / duplicate older than N months) ---
                $screenerData = [
                    'phone' => $phone,
                    'email' => $email,
                    'name' => $name,
                    'source' => $source,
                    'type' => $type,
                    'note' => $note
                ];
                $aiScreenerResult = evaluateScreener($conn, $targetRoundId, $screenerData);

                $isSubstandardAutoApprove = false;
                if ($aiScreenerResult && $aiScreenerResult['status'] === 'failed') {
                    $bsFallbackEnabled = (int) ($aiScreenerResult['below_standard_fallback_enabled'] ?? 0);
                    $bsAutoApprove = (int) ($aiScreenerResult['below_standard_auto_approve'] ?? 0);
                    $bsFallbackRoundId = (int) ($aiScreenerResult['below_standard_fallback_round_id'] ?? 0);

                    if ($bsFallbackEnabled === 1 && $bsAutoApprove === 1 && $bsFallbackRoundId > 0) {
                        $targetRoundId = $bsFallbackRoundId;
                        $isSubstandardAutoApprove = true;
                    }
                }

                if ($aiScreenerResult && $aiScreenerResult['status'] === 'pending') {
                    $conn->begin_transaction();
                    try {
                        if ($crmCheckResult['leadExists']) {
                            $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, $connItem['id'], null, $name);
                        } else {
                            $leadId = insertLead($conn, $rowData, null, $phone, $email, $name, $source, $type, $note, $connItem['id']);
                        }
                        
                        if ($updHeldPending) {
                            $updHeldPending->bind_param("ii", $targetRoundId, $leadId);
                            $updHeldPending->execute();
                        }
                        
                        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', 'Đang chờ AI đánh giá (Chạy ngầm - đồng bộ hệ thống)', false);
                        
                        // Record hash so we don't process this row again on next cron run
                        $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                        $recordStmt->execute();
                        $hashMap[$rowHash] = true;
                        
                        $conn->commit();
                        
                        // Post-commit: trigger live write-back
                        triggerTwoWaySync($conn, $leadId);
                    } catch (Exception $txE) {
                        $conn->rollback();
                        logSync("Transaction failed for queued AI row: " . $txE->getMessage());
                        continue;
                    }
                    
                    continue;
                }

                if ($aiScreenerResult && ($aiScreenerResult['status'] === 'failed' || $aiScreenerResult['status'] === 'error') && !$isSubstandardAutoApprove) {
                    $conn->begin_transaction();
                    try {
                        if ($crmCheckResult['leadExists']) {
                            $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, $connItem['id'], null, $name);
                        } else {
                            $leadId = insertLead($conn, $rowData, null, $phone, $email, $name, $source, $type, $note, $connItem['id']);
                        }
                        
                        if ($updHeldFailed) {
                            $updHeldFailed->bind_param("issi", $targetRoundId, $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
                            $updHeldFailed->execute();
                        }
                        
                        $logMsg = $aiScreenerResult['status'] === 'error' ? "Lỗi kết nối AI (đồng bộ hệ thống): " . $aiScreenerResult['reason'] : "Tạm giữ bởi AI (đồng bộ hệ thống): " . $aiScreenerResult['reason'];
                        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', $logMsg, false);
                        
                        // Record hash so we don't process this row again on next cron run
                        $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                        $recordStmt->execute();
                        $hashMap[$rowHash] = true;
                        
                        $conn->commit();
                        
                        // Post-commit: trigger live write-back
                        triggerTwoWaySync($conn, $leadId);
                    } catch (Exception $txE) {
                        $conn->rollback();
                        logSync("Transaction failed for held row: " . $txE->getMessage());
                        continue;
                    }
                    
                    // Background notifications to admins (outside transaction)
                    try {
                        sendHeldLeadNotifications($conn, $leadId, $name, $phone, $aiScreenerResult['reason'], $roundName, $email, $source, $type, $note);
                    } catch (Exception $notifyEx) {
                        logSync("Error during cron sync AI screener notifications: " . $notifyEx->getMessage());
                    }
                    
                    continue;
                }

                // --- 3. Round-Robin Assignment & 4. Process Lead (Unified Transaction) ---
                $conn->begin_transaction();
                try {
                    $dupSuffix = '';
                    if ($crmCheckResult['isDuplicate']) {
                        $oldSaleName = !empty($crmCheckResult['assignedName']) ? $crmCheckResult['assignedName'] : 'Không rõ';
                        $oldSaleMonths = $crmCheckResult['monthsSinceLastInteraction'];
                        $dupSuffix = " (Trùng số: Sale cũ $oldSaleName > $oldSaleMonths tháng).";
                    }

                    if ($targetRoundId) {
                        $assignResult = getNextConsultantInRound($conn, $targetRoundId);
                        if ($assignResult) {
                            $assignedConsultantId = $assignResult['id'];
                            $cronStatus = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                            $cronMessage = $assignResult['is_compensation'] 
                                ? (isset($assignResult['is_starvation']) ? 'Được phân bổ bù lượt ngoài giờ/nghỉ phép (Starvation Prevention) (đồng bộ hệ thống).' : 'Được phân bổ đền bù lượt lỗi (đồng bộ hệ thống).') 
                                : 'Được phân bổ tự động qua vòng xoay (đồng bộ hệ thống).';
                            $cronMessage .= $dupSuffix;

                            // Check working hours
                            if ($whStmt) {
                                $whStmt->bind_param("i", $assignedConsultantId);
                                $whStmt->execute();
                                $whRes = $whStmt->get_result();
                                if ($whRes && $whRow = $whRes->fetch_assoc()) {
                                    $whStart = $whRow['work_start_time'] ?? '00:00';
                                    $whEnd = $whRow['work_end_time'] ?? '23:59';
                                    $workSchedule = $whRow['work_schedule'] ?? null;
                                    $currentTime = date('H:i');
                                    if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                                        $cronStatus = 'pending_work_hours';
                                        $cronMessage .= ' (Trì hoãn: ngoài khung giờ làm việc)';
                                    }
                                }
                            }
                        } else {
                            $assignedConsultantId = null;
                            $cronStatus = (isset($isFallbackRound) && $isFallbackRound) ? 'fallback' : 'pending';
                            $cronMessage = ((isset($isFallbackRound) && $isFallbackRound) ? 'No active consultants in fallback round.' : 'No active consultants in this round via cron_sync.') . $dupSuffix;
                        }
                    } else {
                        $cronStatus = 'unassigned';
                        $cronMessage = 'Không khớp vòng phân bổ hoặc vòng không hoạt động.' . $dupSuffix;
                    }

                    if ($crmCheckResult['leadExists']) {
                        if (!empty($crmCheckResult['originalAssignedTo'])) {
                            $prevName = $crmCheckResult['assignedName'] ?? 'Sale cũ';
                            $prevDate = !empty($crmCheckResult['lastInteractionDate']) ? date('d/m/Y', strtotime($crmCheckResult['lastInteractionDate'])) : 'Không rõ';
                            $dupMonths = $crmCheckResult['monthsSinceLastInteraction'] ?? $dupCheckMonths;
                            $noteAppend = "\n[Lưu ý: Trùng số của $prevName trên $dupMonths tháng. Cập nhật lần cuối: $prevDate]";
                            $note = trim($note) === '' ? trim($noteAppend, "\n") : $note . $noteAppend;
                        }
                        $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connItem['id'], null, $name);
                    } else {
                        $leadId = insertLead($conn, $rowData, $assignedConsultantId, $phone, $email, $name, $source, $type, $note, $connItem['id']);
                    }

                    if ($leadId && !empty($mappings)) {
                        saveMappedExtendedFields($conn, $leadId, $rowData, $mappings);
                    }
                    
                    // Save AI screening result if evaluated
                    if ($aiScreenerResult) {
                        if ($updAi) {
                            $updAi->bind_param("ssi", $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
                            $updAi->execute();
                        }
                    }

                    logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, $cronStatus, $cronMessage, false);
                    
                    // Record hash so we don't process this row again on next cron run
                    $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                    $recordStmt->execute();
                    $hashMap[$rowHash] = true;
                    
                    $conn->commit();
                    
                    // Post-commit: trigger live write-back
                    triggerTwoWaySync($conn, $leadId);
                } catch (Exception $txE) {
                    $conn->rollback();
                    logSync("Transaction failed for row: " . $txE->getMessage());
                    continue;
                }

                // Notifications
                if ($isFallbackAdmin && $fallbackAdminData && !empty($leadId)) {
                    try {
                        sendLeadAssignedEmailToSale(
                            $fallbackAdminData['email'], 
                            $fallbackAdminData['name'], 
                            $name, 
                            $phone, 
                            $note, 
                            $source, 
                            $fallbackCcEmails, 
                            'Fallback Admin', 
                            $leadId, 
                            0, 
                            0
                        );
                    } catch (Exception $mailEx) {
                        logSync("Error sending fallback admin email: " . $mailEx->getMessage());
                    }
                    if (!empty($fallbackAdminData['zalo_chat_id'])) {
                        require_once __DIR__ . '/zalo_bot.php';
                        try {
                            sendLeadAssignedZaloMessageToAdmin(
                                $fallbackAdminData['zalo_chat_id'], 
                                $fallbackAdminData['name'], 
                                $name, 
                                $phone, 
                                $note, 
                                $source,
                                $leadId,
                                $email,
                                $type
                            );
                        } catch (Exception $zaloEx) {
                            logSync("Error sending fallback admin Zalo: " . $zaloEx->getMessage());
                        }
                    }
                    $syncedCount++;
                } else if (($cronStatus === 'assigned' || $cronStatus === 'compensation') && !empty($leadId) && $assignedConsultantId) {
                    // Notify Sale (mailer.php already loaded above)
                    static $assignedConsultantCache = [];
                    if (!isset($assignedConsultantCache[$assignedConsultantId])) {
                        $stmtC2 = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ?");
                        $stmtC2->bind_param("i", $assignedConsultantId);
                        $stmtC2->execute();
                        $assignedConsultantCache[$assignedConsultantId] = $stmtC2->get_result()->fetch_assoc();
                        $stmtC2->close();
                    }
                    $c = $assignedConsultantCache[$assignedConsultantId];
                    
                    if ($c) {
                        // Gửi Email
                        try {
                            sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $leadId ?? 0, $assignedConsultantId ?? 0, $targetRoundId ?? 0);
                        } catch (Exception $mailEx) {
                            logSync("Error sending assigned sale email: " . $mailEx->getMessage());
                        }
                        
                        // Gửi Zalo Message (Đồng bộ Đa Kênh)
                        try {
                            sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $name, $phone, $note, $source, $roundName, $leadId ?? 0, $targetRoundId ?? 0, $email, $type);
                        } catch (Exception $zaloEx) {
                            logSync("Error sending assigned sale Zalo: " . $zaloEx->getMessage());
                        }
                    }
                    $syncedCount++;
                }
            } finally {
                if ($relStmt) {
                    $relStmt->bind_param("s", $lockKey);
                    $relStmt->execute();
                    $relRes = $relStmt->get_result();
                    if ($relRes) $relRes->close();
                }
            }
        }
        fclose($stream);
        if (isset($recordStmt)) $recordStmt->close();
        if (isset($lockStmt)) $lockStmt->close();
        if (isset($relStmt)) $relStmt->close();
        if (isset($updHeldPending)) $updHeldPending->close();
        if (isset($updHeldFailed)) $updHeldFailed->close();
        if (isset($whStmt)) $whStmt->close();
        if (isset($updAi)) $updAi->close();

        if ($isSilentSync || !empty($connItem['is_silent'])) {
            $conn->query("UPDATE sheet_connections SET is_initialized = 1 WHERE id = " . $connItem['id']);
            logSync("Sync initialized for Connection ID {$connItem['id']} (isSilentSync: " . ($isSilentSync ? 'yes' : 'no') . ", is_silent: " . (!empty($connItem['is_silent']) ? 'yes' : 'no') . ").");
        }

        logSync("Finished Connection ID {$connItem['id']}. Synced $syncedCount new leads.");

        // Reset status
        $upStmt = $conn->prepare("UPDATE sheet_connections SET last_sync_at = NOW(), sync_status = 'idle', last_error = NULL, sync_error_count = 0 WHERE id = ?");
        $upStmt->bind_param("i", $connItem['id']);
        $upStmt->execute();
        $upStmt->close();

    } catch (Exception $e) {
        $errorMessage = $e->getMessage();
        logSync("Error processing ID {$connItem['id']}: " . $errorMessage);
        
        // Retrieve current sync_error_count
        $currErrCount = 0;
        $cntStmt = $conn->prepare("SELECT sync_error_count FROM sheet_connections WHERE id = ?");
        if ($cntStmt) {
            $cntStmt->bind_param("i", $connItem['id']);
            $cntStmt->execute();
            $cntRes = $cntStmt->get_result()->fetch_assoc();
            $currErrCount = (int)($cntRes['sync_error_count'] ?? 0);
            $cntStmt->close();
        }
        
        $newErrCount = $currErrCount + 1;
        
        if ($newErrCount < 3) {
            // Keep sync_status as idle (retries on next cron run), save error details and count
            $upStmt = $conn->prepare("UPDATE sheet_connections SET sync_status = 'idle', last_error = ?, sync_error_count = ? WHERE id = ?");
            $upStmt->bind_param("sii", $errorMessage, $newErrCount, $connItem['id']);
            $upStmt->execute();
            $upStmt->close();
            logSync("Self-healing: connection ID {$connItem['id']} failed $newErrCount times. Retrying next run. Error: " . $errorMessage);
        } else {
            // Set status to error and alert admins
            $upStmt = $conn->prepare("UPDATE sheet_connections SET sync_status = 'error', last_error = ?, sync_error_count = ? WHERE id = ?");
            $upStmt->bind_param("sii", $errorMessage, $newErrCount, $connItem['id']);
            $upStmt->execute();
            $upStmt->close();
            
            logSync("Connection ID {$connItem['id']} failed $newErrCount times. Setting status to error and notifying admins.");
            
            $alertErrorMessage = $errorMessage . " (Thử lại thất bại " . $newErrCount . " lần)";
            sendSheetSyncErrorAlert($conn, $connItem, $alertErrorMessage);
        }
    }
}

function releaseExpiredLeadsToKho($conn) {
    logSync("Running releaseExpiredLeadsToKho...");

    $applicableSourcesStr = get_system_setting($conn, 'databank_applicable_sources') ?: 'R3_Fb,R3,R2,broadcast';
    $applicableSources = array_map('trim', explode(',', $applicableSourcesStr));
    $applicableSourcesEscaped = array_map(function($s) use ($conn) {
        return "'" . $conn->real_escape_string($s) . "'";
    }, $applicableSources);
    $sourcesFilter = "AND (c.source IN (" . implode(',', $applicableSourcesEscaped) . ") OR c.source = 'databank')";
    
    $sql = "SELECT c.id AS contact_id, c.person_id, c.owner_id, c.tenant_id
            FROM contacts c
            WHERE c.security_expires_at <= NOW()
              AND c.security_expires_at IS NOT NULL
              AND c.deleted_at IS NULL
              AND c.pipeline_status NOT IN ('dat_coc', 'da_coc', 'dong_deal', 'thanh_cong')
              $sourcesFilter
              AND NOT EXISTS (
                  SELECT 1 FROM cooperation_slips cs
                  WHERE cs.contact_id = c.id
                    AND cs.status IN ('pending_signatures', 'approved_pending_signatures', 'pending_manager_approval', 'approved')
              )";
              
    $res = $conn->query($sql);
    if (!$res) return;

    while ($row = $res->fetch_assoc()) {
        $contactId = (int)$row['contact_id'];
        $personId = (int)$row['person_id'];
        $ownerId = (int)$row['owner_id'];
        $tenantId = (int)$row['tenant_id'];

        $conn->begin_transaction();
        try {
            // 1. Soft-delete the individual expired contact row
            $stmtDel = $conn->prepare("UPDATE contacts SET deleted_at = NOW(), notes = NULL WHERE id = ?");
            $stmtDel->bind_param("i", $contactId);
            $stmtDel->execute();
            $stmtDel->close();

            logSync("Soft-deleted expired contact ID $contactId (Person ID $personId) for Owner ID $ownerId");

            // Send in-app notification & email about contact expiry/revocation
            $stmtOwner = $conn->prepare("SELECT email, full_name FROM users WHERE id = ?");
            $stmtOwner->bind_param("i", $ownerId);
            $stmtOwner->execute();
            $ownerRow = $stmtOwner->get_result()->fetch_assoc();
            $stmtOwner->close();

            $clientName = trim($row['first_name'] . ' ' . $row['last_name']) ?: 'Khách hàng ẩn danh';
            $notifTitle = "Thu hồi khách hàng do hết hạn bảo mật";
            $notifBody = "Khách hàng $clientName đã bị thu hồi khỏi danh sách của bạn do hết hạn bảo mật.";
            
            $stmtNotif = $conn->prepare("
                INSERT INTO notifications (user_id, tenant_id, title, body, type, link) 
                VALUES (?, ?, ?, ?, 'contact_expired', '/contacts')
            ");
            $stmtNotif->bind_param("iiss", $ownerId, $tenantId, $notifTitle, $notifBody);
            $stmtNotif->execute();
            $stmtNotif->close();

            if ($ownerRow && !empty($ownerRow['email'])) {
                require_once __DIR__ . '/mailer.php';
                $emailSubject = "[RICH LAND] Thông báo thu hồi khách hàng: " . $clientName;
                $emailTitle = "THU HỒI KHÁCH HÀNG HẾT HẠN BẢO MẬT";
                $emailContent = "Chào <strong>" . htmlspecialchars($ownerRow['full_name']) . "</strong>,<br/><br/>" .
                                "Khách hàng <strong>" . htmlspecialchars($clientName) . "</strong> đã bị thu hồi khỏi danh sách chăm sóc của bạn do hết hạn bảo mật tương tác mà không phát sinh cập nhật mới.<br/>" .
                                "Vui lòng liên hệ Admin nếu có bất kỳ thắc mắc nào.";
                sendEmailNotification($ownerRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
            }

            // 2. Check if there are any other active contacts left for this Person
            $stmtActive = $conn->prepare("SELECT COUNT(*) as active_cnt FROM contacts WHERE person_id = ? AND deleted_at IS NULL");
            $stmtActive->bind_param("i", $personId);
            $stmtActive->execute();
            $activeCnt = (int)($stmtActive->get_result()->fetch_assoc()['active_cnt'] ?? 0);
            $stmtActive->close();

            // Check if any remaining active claims are in 'dat_coc'
            $hasProtectedStatus = false;
            if ($activeCnt > 0) {
                $stmtProtected = $conn->prepare("SELECT COUNT(*) FROM contacts WHERE person_id = ? AND deleted_at IS NULL AND pipeline_status = 'dat_coc'");
                $stmtProtected->bind_param("i", $personId);
                $stmtProtected->execute();
                $pRow = $stmtProtected->get_result()->fetch_row();
                $hasProtectedStatus = $pRow && ((int)$pRow[0] > 0);
                $stmtProtected->close();
            }

            $maxParallelClaims = 2;
            $stmtSetting = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'max_parallel_sales_per_client' LIMIT 1");
            if ($stmtSetting) {
                $stmtSetting->execute();
                $sRes = $stmtSetting->get_result()->fetch_row();
                if ($sRes) {
                    $maxParallelClaims = (int)$sRes[0];
                }
                $stmtSetting->close();
            }

            if ($activeCnt < $maxParallelClaims && !$hasProtectedStatus) {
                if ($activeCnt === 0) {
                    // No active contacts left for this person. Release to Databank!
                    
                    // Rule 5.13: Same-reason reject lockout check
                    $lockoutCount = (int) get_system_setting($conn, 'lockout_reason_count_threshold') ?: 3;
                    $checkReasonStmt = $conn->prepare("
                        SELECT dr.reason, COUNT(*) as cnt 
                        FROM data_reports dr
                        JOIN leads l ON dr.lead_id = l.id
                        WHERE l.person_id = ?
                          AND dr.status IN ('approved', 'approved_no_comp')
                        GROUP BY dr.reason
                        HAVING cnt >= ?
                        LIMIT 1
                    ");
                    $checkReasonStmt->bind_param("ii", $personId, $lockoutCount);
                    $checkReasonStmt->execute();
                    $hasThreeSameReason = $checkReasonStmt->get_result()->fetch_assoc();
                    $checkReasonStmt->close();

                    if ($hasThreeSameReason) {
                        logSync("Person ID $personId bi bao loi trung " . $lockoutCount . " lan cung 1 ly do (" . $hasThreeSameReason['reason'] . "). Tu choi ra Kho.");
                        $conn->commit();
                        continue;
                    }

                    // Check for active cooperation slips across all contacts of this person
                    $checkCoopStmt = $conn->prepare("
                        SELECT id FROM cooperation_slips 
                        WHERE contact_id IN (SELECT id FROM contacts WHERE person_id = ?) 
                          AND status != 'rejected' LIMIT 1
                    ");
                    $checkCoopStmt->bind_param("i", $personId);
                    $checkCoopStmt->execute();
                    $coopRow = $checkCoopStmt->get_result()->fetch_assoc();
                    $checkCoopStmt->close();

                    if ($coopRow) {
                        logSync("Person ID $personId co phieu hop tac hoa hong active. Tu choi tu dong ra Kho.");
                        $conn->commit();
                        continue;
                    }

                    // Update person is_public = 1
                    $stmtPerson = $conn->prepare("SELECT public_count FROM persons WHERE id = ? FOR UPDATE");
                    $stmtPerson->bind_param("i", $personId);
                    $stmtPerson->execute();
                    $personData = $stmtPerson->get_result()->fetch_assoc();
                    $stmtPerson->close();

                    $publicCount = (int)($personData['public_count'] ?? 0);
                    if ($publicCount === 0) {
                        $newPublicCount = 1;
                        $upd = $conn->prepare("UPDATE persons SET is_public = 1, released_to_kho_at = NOW(), public_count = ?, deleted_from_databank = 0 WHERE id = ?");
                        $upd->bind_param("ii", $newPublicCount, $personId);
                        $upd->execute();
                        $upd->close();
                    } else {
                        $upd = $conn->prepare("UPDATE persons SET is_public = 1, released_to_kho_at = NOW(), deleted_from_databank = 0 WHERE id = ?");
                        $upd->bind_param("i", $personId);
                        $upd->execute();
                        $upd->close();
                    }
                } else {
                    // Slots available but some sales are still working, just set is_public = 1
                    $upd = $conn->prepare("UPDATE persons SET is_public = 1, released_to_kho_at = NOW(), deleted_from_databank = 0 WHERE id = ?");
                    $upd->bind_param("i", $personId);
                    $upd->execute();
                    $upd->close();
                }

                // Delete notes records for all contacts of this person
                $stmtDelNotes = $conn->prepare("
                    DELETE FROM notes 
                    WHERE entity_type = 'contact' 
                      AND entity_id IN (SELECT id FROM contacts WHERE person_id = ?)
                ");
                $stmtDelNotes->bind_param("i", $personId);
                $stmtDelNotes->execute();
                $stmtDelNotes->close();

                // Delete activities records for all contacts of this person
                $stmtDelActs = $conn->prepare("
                    DELETE FROM activities 
                    WHERE related_type = 'contact' 
                      AND related_id IN (SELECT id FROM contacts WHERE person_id = ?)
                ");
                $stmtDelActs->bind_param("i", $personId);
                $stmtDelActs->execute();
                $stmtDelActs->close();

                // Clear notes for all contacts of this person (just in case)
                $updAllNotes = $conn->prepare("UPDATE contacts SET notes = NULL WHERE person_id = ?");
                $updAllNotes->bind_param("i", $personId);
                $updAllNotes->execute();
                $updAllNotes->close();

                // Clear assignment on leads table
                $updLeads = $conn->prepare("UPDATE leads SET assigned_to = NULL, last_assigned_at = NULL WHERE person_id = ?");
                $updLeads->bind_param("i", $personId);
                $updLeads->execute();
                $updLeads->close();
                
                $stmtL = $conn->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
                $stmtL->bind_param("i", $personId);
                $stmtL->execute();
                $lRow = $stmtL->get_result()->fetch_assoc();
                $stmtL->close();
                $leadId = $lRow ? (int)$lRow['id'] : null;
                
                if ($leadId !== null && $leadId > 0) {
                    logDistribution($conn, $leadId, null, null, 'released_to_kho', 'Hết hạn bảo mật, tự động đưa ra Kho chung', false);
                }
                logSync("Released Person ID $personId to Kho chung.");
            }

            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            logSync("Error releasing/deleting contact ID $contactId: " . $e->getMessage());
        }
    }
}

function assignParallelLeads($conn) {
    logSync("Running assignParallelLeads...");
    
    $applicableSourcesStr = get_system_setting($conn, 'databank_applicable_sources') ?: 'R3_Fb,R3,R2,broadcast';
    $applicableSources = array_map('trim', explode(',', $applicableSourcesStr));
    $applicableSourcesEscaped = array_map(function($s) use ($conn) {
        return "'" . $conn->real_escape_string($s) . "'";
    }, $applicableSources);
    $sourcesFilter = "AND c.source IN (" . implode(',', $applicableSourcesEscaped) . ")";

    $sql = "SELECT c.id as contact_id, c.person_id, c.owner_id, c.project_id, c.email, c.phone, c.first_name, c.last_name, c.source, c.notes, c.customer_type, c.tenant_id,
                   (SELECT round_id FROM distribution_logs WHERE lead_id = c.id AND status = 'assigned' ORDER BY id DESC LIMIT 1) as original_round_id
            FROM contacts c
            JOIN persons p ON c.person_id = p.id
            WHERE c.pipeline_status = 'chua_xac_dinh'
              AND (c.parallel_assigned IS NULL OR c.parallel_assigned = 0)
              AND c.security_expires_at <= NOW()
              AND c.security_expires_at IS NOT NULL
              AND c.owner_id IS NOT NULL
              AND c.deleted_at IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM cooperation_slips cs
                  WHERE cs.contact_id = c.id
                    AND cs.status IN ('pending_signatures', 'approved_pending_signatures', 'pending_manager_approval', 'approved')
              )
              $sourcesFilter";
              
    $res = $conn->query($sql);
    if (!$res) return;
    
    while ($row = $res->fetch_assoc()) {
        $contactId = (int)$row['contact_id'];
        $personId = (int)$row['person_id'];
        $ownerId = (int)$row['owner_id'];
        $projectId = $row['project_id'] ? (int)$row['project_id'] : null;
        $roundId = $row['original_round_id'] ? (int)$row['original_round_id'] : null;
        
        if (!$roundId) {
            $leadData = [
                'phone' => $row['phone'],
                'email' => $row['email'],
                'name' => trim($row['first_name'] . ' ' . $row['last_name']),
                'source' => $row['source'],
                'type' => '',
                'note' => ''
            ];
            $ruleResult = evaluateRules($conn, $leadData, $row['source'], '', null, 'manual');
            if (is_array($ruleResult)) {
                $roundId = $ruleResult['target_round_id'];
            } else {
                $roundId = $ruleResult;
            }
        }
        
        if (!$roundId) {
            $fbRoundRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_round_id'");
            if ($fbRoundRes && $fbRow = $fbRoundRes->fetch_assoc()) {
                $roundId = (int)$fbRow['setting_value'];
            }
        }
        
        if (!$roundId) {
            logSync("No round found for parallel assignment of contact $contactId. Skipping.");
            continue;
        }
        
        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("SELECT last_assigned_consultant_id FROM distribution_rounds WHERE id = ? FOR UPDATE");
            $stmt->bind_param("i", $roundId);
            $stmt->execute();
            $roundRes = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            
            if (!$roundRes) {
                $conn->rollback();
                continue;
            }
            
            $cStmt = $conn->prepare("
                SELECT c.id, u.id AS user_id, rc.receive_ratio, rc.skip_count
                FROM round_consultants rc
                JOIN consultants c ON rc.consultant_id = c.id
                LEFT JOIN users u ON c.email = u.email
                WHERE rc.round_id = ?
                  AND rc.is_active = 1
                  AND c.status = 'active'
                  AND c.vacation_mode = 0
                  AND (c.leave_start IS NULL OR CURDATE() < c.leave_start OR (c.leave_end IS NOT NULL AND c.leave_end < CURDATE()))
                  AND u.id != ?
                ORDER BY c.id ASC
            ");
            $cStmt->bind_param("ii", $roundId, $ownerId);
            $cStmt->execute();
            $cRes = $cStmt->get_result();
            $consultants = [];
            while ($cRow = $cRes->fetch_assoc()) {
                $consultants[] = $cRow;
            }
            $cStmt->close();
            
            if (empty($consultants)) {
                logSync("No other active consultants in round $roundId to assign parallelly. Skipping.");
                $conn->rollback();
                continue;
            }
            
            $lastAssignedId = $roundRes['last_assigned_consultant_id'];
            $nextIdx = 0;
            if ($lastAssignedId) {
                foreach ($consultants as $i => $c) {
                    if ($c['id'] > $lastAssignedId) {
                        $nextIdx = $i;
                        break;
                    }
                }
            }
            
            $candidate = $consultants[$nextIdx];
            $secondSaleId = (int)$candidate['id'];
            $secondUserId = (int)($candidate['user_id'] ?: $candidate['id']);
            
            $upd1 = $conn->prepare("UPDATE contacts SET parallel_assigned = 1 WHERE id = ?");
            $upd1->bind_param("i", $contactId);
            $upd1->execute();
            $upd1->close();
            
            $chuaXacDinhDuration = get_system_setting($conn, 'security_timer_chua_xac_dinh') ?: '+3 hours';
            $secExpiresTime = date('Y-m-d H:i:s', strtotime($chuaXacDinhDuration));

            if ($projectId !== null) {
                $chkExists = $conn->query("SELECT id FROM projects WHERE id = " . (int)$projectId);
                if (!$chkExists || $chkExists->num_rows === 0) {
                    $projectId = null;
                }
            }

            $stmtIns = $conn->prepare("
                INSERT INTO contacts (tenant_id, person_id, project_id, owner_id, created_by, first_name, last_name, email, phone, source, status, pipeline_status, parallel_assigned, security_expires_at, notes, customer_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lead', 'chua_xac_dinh', 1, ?, ?, ?)
            ");
            $createdBy = 1;
            $tenantId = (int)$row['tenant_id'];
            $stmtIns->bind_param("iiiiissssssss", $tenantId, $personId, $projectId, $secondUserId, $createdBy, $row['first_name'], $row['last_name'], $row['email'], $row['phone'], $row['source'], $secExpiresTime, $row['notes'], $row['customer_type']);
            $stmtIns->execute();
            $secondContactId = $stmtIns->insert_id;
            $stmtIns->close();

            // Insert matching lead record to satisfy foreign key constraint on distribution_logs.lead_id
            $stmtLead = $conn->prepare("INSERT IGNORE INTO leads (id, person_id, phone, email, name, source, status) VALUES (?, ?, NULL, ?, ?, ?, 'assigned')");
            $leadName = trim($row['first_name'] . ' ' . $row['last_name']);
            $stmtLead->bind_param("issss", $secondContactId, $personId, $row['email'], $leadName, $row['source']);
            $stmtLead->execute();
            $stmtLead->close();
            
            $updRound = $conn->prepare("UPDATE distribution_rounds SET last_assigned_consultant_id = ? WHERE id = ?");
            $updRound->bind_param("ii", $secondSaleId, $roundId);
            $updRound->execute();
            $updRound->close();
            
            logDistribution($conn, $secondContactId, $secondSaleId, $roundId, 'assigned', 'Gán song song tự động (Chưa Xác Định > 3 giờ)', false);
            
            $conn->commit();
            logSync("Parallel assigned Person ID $personId (Contact ID $contactId) to Sale ID $secondSaleId.");
            
            $detailStmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
            $detailStmt->bind_param("i", $secondSaleId);
            $detailStmt->execute();
            $cDetail = $detailStmt->get_result()->fetch_assoc();
            $detailStmt->close();
            
            if ($cDetail) {
                $rNameRes = $conn->query("SELECT round_name FROM distribution_rounds WHERE id = $roundId");
                $rNameRow = $rNameRes ? $rNameRes->fetch_assoc() : null;
                $roundName = $rNameRow ? $rNameRow['round_name'] : 'Vòng xoay';
                
                $fullName = trim($row['first_name'] . ' ' . $row['last_name']) ?: 'Khách hàng ẩn danh';
                try {
                    sendLeadAssignedEmailToSale(
                        $cDetail['email'],
                        $cDetail['name'],
                        $fullName,
                        $row['phone'],
                        'Gán song song tự động do lead Chưa Xác Định quá 3 giờ',
                        $row['source'],
                        '',
                        $roundName,
                        $secondContactId,
                        $secondSaleId,
                        $roundId
                    );
                } catch (Exception $mailEx) {
                    logSync("Error sending parallel assigned email: " . $mailEx->getMessage());
                }
                
                try {
                    sendLeadAssignedZaloMessageToSale(
                        $secondSaleId,
                        $cDetail['name'],
                        $fullName,
                        $row['phone'],
                        'Gán song song tự động do lead Chưa Xác Định quá 3 giờ',
                        $row['source'],
                        $roundName,
                        $secondContactId,
                        $roundId,
                        $row['email'],
                        ''
                    );
                } catch (Exception $zaloEx) {
                    logSync("Error sending parallel assigned Zalo: " . $zaloEx->getMessage());
                }
            }
            
            triggerTwoWaySync($conn, $secondContactId);
            
        } catch (Exception $e) {
            $conn->rollback();
            logSync("Error parallel assigning contact $contactId: " . $e->getMessage());
        }
    }
}
function checkCheckInSlaEscalation($conn) {
    logSync("Running checkCheckInSlaEscalation...");
    
    $slaMinutes = (int) get_system_setting($conn, 'checkin_approval_sla_minutes') ?: 15;
    
    $sql = "SELECT c.id, c.user_id, c.check_in_date, c.check_in_time, c.reason, u.full_name as sale_name, u.tenant_id, u.team_id
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.status = 'pending_approval'
              AND c.sla_notified_at IS NULL
              AND TIMESTAMP(CONCAT(c.check_in_date, ' ', c.check_in_time)) <= DATE_SUB(NOW(), INTERVAL ? MINUTE)";
              
    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $stmt->bind_param("i", $slaMinutes);
        $stmt->execute();
        $res = $stmt->get_result();
        
        $notifStmt = $conn->prepare("
            INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        while ($row = $res->fetch_assoc()) {
            $checkInId = (int)$row['id'];
            $tenantId = (int)$row['tenant_id'];
            $uTeamId = $row['team_id'] !== null ? (int)$row['team_id'] : 0;
            
            $admQuery = "
                SELECT id FROM users 
                WHERE tenant_id = " . $tenantId . " 
                  AND (
                    role IN ('admin', 'superadmin', 'super_admin', 'director', 'assistant')
                    OR (
                      role = 'manager' 
                      AND (
                        id IN (SELECT leader_id FROM teams WHERE id = " . $uTeamId . ")
                        OR team_id = " . $uTeamId . "
                      )
                    )
                  )
            ";
            $admRes = $conn->query($admQuery);
            if ($admRes) {
                $title = "CẢNH BÁO: Duyệt đi trễ quá hạn";
                $body = "Yêu cầu duyệt đi trễ của " . $row['sale_name'] . " (lý do: \"" . $row['reason'] . "\") đã quá " . $slaMinutes . " phút chưa được xử lý!";
                $type = "attendance";
                $link = "/attendance";
                
                while ($adm = $admRes->fetch_assoc()) {
                    $adminUserId = (int)$adm['id'];
                    $notifStmt->bind_param("iissss", $adminUserId, $tenantId, $title, $body, $type, $link);
                    $notifStmt->execute();
                }
            }
            
            $upd = $conn->prepare("UPDATE check_ins SET sla_notified_at = NOW() WHERE id = ?");
            $upd->bind_param("i", $checkInId);
            $upd->execute();
            $upd->close();
            
            logSync("Sent SLA Escalation alert for check-in ID $checkInId (Sale: {$row['sale_name']})");
        }
        $stmt->close();
        if ($notifStmt) {
            $notifStmt->close();
        }
    }
}

function checkTaskDueSlaAlerts($conn) {
    logSync("Running checkTaskDueSlaAlerts...");
    
    $sql = "SELECT id, tenant_id, user_id, created_by, subject, due_date, body 
            FROM activities 
            WHERE type = 'task' 
              AND status = 'planned' 
              AND deleted_at IS NULL 
              AND due_date IS NOT NULL 
              AND due_date <= NOW()
              AND (body NOT LIKE '%\"due_sla_notified\":true%' OR body IS NULL)
            LIMIT 50";
            
    $res = $conn->query($sql);
    if ($res && $res->num_rows > 0) {
        $notifStmt = $conn->prepare("
            INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
            VALUES (?, ?, ?, ?, 'task_overdue', ?)
        ");
        
        while ($row = $res->fetch_assoc()) {
            $taskId = (int)$row['id'];
            $tenantId = (int)$row['tenant_id'];
            $userId = !empty($row['user_id']) ? (int)$row['user_id'] : null;
            $createdBy = !empty($row['created_by']) ? (int)$row['created_by'] : null;
            $subject = $row['subject'];
            $dueDate = $row['due_date'];
            
            $title = "CẢNH BÁO SLA: Công việc quá hạn";
            $body = "Công việc \"" . $subject . "\" đã quá hạn xử lý (thời hạn: " . date('H:i d/m/Y', strtotime($dueDate)) . ")!";
            $link = "/activities";

            $recipients = array_filter(array_unique([$userId, $createdBy]));
            foreach ($recipients as $targetUid) {
                if ($notifStmt && $targetUid) {
                    $notifStmt->bind_param("iisss", $targetUid, $tenantId, $title, $body, $link);
                    $notifStmt->execute();
                }
            }

            // Mark task as notified
            $bodyData = !empty($row['body']) ? json_decode($row['body'], true) : [];
            if (!is_array($bodyData)) $bodyData = [];
            $bodyData['due_sla_notified'] = true;
            $newBodyJson = json_encode($bodyData, JSON_UNESCAPED_UNICODE);

            $upd = $conn->prepare("UPDATE activities SET body = ? WHERE id = ?");
            if ($upd) {
                $upd->bind_param("si", $newBodyJson, $taskId);
                $upd->execute();
                $upd->close();
            }

            logSync("Sent Task Overdue SLA Alert for Task #$taskId ($subject)");
        }
        if ($notifStmt) {
            $notifStmt->close();
        }
    }
}

function checkCapiStuckAlert($conn) {
    logSync("Running checkCapiStuckAlert...");
    $thresholdHours = (int) get_system_setting($conn, 'capi_stuck_alert_threshold_hours') ?: 24;
    
    $stmt = $conn->prepare("
        SELECT COUNT(*) as cnt 
        FROM capi_logs 
        WHERE response_status != 200 
          AND sent_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ");
    if ($stmt) {
        $stmt->bind_param("i", $thresholdHours);
        $stmt->execute();
        $res = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        $count = $res ? (int)$res['cnt'] : 0;
        if ($count > 0) {
            logSync("Found $count failed CAPI events older than $thresholdHours hours. Sending alert to admin/marketing...");
            
            $admRes = $conn->query("
                SELECT id, tenant_id FROM users 
                WHERE role IN ('admin', 'superadmin', 'super_admin', 'director', 'assistant')
            ");
            if ($admRes) {
                $notifStmt = $conn->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, 'system', '/capi')
                ");
                if ($notifStmt) {
                    $title = "CẢNH BÁO CAPI: Tắc nghẽn hàng đợi";
                    $body = "Hệ thống phát hiện $count sự kiện Meta CAPI bị lỗi chưa gửi được quá $thresholdHours giờ! Vui lòng kiểm tra cấu hình Pixel/Access Token.";
                    while ($row = $admRes->fetch_assoc()) {
                        $uid = (int)$row['id'];
                        $tid = (int)$row['tenant_id'];
                        $link = '/capi';
                        $type = 'system';
                        $notifStmt->bind_param("iissss", $uid, $tid, $title, $body, $type, $link);
                        $notifStmt->execute();
                    }
                    $notifStmt->close();
                }
            }
        }
    }
}

function sendShiftRemindersAndCheckInAlerts($conn) {
    // 1. Create tracking table if not exists to prevent duplicate messages
    $conn->query("
        CREATE TABLE IF NOT EXISTS `sent_notifications` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `user_id` INT NOT NULL,
            `notify_type` VARCHAR(50) NOT NULL,
            `notify_date` DATE NOT NULL,
            `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uniq_user_type_date` (`user_id`, `notify_type`, `notify_date`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 2. Load system configurations
    $settings = [];
    $res = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (
        'attendance_notification_enabled',
        'attendance_notification_lead_minutes',
        'night_duty_notification_enabled',
        'night_duty_notification_lead_minutes',
        'zalo_bot_token',
        'telegram_bot_token',
        'night_shift_start_time',
        'night_shift_end_time'
    )");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    $zaloBotToken = $settings['zalo_bot_token'] ?? '';
    $telegramBotToken = $settings['telegram_bot_token'] ?? '';

    $attendanceEnabled = isset($settings['attendance_notification_enabled']) ? (int)$settings['attendance_notification_enabled'] : 1;
    $attendanceLeadMinutes = isset($settings['attendance_notification_lead_minutes']) ? (int)$settings['attendance_notification_lead_minutes'] : 10;
    $nightDutyEnabled = isset($settings['night_duty_notification_enabled']) ? (int)$settings['night_duty_notification_enabled'] : 1;
    $nightDutyLeadMinutes = isset($settings['night_duty_notification_lead_minutes']) ? (int)$settings['night_duty_notification_lead_minutes'] : 10;

    $now = new DateTime();
    $todayStr = $now->format('Y-m-d');

    // Include helper notification libraries safely if present
    if (file_exists(__DIR__ . '/zalo_bot.php')) {
        @require_once __DIR__ . '/zalo_bot.php';
    }
    if (file_exists(__DIR__ . '/telegram_bot.php')) {
        @require_once __DIR__ . '/telegram_bot.php';
    }
    if (file_exists(__DIR__ . '/mailer.php')) {
        @require_once __DIR__ . '/mailer.php';
    }

    // Helper lambda to check user matrix config for reminders
    $userMatrixCache = [];
    $getSaleMatrixSetting = function($conn, $userId, $eventType, $channel) use (&$userMatrixCache) {
        if (!isset($userMatrixCache[$userId])) {
            $userMatrixCache[$userId] = [];
            $stmtM = $conn->prepare("SELECT matrix_config FROM user_notification_settings WHERE user_id = ? LIMIT 1");
            if ($stmtM) {
                $stmtM->bind_param("i", $userId);
                $stmtM->execute();
                $rowM = $stmtM->get_result()->fetch_assoc();
                $stmtM->close();
                if ($rowM && !empty($rowM['matrix_config'])) {
                    $userMatrixCache[$userId] = json_decode($rowM['matrix_config'], true) ?: [];
                }
            }
        }
        $cfg = $userMatrixCache[$userId];
        if (!isset($cfg[$eventType])) {
            return true; // Default enabled if not customized
        }
        $evt = $cfg[$eventType];
        if (isset($evt['master']) && !$evt['master']) {
            return false;
        }
        if (isset($evt[$channel])) {
            return (bool)$evt[$channel];
        }
        return true;
    };

    // A. Check-in reminders
    if ($attendanceEnabled === 1) {
        // Query active users who have not checked in today
        $userQuery = "
            SELECT u.id, u.full_name, u.email, u.zalo_chat_id, u.telegram_chat_id,
                   IF(u.use_custom_work_hours = 1, u.work_start_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1)) AS work_start_time
            FROM users u
            WHERE u.status = 'active'
        ";
        $userRes = $conn->query($userQuery);
        if ($userRes) {
            while ($user = $userRes->fetch_assoc()) {
                $userId = (int)$user['id'];
                $workStart = $user['work_start_time'] ?: '08:00';
                
                // Parse work start time to determine target reminder time
                $workStartParts = explode(':', $workStart);
                if (count($workStartParts) >= 2) {
                    try {
                        $reminderTime = new DateTime($todayStr . ' ' . $workStart);
                        $reminderTime->modify("-$attendanceLeadMinutes minutes");
                        
                        $nowTimestamp = $now->getTimestamp();
                        $reminderTimestamp = $reminderTime->getTimestamp();
                        $workStartTimestamp = (new DateTime($todayStr . ' ' . $workStart))->getTimestamp();
                        
                        // If current time is past/equal to reminder time, and before work start time
                        if ($nowTimestamp >= $reminderTimestamp && $nowTimestamp < $workStartTimestamp) {
                            // Check if already sent
                            $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = 'checkin_reminder' AND notify_date = ?");
                            $chk->bind_param("is", $userId, $todayStr);
                            $chk->execute();
                            $hasSent = (bool)$chk->get_result()->fetch_assoc();
                            $chk->close();
                            
                            if (!$hasSent) {
                                // Double check if already checked in today
                                $chkCheckin = $conn->prepare("SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ?");
                                $chkCheckin->bind_param("is", $userId, $todayStr);
                                $chkCheckin->execute();
                                $alreadyCheckedIn = (bool)$chkCheckin->get_result()->fetch_assoc();
                                $chkCheckin->close();
                                
                                if (!$alreadyCheckedIn) {
                                    $msg = "⏰ Đã đến giờ chấm công! Vui lòng thực hiện chấm công đi làm đúng giờ quy định. Chúc bạn một ngày làm việc hiệu quả!";
                                    
                                    // 1. Send Web In-App Notification Bell (Isolated)
                                    if ($getSaleMatrixSetting($conn, $userId, 'ATTENDANCE_REMINDER', 'bell')) {
                                        try {
                                            $insNotif = $conn->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, 1, '⏰ Nhắc nhở chấm công', ?, 'attendance_reminder', '/attendance')");
                                            if ($insNotif) {
                                                $insNotif->bind_param("is", $userId, $msg);
                                                $insNotif->execute();
                                                $insNotif->close();
                                            }
                                        } catch (Throwable $eWeb) {
                                            error_log("Checkin Reminder Web Notif Error: " . $eWeb->getMessage());
                                        }
                                    }

                                    // 2. Send Zalo message if available (Isolated)
                                    if ($getSaleMatrixSetting($conn, $userId, 'ATTENDANCE_REMINDER', 'zalo')) {
                                        try {
                                            if (!empty($zaloBotToken) && !empty($user['zalo_chat_id']) && function_exists('sendZaloMessage')) {
                                                sendZaloMessage($zaloBotToken, $user['zalo_chat_id'], $msg, false);
                                            }
                                        } catch (Throwable $eZalo) {
                                            error_log("Checkin Reminder Zalo Error: " . $eZalo->getMessage());
                                        }
                                    }

                                    // 3. Send Telegram message if available (Isolated)
                                    if ($getSaleMatrixSetting($conn, $userId, 'ATTENDANCE_REMINDER', 'telegram')) {
                                        try {
                                            if (!empty($telegramBotToken) && !empty($user['telegram_chat_id']) && function_exists('sendTelegramMessage')) {
                                                $tgText = "⏰ <b>[ NHẮC NHỞ CHẤM CÔNG ]</b>\n\nXin chào <b>" . htmlspecialchars($user['full_name']) . "</b>,\nĐã đến giờ chấm công cho ca làm việc hôm nay (" . $workStart . ")!\nVui lòng truy cập hệ thống để thực hiện chấm công đúng giờ.\nChúc bạn một ngày làm việc hiệu quả!";
                                                sendTelegramMessage($telegramBotToken, $user['telegram_chat_id'], $tgText);
                                            }
                                        } catch (Throwable $eTg) {
                                            error_log("Checkin Reminder Telegram Error: " . $eTg->getMessage());
                                        }
                                    }

                                    // 4. Send Email notification if email exists (Isolated)
                                    if ($getSaleMatrixSetting($conn, $userId, 'ATTENDANCE_REMINDER', 'email')) {
                                        try {
                                            if (!empty($user['email']) && function_exists('sendEmailNotification')) {
                                                $emailSubject = "[RICH LAND] Nhắc nhở chấm công đi làm";
                                                $emailTitle = "NHẮC NHỞ CHẤM CÔNG";
                                                $emailContent = "Chào <strong>" . htmlspecialchars($user['full_name']) . "</strong>,<br/><br/>" .
                                                                "Đã đến giờ chấm công cho ca làm việc hôm nay (lúc " . htmlspecialchars($workStart) . ").<br/>" .
                                                                "Vui lòng truy cập hệ thống để thực hiện điểm danh/chấm công đúng giờ quy định.<br/><br/>" .
                                                                "Chúc bạn một ngày làm việc hiệu quả!";
                                                sendEmailNotification($user['email'], $emailSubject, $emailTitle, $emailContent, 'Chấm công ngay', true);
                                            }
                                        } catch (Throwable $eMail) {
                                            error_log("Checkin Reminder Email Error: " . $eMail->getMessage());
                                        }
                                    }
                                    
                                    $ins = $conn->prepare("INSERT IGNORE INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, 'checkin_reminder', ?)");
                                    $ins->bind_param("is", $userId, $todayStr);
                                    $ins->execute();
                                    $ins->close();
                                    
                                    logSync("Sent check-in reminder (Web/Zalo/Telegram/Email) to Sale: {$user['full_name']} (User ID: {$userId})");
                                }
                            }
                        }
                    } catch (Exception $remEx) {
                        error_log("Error calculating check-in reminder: " . $remEx->getMessage());
                    }
                }
            }
        }
    }

    // B. Night shift reminders
    if ($nightDutyEnabled === 1) {
        $nightShiftStart = $settings['night_shift_start_time'] ?? '18:00';
        $nightShiftEnd = $settings['night_shift_end_time'] ?? '06:00';
        
        $nightStartParts = explode(':', $nightShiftStart);
        if (count($nightStartParts) >= 2) {
            try {
                $reminderTime = new DateTime($todayStr . ' ' . $nightShiftStart);
                $reminderTime->modify("-$nightDutyLeadMinutes minutes");
                
                $nowTimestamp = $now->getTimestamp();
                $reminderTimestamp = $reminderTime->getTimestamp();
                $nightStartTimestamp = (new DateTime($todayStr . ' ' . $nightShiftStart))->getTimestamp();
                
                if ($nowTimestamp >= $reminderTimestamp && $nowTimestamp < $nightStartTimestamp) {
                    // Get all active approved night shift registrations for today
                    $nightRegsQuery = "
                        SELECT n.user_id, u.full_name, u.email, u.zalo_chat_id, u.telegram_chat_id
                        FROM night_shift_registrations n
                        JOIN users u ON n.user_id = u.id
                        WHERE n.shift_date = ? AND n.approved = 1 AND u.status = 'active'
                    ";
                    $stmtRegs = $conn->prepare($nightRegsQuery);
                    $stmtRegs->bind_param("s", $todayStr);
                    $stmtRegs->execute();
                    $regsRes = $stmtRegs->get_result();
                    while ($reg = $regsRes->fetch_assoc()) {
                        $userId = (int)$reg['user_id'];
                        
                        // Check if already sent
                        $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = 'night_duty_reminder' AND notify_date = ?");
                        $chk->bind_param("is", $userId, $todayStr);
                        $chk->execute();
                        $hasSent = (bool)$chk->get_result()->fetch_assoc();
                        $chk->close();
                        
                        if (!$hasSent) {
                            $msg = "🌙 Hôm nay bạn có đăng ký trực đêm thời gian từ {$nightShiftStart} đến {$nightShiftEnd}. Chúc bạn buổi tối vui vẻ và trực ca hiệu quả!";
                            
                            // 1. Send Web In-App Notification Bell (Isolated)
                            if ($getSaleMatrixSetting($conn, $userId, 'NIGHT_SHIFT_BOOKING', 'bell')) {
                                try {
                                    $insNotif = $conn->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, 1, '🌙 Nhắc nhở ca trực đêm', ?, 'night_duty_reminder', '/attendance')");
                                    if ($insNotif) {
                                        $insNotif->bind_param("is", $userId, $msg);
                                        $insNotif->execute();
                                        $insNotif->close();
                                    }
                                } catch (Throwable $eWeb) {
                                    error_log("Night Duty Web Notif Error: " . $eWeb->getMessage());
                                }
                            }

                            // 2. Send Zalo message if available (Isolated)
                            if ($getSaleMatrixSetting($conn, $userId, 'NIGHT_SHIFT_BOOKING', 'zalo')) {
                                try {
                                    if (!empty($zaloBotToken) && !empty($reg['zalo_chat_id']) && function_exists('sendZaloMessage')) {
                                        sendZaloMessage($zaloBotToken, $reg['zalo_chat_id'], $msg, false);
                                    }
                                } catch (Throwable $eZalo) {
                                    error_log("Night Duty Zalo Error: " . $eZalo->getMessage());
                                }
                            }

                            // 3. Send Telegram message if available (Isolated)
                            if ($getSaleMatrixSetting($conn, $userId, 'NIGHT_SHIFT_BOOKING', 'telegram')) {
                                try {
                                    if (!empty($telegramBotToken) && !empty($reg['telegram_chat_id']) && function_exists('sendTelegramMessage')) {
                                        $tgText = "🌙 <b>[ NHẮC NHỞ LỊCH TRỰC ĐÊM ]</b>\n\nXin chào <b>" . htmlspecialchars($reg['full_name']) . "</b>,\nHôm nay bạn có lịch trực đêm từ <b>{$nightShiftStart}</b> đến <b>{$nightShiftEnd}</b>.\nChúc bạn buổi tối vui vẻ và trực ca hiệu quả!";
                                        sendTelegramMessage($telegramBotToken, $reg['telegram_chat_id'], $tgText);
                                    }
                                } catch (Throwable $eTg) {
                                    error_log("Night Duty Telegram Error: " . $eTg->getMessage());
                                }
                            }

                            // 4. Send Email notification if email exists (Isolated)
                            if ($getSaleMatrixSetting($conn, $userId, 'NIGHT_SHIFT_BOOKING', 'email')) {
                                try {
                                    if (!empty($reg['email']) && function_exists('sendEmailNotification')) {
                                        $emailSubject = "[RICH LAND] Nhắc nhở lịch trực đêm hôm nay";
                                        $emailTitle = "NHẮC NHỞ LỊCH TRỰC ĐÊM";
                                        $emailContent = "Chào <strong>" . htmlspecialchars($reg['full_name']) . "</strong>,<br/><br/>" .
                                                        "Hệ thống ghi nhận bạn có lịch trực ca đêm hôm nay (từ " . htmlspecialchars($nightShiftStart) . " đến " . htmlspecialchars($nightShiftEnd) . ").<br/>" .
                                                        "Vui lòng chú ý thời gian để nhận lead/hỗ trợ khách hàng theo đúng ca trực.<br/><br/>" .
                                                        "Chúc bạn buổi tối trực ca thuận lợi!";
                                        sendEmailNotification($reg['email'], $emailSubject, $emailTitle, $emailContent, 'Xem lịch trực', true);
                                    }
                                } catch (Throwable $eMail) {
                                    error_log("Night Duty Email Error: " . $eMail->getMessage());
                                }
                            }
                            
                            $ins = $conn->prepare("INSERT IGNORE INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, 'night_duty_reminder', ?)");
                            $ins->bind_param("is", $userId, $todayStr);
                            $ins->execute();
                            $ins->close();
                            
                            logSync("Sent night shift reminder (Web/Zalo/Telegram/Email) to Sale: {$reg['full_name']} (User ID: {$userId})");
                        }
                    }
                    $stmtRegs->close();
                }
            } catch (Exception $nsEx) {
                error_log("Error calculating night shift reminder: " . $nsEx->getMessage());
            }
        }
    }
}

function sendCheckOutReminders($conn) {
    $resSet = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'require_checkout' LIMIT 1");
    $reqCheckout = 0;
    if ($resSet && $r = $resSet->fetch_assoc()) {
        $reqCheckout = (int)$r['setting_value'];
    }
    if ($reqCheckout !== 1) return;

    $todayStr = date('Y-m-d');
    $nowStr = date('H:i');

    $resGlobalEnd = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1");
    $globalWorkEnd = '17:30';
    if ($resGlobalEnd && $rg = $resGlobalEnd->fetch_assoc()) {
        $globalWorkEnd = substr($rg['setting_value'], 0, 5);
    }

    if ($nowStr < $globalWorkEnd) return;

    $sql = "
        SELECT u.id, u.full_name, u.email, u.zalo_chat_id, u.telegram_chat_id, 
               IF(COALESCE(u.use_custom_work_hours, 0) = 1, u.work_end_time, '$globalWorkEnd') AS work_end_time
        FROM check_ins c
        JOIN users u ON c.user_id = u.id
        WHERE c.check_in_date = ? AND c.check_out_time IS NULL AND u.status = 'active'
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $todayStr);
    $stmt->execute();
    $res = $stmt->get_result();

    require_once __DIR__ . '/NotificationService.php';
    require_once __DIR__ . '/config.php';
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    while ($user = $res->fetch_assoc()) {
        $userId = (int)$user['id'];
        
        $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = 'checkout_reminder' AND notify_date = ?");
        $chk->bind_param("is", $userId, $todayStr);
        $chk->execute();
        $hasSent = (bool)$chk->get_result()->fetch_assoc();
        $chk->close();

        if (!$hasSent) {
            NotificationService::send($pdo, 1, 'CHECKOUT_REMINDER', [
                'recipients' => [$user],
                'work_end' => substr($user['work_end_time'], 0, 5)
            ]);

            $ins = $conn->prepare("INSERT IGNORE INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, 'checkout_reminder', ?)");
            $ins->bind_param("is", $userId, $todayStr);
            $ins->execute();
            $ins->close();

            logSync("Sent check-out reminder to Sale: {$user['full_name']} (User ID: {$userId})");
        }
    }
    $stmt->close();
}

function sendScheduledAttendanceReports($conn) {
    $stmtS = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('attendance_report_enabled', 'attendance_report_trigger_day', 'attendance_report_date_mode', 'attendance_report_start_date', 'attendance_report_end_date')");
    $settings = [];
    if ($stmtS) {
        while ($r = $stmtS->fetch_assoc()) {
            $settings[$r['setting_key']] = $r['setting_value'];
        }
    }

    if (empty($settings['attendance_report_enabled']) || (int)$settings['attendance_report_enabled'] !== 1) {
        return;
    }

    $triggerDay = (int)($settings['attendance_report_trigger_day'] ?? 1);
    $todayDay = (int)date('j');
    $todayStr = date('Y-m-d');

    if ($todayDay !== $triggerDay) return;

    $mode = $settings['attendance_report_date_mode'] ?? 'previous_month';
    
    if ($mode === 'last_30_days') {
        $startDate = date('Y-m-d', strtotime('-30 days'));
        $endDate = date('Y-m-d', strtotime('-1 day'));
        $periodStr = "30 ngày gần nhất (" . date('d/m/Y', strtotime($startDate)) . " - " . date('d/m/Y', strtotime($endDate)) . ")";
    } elseif ($mode === 'custom' && !empty($settings['attendance_report_start_date']) && !empty($settings['attendance_report_end_date'])) {
        $startDate = $settings['attendance_report_start_date'];
        $endDate = $settings['attendance_report_end_date'];
        $periodStr = "Từ " . date('d/m/Y', strtotime($startDate)) . " đến " . date('d/m/Y', strtotime($endDate));
    } else {
        $firstDayPrev = date('Y-m-01', strtotime('first day of last month'));
        $lastDayPrev = date('Y-m-t', strtotime('last day of last month'));
        $startDate = $firstDayPrev;
        $endDate = $lastDayPrev;
        $periodStr = "Tháng " . date('m/Y', strtotime($startDate));
    }

    $salesRes = $conn->query("SELECT id, full_name, email, zalo_chat_id, telegram_chat_id FROM users WHERE role IN ('sales', 'sale') AND status = 'active'");
    if (!$salesRes) return;

    require_once __DIR__ . '/NotificationService.php';
    require_once __DIR__ . '/config.php';
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    while ($sale = $salesRes->fetch_assoc()) {
        $userId = (int)$sale['id'];

        $reportKey = 'monthly_att_report_' . $startDate . '_' . $endDate;
        $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ? AND notify_date = ?");
        $chk->bind_param("iss", $userId, $reportKey, $todayStr);
        $chk->execute();
        $hasSent = (bool)$chk->get_result()->fetch_assoc();
        $chk->close();

        if ($hasSent) continue;

        $stmtC = $conn->prepare("SELECT COUNT(*) as total_days, SUM(late_minutes) as total_late_min, SUM(IF(late_minutes > 0, 1, 0)) as late_days, SUM(IF(early_minutes > 0, 1, 0)) as early_days FROM check_ins WHERE user_id = ? AND check_in_date BETWEEN ? AND ? AND status = 'approved'");
        $stmtC->bind_param("iss", $userId, $startDate, $endDate);
        $stmtC->execute();
        $attData = $stmtC->get_result()->fetch_assoc();
        $stmtC->close();

        $totalCheckedIn = (int)($attData['total_days'] ?? 0);
        $lateDays = (int)($attData['late_days'] ?? 0);
        $totalLateMin = (int)($attData['total_late_min'] ?? 0);

        $stmtNight = $conn->prepare("SELECT COUNT(*) as cnt FROM night_shift_registrations WHERE user_id = ? AND shift_date BETWEEN ? AND ? AND approved = 1");
        $stmtNight->bind_param("iss", $userId, $startDate, $endDate);
        $stmtNight->execute();
        $nightShifts = (int)($stmtNight->get_result()->fetch_assoc()['cnt'] ?? 0);
        $stmtNight->close();

        $stmtDuty = $conn->prepare("SELECT COUNT(*) as cnt FROM duty_registrations WHERE user_id = ? AND duty_date BETWEEN ? AND ? AND approved = 1");
        $stmtDuty->bind_param("iss", $userId, $startDate, $endDate);
        $stmtDuty->execute();
        $dutyShifts = (int)($stmtDuty->get_result()->fetch_assoc()['cnt'] ?? 0);
        $stmtDuty->close();

        $summaryText = "Xin chào {$sale['full_name']},\n"
            . "Hệ thống xin gửi tổng kết Chấm công & Trực ca của bạn trong {$periodStr}:\n"
            . "  • Số ngày đã chấm công: {$totalCheckedIn} ngày\n"
            . "  • Số lần đi trễ: {$lateDays} lần (Tổng {$totalLateMin} phút)\n"
            . "  • Số ca trực đêm: {$nightShifts} ca\n"
            . "  • Số ca trực cuối tuần / lễ: {$dutyShifts} ca\n\n"
            . "Chúc bạn làm việc hiệu quả và đạt nhiều doanh số!";

        NotificationService::send($pdo, 1, 'MONTHLY_ATTENDANCE_REPORT', [
            'recipients' => [$sale],
            'summary_text' => $summaryText,
            'period_str' => $periodStr
        ]);

        $ins = $conn->prepare("INSERT IGNORE INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, ?, ?)");
        $ins->bind_param("iss", $userId, $reportKey, $todayStr);
        $ins->execute();
        $ins->close();

        logSync("Dispatched Monthly Attendance Report to Sale: {$sale['full_name']} (User ID: {$userId})");
    }
}

logSync("Cronjob finished.");

if (!defined('DIAG_TOKEN')) {
    // --- Chạy giải phóng lead hết hạn bảo mật ra Kho chung ---
    try {
        releaseExpiredLeadsToKho($conn);
    } catch (Exception $e) {
        logSync("Error running releaseExpiredLeadsToKho: " . $e->getMessage());
    }

    // --- Chạy kiểm tra gửi nhắc nhở chấm công & ca trực đêm ---
    try {
        sendShiftRemindersAndCheckInAlerts($conn);
    } catch (Exception $e) {
        logSync("Error running sendShiftRemindersAndCheckInAlerts: " . $e->getMessage());
    }

    // --- Chạy kiểm tra gửi nhắc nhở chấm công Ra ca (Cuối ca) ---
    try {
        if (function_exists('sendCheckOutReminders')) {
            sendCheckOutReminders($conn);
        }
    } catch (Exception $e) {
        logSync("Error running sendCheckOutReminders: " . $e->getMessage());
    }

    // --- Chạy gửi báo cáo chấm công & trực ca định kỳ cho Sale ---
    try {
        if (function_exists('sendScheduledAttendanceReports')) {
            sendScheduledAttendanceReports($conn);
        }
    } catch (Exception $e) {
        logSync("Error running sendScheduledAttendanceReports: " . $e->getMessage());
    }

    // --- Chạy kiểm tra cảnh báo SLA duyệt đi trễ ---
    try {
        checkCheckInSlaEscalation($conn);
    } catch (Exception $e) {
        logSync("Error running checkCheckInSlaEscalation: " . $e->getMessage());
    }

    // --- Chạy kiểm tra cảnh báo SLA thời hạn công việc quá hạn ---
    try {
        checkTaskDueSlaAlerts($conn);
    } catch (Exception $e) {
        logSync("Error running checkTaskDueSlaAlerts: " . $e->getMessage());
    }

    // --- Chạy kiểm tra cảnh báo tắc nghẽn Meta CAPI ---
    try {
        checkCapiStuckAlert($conn);
    } catch (Exception $e) {
        logSync("Error running checkCapiStuckAlert: " . $e->getMessage());
    }

    // --- Chạy phân bổ song song ở trạng thái Chưa Xác Định quá 3 giờ ---
    try {
        assignParallelLeads($conn);
    } catch (Exception $e) {
        logSync("Error running assignParallelLeads: " . $e->getMessage());
    }

    // --- Chạy Báo cáo Ngày nếu đã đến giờ ---
    require_once __DIR__ . '/cron_daily_report.php';
    runDailyReportCron($conn);

    // --- Chạy Báo cáo Tuần nếu đã đến giờ ---
    require_once __DIR__ . '/cron_weekly_report.php';
    runWeeklyReportCron($conn);

    // --- Chạy Báo cáo Tháng nếu đã đến giờ ---
    try {
        require_once __DIR__ . '/cron_monthly_report.php';
        runMonthlyReportCron($conn);
    } catch (Exception $monthlyEx) {
        logSync("Error running monthly report from cron_sync: " . $monthlyEx->getMessage());
    }

    // --- Chạy hàng đợi đồng bộ 2 chiều (Sync Queue Worker) ---
    try {
        require_once __DIR__ . '/cron_queue_worker.php';
        processSyncQueue($conn);
    } catch (Exception $queueEx) {
        logSync("Error running sync queue from cron_sync: " . $queueEx->getMessage());
    }

    // --- Chạy tiến trình AI Pre-screener ---
    try {
        require_once __DIR__ . '/cron_ai_worker.php';
        runAIScreenerWorker($conn);
    } catch (Exception $aiEx) {
        logSync("Error running AI worker from cron_sync: " . $aiEx->getMessage());
    }

    // --- Chạy sinh công việc lặp lại định kỳ (Recurring Tasks Cron) ---
    try {
        require_once __DIR__ . '/cron_recurring_tasks.php';
        runRecurringTasksCron($conn);
    } catch (Exception $recurrenceEx) {
        logSync("Error running recurring tasks cron: " . $recurrenceEx->getMessage());
    }

    if (php_sapi_name() === 'cli') {
        $conn->close();
    }
}

