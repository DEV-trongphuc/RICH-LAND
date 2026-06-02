<?php
// cron_sync.php
// Script to pull data from Google Sheets based on active connections

require_once __DIR__ . '/db_connect.php';

// Đặt thời gian thực thi không giới hạn để tránh timeout khi xử lý file lớn hoặc gửi nhiều Email/Zalo
set_time_limit(0);

// --- PREVENT CONCURRENT EXECUTION (CHỐNG XUNG ĐỘT) ---
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
// --- END PREVENT CONCURRENT EXECUTION ---

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
        $sql = "SELECT dl.id as log_id, dl.lead_id, dl.assigned_to, dl.round_id, dl.message, COALESCE(dl.received_at, NOW()) AS received_at,
                       l.name as lead_name, l.phone as lead_phone, l.email as lead_email,
                       l.source as lead_source, l.type as lead_type, l.note as lead_note,
                       c.name as consultant_name, c.email as consultant_email, c.work_start_time, c.work_end_time, c.work_schedule,
                       c.status as consultant_status, c.leave_start, c.leave_end,
                       r.round_name, r.cc_emails
                FROM distribution_logs dl
                JOIN leads l ON dl.lead_id = l.id
                JOIN consultants c ON dl.assigned_to = c.id
                LEFT JOIN distribution_rounds r ON dl.round_id = r.id
                WHERE dl.status = 'pending_work_hours'";
                
        $res = $conn->query($sql);
        if (!$res) {
            logSync("Error querying pending work hours leads.");
            return;
        }
        
        $currentTime = date('H:i');
        $releasedCount = 0;
        $readyToRelease = [];
        
        while ($row = $res->fetch_assoc()) {
            $status = $row['consultant_status'];
            $leaveStart = $row['leave_start'] ?? null;
            $leaveEnd = $row['leave_end'] ?? null;
            $today = date('Y-m-d');
            
            // Check if consultant is actually on leave or inactive
            $isActuallyOnLeaveOrInactive = false;
            if ($status !== 'active') {
                $isActuallyOnLeaveOrInactive = true;
            } else if (!empty($leaveStart) && !empty($leaveEnd)) {
                if ($today >= $leaveStart && $today <= $leaveEnd) {
                    $isActuallyOnLeaveOrInactive = true;
                }
            }
            
            if ($isActuallyOnLeaveOrInactive) {
                logSync("Lead ID {$row['lead_id']} assigned to {$row['consultant_name']} who is on leave or inactive. Reallocating...");
                
                $conn->begin_transaction();
                try {
                    $assignedConsultantId = null;
                    $newStatus = 'assigned';
                    $logMsg = "Thu hồi từ Sale nghỉ phép/không hoạt động ({$row['consultant_name']}). ";
                    $isFallbackAdmin = false;
                    $fallbackAdminData = null;
                    $fallbackCcEmails = '';
                    $newConsultantName = '';
                    $newConsultantEmail = '';
                    
                    if ($row['round_id'] > 0) {
                        $assignResult = getNextConsultantInRound($conn, $row['round_id']);
                        if ($assignResult) {
                            $assignedConsultantId = $assignResult['id'];
                            $newStatus = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                        }
                    }
                    
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
                                $logMsg .= "Gán cho Sale mới: {$whRow['name']} (Chờ ngoài giờ làm việc).";
                            } else {
                                $logMsg .= "Tái phân bổ thành công cho Sale mới: {$whRow['name']}.";
                            }
                            $newConsultantName = $whRow['name'];
                            $newConsultantEmail = $whRow['email'];
                        }
                        $whStmt->close();
                    } else {
                        // Fallback to Admin
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
                            $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND role = 'admin' LIMIT 1");
                            $admStmt->bind_param("i", $fbAdminId);
                            $admStmt->execute();
                            $admRes = $admStmt->get_result();
                            if ($admRes->num_rows > 0) {
                                $fallbackAdminData = $admRes->fetch_assoc();
                                $isFallbackAdmin = true;
                                $newStatus = 'assigned';
                                $logMsg .= "Không có Sale hoạt động khác trong vòng, chuyển fallback về Admin: " . $fallbackAdminData['name'];
                                $fallbackCcEmails = $fbCc;
                            }
                            $admStmt->close();
                        } else {
                            $newStatus = 'pending';
                            $logMsg .= "Không có Sale hoạt động khác trong vòng hoặc Admin fallback. Lead chuyển về Chờ xử lý.";
                        }
                    }
                    
                    // Update lead table
                    $upLead = $conn->prepare("UPDATE leads SET assigned_to = ? WHERE id = ?");
                    $upLead->bind_param("ii", $assignedConsultantId, $row['lead_id']);
                    $upLead->execute();
                    $upLead->close();
                    
                    // Revoke old distribution log
                    $upLog = $conn->prepare("UPDATE distribution_logs SET status = 'reallocated', message = CONCAT(message, '\n[Thu hồi do Sale nghỉ phép lúc ', NOW(), ']') WHERE id = ?");
                    $upLog->bind_param("i", $row['log_id']);
                    $upLog->execute();
                    $upLog->close();

                    // Bù lead cho Sale bị thu hồi (tăng compensation_count lên 1) để đảm bảo "Bù lead đồ đầy đủ"
                    if ($row['round_id'] > 0) {
                        $compUpStmt = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                        $compUpStmt->bind_param("ii", $row['round_id'], $row['assigned_to']);
                        $compUpStmt->execute();
                        $compUpStmt->close();
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
                    $readyToRelease[$row['assigned_to']][] = $row;
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
        
        // Query all leads that have been assigned but not yet accepted, joining sheet_connections to check their specific recall duration
        $sql = "SELECT l.id as lead_id, l.name as lead_name, l.phone as lead_phone, l.email as lead_email,
                       l.source as lead_source, l.type as lead_type, l.note as lead_note,
                       l.assigned_to as old_consultant_id, l.connection_id,
                       c.name as old_consultant_name, c.email as old_consultant_email,
                       sc.lead_recall_minutes
                FROM leads l
                JOIN consultants c ON l.assigned_to = c.id
                JOIN sheet_connections sc ON l.connection_id = sc.id
                WHERE l.is_accepted = 0
                  AND l.assigned_to IS NOT NULL
                  AND sc.lead_recall_minutes > 0
                  AND l.last_interaction_date <= DATE_SUB(NOW(), INTERVAL sc.lead_recall_minutes MINUTE)
                ORDER BY l.id ASC";
                
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            logSync("Error preparing recall query.");
            return;
        }
        $stmt->execute();
        $res = $stmt->get_result();
        $leads = $res->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        if (empty($leads)) {
            logSync("No inactive unaccepted leads found.");
            return;
        }

        logSync("Found " . count($leads) . " unaccepted leads that exceeded the recall threshold.");

        foreach ($leads as $row) {
            $leadId = $row['lead_id'];
            $oldConsultantId = $row['old_consultant_id'];
            $oldConsultantName = $row['old_consultant_name'];

            $conn->begin_transaction();
            try {
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

                // 2. Increment compensation count for the lazy consultant in that round
                if ($roundId > 0) {
                    $chkComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                    $chkComp->bind_param("ii", $roundId, $oldConsultantId);
                    $chkComp->execute();
                    $chkComp->close();
                }

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
                        $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND role = 'admin' LIMIT 1");
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
                $logMsg = "Tái phân bổ tự động do Sale {$oldConsultantName} không tiếp nhận.";
                if ($isFallbackAdmin && $fallbackAdminData) {
                    $logMsg = "Thu hồi từ Sale {$oldConsultantName} và chuyển fallback về Admin: " . $fallbackAdminData['name'];
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
                                   . "Trân trọng,\nHệ thống Quản lý Domation DATA\n"
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
                // For unique/specific system fields, return the raw value directly of the first matched non-empty column to keep it clean and prevent corruption.
                if (in_array($systemField, ['phone', 'email', 'name', 'source', 'type', 'assigned_to', 'saleperson'])) {
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
                                $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND role = 'admin' LIMIT 1");
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

logSync("Cronjob finished.");

// --- Chạy Báo cáo Ngày nếu đã đến giờ ---
require_once __DIR__ . '/cron_daily_report.php';
runDailyReportCron($conn);

// --- Chạy Báo cáo Tuần nếu đã đến giờ ---
require_once __DIR__ . '/cron_weekly_report.php';
runWeeklyReportCron($conn);

// --- Chạy hàng đợi đồng bộ 2 chiều (Sync Queue Worker) ---
try {
    require_once __DIR__ . '/cron_queue_worker.php';
    processSyncQueue($conn);
} catch (Exception $queueEx) {
    logSync("Error running sync queue from cron_sync: " . $queueEx->getMessage());
}

if (php_sapi_name() === 'cli') {
    $conn->close();
}

