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
    echo "[" . date('Y-m-d H:i:s') . "] Another instance of cron_sync.php is already running. Exiting.\n";
    exit(0);
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

logSync("Starting Google Sheets Sync Cronjob...");

// Get active connections
$sql = "SELECT * FROM sheet_connections WHERE is_active = 1";
$params = [];
$types = "";

// Check if a specific connection ID was passed via CLI argument
if (isset($argv[1]) && is_numeric($argv[1])) {
    $sql .= " AND id = ?";
    $params[] = (int)$argv[1];
    $types .= "i";
}

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$connections = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

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

    try {
        // Fetch field mappings
        $mapStmt = $conn->prepare("SELECT sheet_column, system_field, custom_label FROM field_mappings WHERE connection_id = ?");
        $mapStmt->bind_param("i", $connItem['id']);
        $mapStmt->execute();
        $mappingsResult = $mapStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        
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
                // For phone, email, name: return the raw value directly to keep it clean.
                // For other fields (note, type, source): always keep the Label: Value format so it goes to a new line nicely.
                if (count($values) === 1 && in_array($systemField, ['phone', 'email', 'name'])) {
                    $colName = $mappingsArray[$systemField][0]['sheet_column'];
                    return $data[$colName] ?? '';
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
            if (checkGlobalExclusion($conn, $rowData, $phone, $email)) {
                // Record hash so we don't process this blacklisted row again
                $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                $recordStmt->execute();
                $hashMap[$rowHash] = true;
                continue;
            }

            // --- 1. Check CRM (Duplication & 6-month rule) ---
            $crmCheckResult = checkCRMInteraction($conn, $phone, $email);

            if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < 6 && !empty($crmCheckResult['assignedTo'])) {
                // Duplicate < 6 months, skip assigning to new round but update last interaction
                $assignedTo = $crmCheckResult['assignedTo'];
                
                $conn->begin_transaction();
                try {
                    $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note);
                    logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Khách cũ đăng ký lại < 6 tháng via cron_sync.');
                    
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
                
                // Notify the old consultant (Align with webhook)
                static $consultantCache = [];
                if (!isset($consultantCache[$assignedTo])) {
                    $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                    $stmtC->bind_param("i", $assignedTo);
                    $stmtC->execute();
                    $consultantCache[$assignedTo] = $stmtC->get_result()->fetch_assoc();
                }
                $cRow = $consultantCache[$assignedTo];
                
                if ($cRow) {
                    sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source);
                    sendLeadReminderZaloMessageToSale($assignedTo, $cRow['name'], $name, $phone, $note, $source);
                }
                
                continue;
            }

            // --- 2. Evaluate Dynamic Rules to determine Target Round ---
            $ruleResult = evaluateRules($conn, $rowData, $source, $type);
            $targetRoundId = null;
            $assignedConsultantId = null;
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

            if ($targetRoundId) {
                // --- 3. Round-Robin Assignment ---
                $assignResult = getNextConsultantInRound($conn, $targetRoundId);
                if ($assignResult) {
                    $assignedConsultantId = $assignResult['id'];
                    $cronStatus = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                    $cronMessage = $assignResult['is_compensation'] ? 'Assigned via compensation via cron_sync.' : 'Assigned via round-robin via cron_sync.';
                } else {
                    $assignedConsultantId = null;
                    $cronStatus = 'pending';
                    $cronMessage = 'No active consultants in this round via cron_sync.';
                }
            }

            // --- 4. Process new Lead and Log Distribution (always save lead) ---
            $conn->begin_transaction();
            try {
                if ($crmCheckResult['isDuplicate']) {
                    $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connItem['id']);
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
                        $source
                    );
                }
                $syncedCount++;
            } else if (($cronStatus === 'assigned' || $cronStatus === 'compensation') && !empty($leadId) && $assignedConsultantId) {
                // Notify Sale (mailer.php already loaded above)
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
                    }
                    if ($roundCache[$targetRoundId]) {
                        $ccEmails = $roundCache[$targetRoundId]['cc_emails'] ?? '';
                        $roundName = $roundCache[$targetRoundId]['round_name'] ?? '';
                    }
                }
                
                static $assignedConsultantCache = [];
                if (!isset($assignedConsultantCache[$assignedConsultantId])) {
                    $stmtC2 = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ?");
                    $stmtC2->bind_param("i", $assignedConsultantId);
                    $stmtC2->execute();
                    $assignedConsultantCache[$assignedConsultantId] = $stmtC2->get_result()->fetch_assoc();
                }
                $c = $assignedConsultantCache[$assignedConsultantId];
                
                if ($c) {
                    // Gửi Email
                    sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $leadId ?? 0, $assignedConsultantId ?? 0, $targetRoundId ?? 0);
                    
                    // Gửi Zalo Message (Đồng bộ Đa Kênh)
                    sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $name, $phone, $note, $source, $roundName, $leadId ?? 0, $targetRoundId ?? 0);
                }
                $syncedCount++;
            }
        }
        fclose($stream);

        if ($isSilentSync) {
            $conn->query("UPDATE sheet_connections SET is_initialized = 1 WHERE id = " . $connItem['id']);
            logSync("Silent Sync completed for Connection ID {$connItem['id']}. Hashed existing rows, skipped distribution.");
        }

        logSync("Finished Connection ID {$connItem['id']}. Synced $syncedCount new leads.");

        // Reset status
        $upStmt = $conn->prepare("UPDATE sheet_connections SET last_sync_at = NOW(), sync_status = 'idle' WHERE id = ?");
        $upStmt->bind_param("i", $connItem['id']);
        $upStmt->execute();

    } catch (Exception $e) {
        logSync("Error processing ID {$connItem['id']}: " . $e->getMessage());
        $upStmt = $conn->prepare("UPDATE sheet_connections SET sync_status = 'error' WHERE id = ?");
        $upStmt->bind_param("i", $connItem['id']);
        $upStmt->execute();
    }
}

logSync("Cronjob finished.");

