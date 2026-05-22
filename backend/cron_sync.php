<?php
// cron_sync.php
// Script to pull data from Google Sheets based on active connections

require_once __DIR__ . '/db_connect.php';

// Đặt thời gian thực thi không giới hạn để tránh timeout khi xử lý file lớn hoặc gửi nhiều Email/Zalo
set_time_limit(0);

// --- PREVENT CONCURRENT EXECUTION (CHỐNG XUNG ĐỘT) ---
$lockFile = __DIR__ . '/cron_sync.lock';
$lockFp = fopen($lockFile, 'w');
if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
    $lockMsg = "[" . date('Y-m-d H:i:s') . "] Another instance of cron_sync.php is already running. Exiting.\n";
    if (php_sapi_name() === 'cli') {
        echo $lockMsg;
        exit(0);
    } else {
        throw new Exception("Hệ thống đồng bộ đang bận (hoặc đang chạy ngầm). Vui lòng thử lại sau.");
    }
}
// --- END PREVENT CONCURRENT EXECUTION ---

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

if (!function_exists('releasePendingWorkHoursLeads')) {
    function releasePendingWorkHoursLeads($conn) {
        logSync("Checking for pending work hours leads to release...");
        
        // Select all logs pending work hours, including status and leave dates to check if they went on leave
        $sql = "SELECT dl.id as log_id, dl.lead_id, dl.assigned_to, dl.round_id, dl.message,
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
        
        while ($row = $res->fetch_assoc()) {
            $status = $row['consultant_status'];
            $leaveStart = $row['leave_start'] ?? null;
            $leaveEnd = $row['leave_end'] ?? null;
            $today = date('Y-m-d');
            
            // Check if consultant is actually on leave or inactive
            $isActuallyOnLeaveOrInactive = false;
            if ($status !== 'active') {
                $isActuallyOnLeaveOrInactive = true;
            } else if (!empty($leaveStart)) {
                if ($today >= $leaveStart && (empty($leaveEnd) || $today <= $leaveEnd)) {
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
                    
                    // Log new distribution
                    logDistribution($conn, $row['lead_id'], $assignedConsultantId, $row['round_id'], $newStatus, $logMsg);
                    
                    $conn->commit();
                    
                    // Trigger notifications out-of-transaction to avoid locking DB during API/SMTP delay
                    if ($assignedConsultantId && $newStatus !== 'pending_work_hours') {
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
                    } else if ($isFallbackAdmin && $fallbackAdminData) {
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
                        if (!empty($fallbackAdminData['zalo_chat_id'])) {
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
                            
                            // Send Zalo Message
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
                            
                            $releasedCount++;
                        }
                    } catch (Exception $e) {
                        $conn->rollback();
                        logSync("Error releasing log ID {$row['log_id']}: " . $e->getMessage());
                    }
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

logSync("Starting Google Sheets Sync Cronjob...");
releasePendingWorkHoursLeads($conn);

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
    
    // Update status to syncing
    $upStmt = $conn->prepare("UPDATE sheet_connections SET sync_status = 'syncing' WHERE id = ?");
    $upStmt->bind_param("i", $connItem['id']);
    $upStmt->execute();
    $upStmt->close();

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
                if (in_array($systemField, ['phone', 'email', 'name', 'assigned_to', 'saleperson'])) {
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
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($csvData)) {
            throw new Exception("Failed to fetch CSV. HTTP Code: $httpCode");
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

        // Prepare record statement once
        $recordStmt = $conn->prepare("INSERT IGNORE INTO sheet_sync_records (connection_id, row_hash) VALUES (?, ?)");

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

            $lockStmt = $conn->prepare("SELECT GET_LOCK(?, 10) as get_lock");
            $lockStmt->bind_param("s", $lockKey);
            $lockStmt->execute();
            $lockRes = $lockStmt->get_result()->fetch_assoc();
            $lockStmt->close();
            if ($lockRes['get_lock'] != 1) {
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
                                $cronStatus = 'assigned';
                                $cronMessage = 'No matching rule. Routed directly to fallback Admin via cron_sync: ' . $fallbackAdminData['name'];
                                $fallbackCcEmails = $fbCc;
                            }
                        }
                    } else {
                        $fbRoundId = (int)($fbSettings['fallback_round_id'] ?? 0);
                        if ($fbRoundId > 0) {
                            $targetRoundId = $fbRoundId;
                            $cronMessage = 'No matching rule found. Routed to fallback round.';
                        }
                    }
                }

                // Fetch round details (cc_emails, round_name)
                $ccEmails = '';
                $roundName = '';
                if ($targetRoundId) {
                    static $roundCache = [];
                    if (!isset($roundCache[$targetRoundId])) {
                        $rStmt = $conn->prepare("SELECT cc_emails, round_name FROM distribution_rounds WHERE id = ?");
                        $rStmt->bind_param("i", $targetRoundId);
                        $rStmt->execute();
                        $rRes = $rStmt->get_result();
                        $roundCache[$targetRoundId] = ($rRes->num_rows > 0) ? $rRes->fetch_assoc() : null;
                        $rStmt->close();
                    }
                    if ($roundCache[$targetRoundId]) {
                        $ccEmails = $roundCache[$targetRoundId]['cc_emails'] ?? '';
                        $roundName = $roundCache[$targetRoundId]['round_name'] ?? '';
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
                        if ($crmCheckResult['isDuplicate']) {
                            $ownerId = !empty($crmCheckResult['assignedTo']) ? $crmCheckResult['assignedTo'] : $assignedToId;
                            $leadId = updateLead($conn, $phone, $email, $ownerId, $source, $type, $note, $connItem['id'], null, $name);
                        } else {
                            $leadId = insertLead($conn, $rowData, $assignedToId, $phone, $email, $name, $source, $type, $note, $connItem['id']);
                        }
                        $actualOwnerId = ($crmCheckResult['isDuplicate'] && !empty($crmCheckResult['assignedTo'])) ? $crmCheckResult['assignedTo'] : $assignedToId;
                        logDistribution($conn, $leadId, $actualOwnerId, null, 'silent', 'Chỉ đồng bộ check trùng, không định tuyến.');
                        
                        $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                        $recordStmt->execute();
                        $hashMap[$rowHash] = true;
                        
                        $conn->commit();
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
                            
                            if ($cRow && $cRow['status'] === 'active') {
                                $timeline = getLeadHistoryTimeline($conn, $leadId);
                                sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline, $leadId);
                                sendLeadReminderZaloMessageToSale($ownerId, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline, $leadId, $email, $type);
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
                        logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng (đồng bộ hệ thống).');
                        
                        // Record hash so we don't spam duplicate logs on next run
                        $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                        $recordStmt->execute();
                        $hashMap[$rowHash] = true;
                        
                        $conn->commit();
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
                    
                    if ($cRow && $cRow['status'] === 'active') {
                        $timeline = getLeadHistoryTimeline($conn, $leadId);
                        sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline, $leadId);
                        sendLeadReminderZaloMessageToSale($assignedTo, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline, $leadId, $email, $type);
                    }
                    
                    continue;
                }

                // --- 3. Round-Robin Assignment & 4. Process Lead (Unified Transaction) ---
                $conn->begin_transaction();
                try {
                    if ($targetRoundId) {
                        $assignResult = getNextConsultantInRound($conn, $targetRoundId);
                        if ($assignResult) {
                            $assignedConsultantId = $assignResult['id'];
                            $cronStatus = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                            $cronMessage = $assignResult['is_compensation'] ? 'Được phân bổ đền bù lượt lỗi (đồng bộ hệ thống).' : 'Được phân bổ tự động qua vòng xoay (đồng bộ hệ thống).';

                            // Check working hours
                            $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
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
                            $whStmt->close();
                        } else {
                            $assignedConsultantId = null;
                            $cronStatus = 'pending';
                            $cronMessage = 'No active consultants in this round via cron_sync.';
                        }
                    }

                    if ($crmCheckResult['isDuplicate']) {
                        $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connItem['id'], null, $name);
                    } else {
                        $leadId = insertLead($conn, $rowData, $assignedConsultantId, $phone, $email, $name, $source, $type, $note, $connItem['id']);
                    }
                    logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, $cronStatus, $cronMessage);
                    
                    // Record hash so we don't process this row again on next cron run
                    $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                    $recordStmt->execute();
                    $hashMap[$rowHash] = true;
                    
                    $conn->commit();
                } catch (Exception $txE) {
                    $conn->rollback();
                    logSync("Transaction failed for row: " . $txE->getMessage());
                    continue;
                }

                // Notifications
                if ($isFallbackAdmin && $fallbackAdminData && !empty($leadId)) {
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
                    if (!empty($fallbackAdminData['zalo_chat_id'])) {
                        require_once __DIR__ . '/zalo_bot.php';
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
                        sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $leadId ?? 0, $assignedConsultantId ?? 0, $targetRoundId ?? 0);
                        
                        // Gửi Zalo Message (Đồng bộ Đa Kênh)
                        sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $name, $phone, $note, $source, $roundName, $leadId ?? 0, $targetRoundId ?? 0, $email, $type);
                    }
                    $syncedCount++;
                }
            } finally {
                $relStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
                if ($relStmt) {
                    $relStmt->bind_param("s", $lockKey);
                    $relStmt->execute();
                    $relStmt->close();
                }
            }
        }
        fclose($stream);
        if (isset($recordStmt)) {
            $recordStmt->close();
        }

        if ($isSilentSync || !empty($connItem['is_silent'])) {
            $conn->query("UPDATE sheet_connections SET is_initialized = 1 WHERE id = " . $connItem['id']);
            logSync("Sync initialized for Connection ID {$connItem['id']} (isSilentSync: " . ($isSilentSync ? 'yes' : 'no') . ", is_silent: " . (!empty($connItem['is_silent']) ? 'yes' : 'no') . ").");
        }

        logSync("Finished Connection ID {$connItem['id']}. Synced $syncedCount new leads.");

        // Reset status
        $upStmt = $conn->prepare("UPDATE sheet_connections SET last_sync_at = NOW(), sync_status = 'idle' WHERE id = ?");
        $upStmt->bind_param("i", $connItem['id']);
        $upStmt->execute();
        $upStmt->close();

    } catch (Exception $e) {
        logSync("Error processing ID {$connItem['id']}: " . $e->getMessage());
        $upStmt = $conn->prepare("UPDATE sheet_connections SET sync_status = 'error' WHERE id = ?");
        $upStmt->bind_param("i", $connItem['id']);
        $upStmt->execute();
        $upStmt->close();
    }
}

logSync("Cronjob finished.");

// --- Chạy Báo cáo Ngày nếu đã đến giờ ---
require_once __DIR__ . '/cron_daily_report.php';
runDailyReportCron($conn);

// --- Chạy Báo cáo Tuần nếu đã đến giờ ---
require_once __DIR__ . '/cron_weekly_report.php';
runWeeklyReportCron($conn);

$conn->close();

