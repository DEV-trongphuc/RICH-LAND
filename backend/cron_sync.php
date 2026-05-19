<?php
// cron_sync.php
// Script to pull data from Google Sheets based on active connections

require_once __DIR__ . '/db_connect.php';

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

        // Parse CSV robustly using in-memory stream to handle newlines within quotes correctly
        $stream = fopen("php://temp", "r+");
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

            // --- 1. Check CRM (Duplication & 6-month rule) ---
            $crmCheckResult = checkCRMInteraction($conn, $phone, $email);

            if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < 6 && !empty($crmCheckResult['assignedTo'])) {
                // Duplicate < 6 months, skip assigning to new round but update last interaction
                $assignedTo = $crmCheckResult['assignedTo'];
                $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note);
                logDistribution($conn, $leadId, $assignedTo, null, 'duplicate', 'Duplicate < 6 months via cron_sync.');
                
                // Record hash so we don't spam duplicate logs on next run
                $recordStmt->bind_param("is", $connItem['id'], $rowHash);
                $recordStmt->execute();
                $hashMap[$rowHash] = true;
                
                continue;
            }

            // --- 2. Evaluate Dynamic Rules to determine Target Round ---
            $targetRoundId = evaluateRules($conn, $rowData, $source, $type);
            $assignedConsultantId = null;
            $cronStatus = 'unassigned';
            $cronMessage = 'No matching rule found via cron_sync.';

            if ($targetRoundId) {
                // --- 3. Round-Robin Assignment ---
                $assignedConsultantId = getNextConsultantInRound($conn, $targetRoundId);
                if ($assignedConsultantId) {
                    $cronStatus = 'assigned';
                    $cronMessage = 'Assigned via round-robin via cron_sync.';
                } else {
                    $cronStatus = 'pending';
                    $cronMessage = 'No active consultants in this round via cron_sync.';
                }
            }

            // --- 4. Process new Lead and Log Distribution (always save lead) ---
            $conn->begin_transaction();
            try {
                if ($crmCheckResult['isDuplicate']) {
                    $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note);
                } else {
                    $leadId = insertLead($conn, $rowData, $assignedConsultantId, $phone, $email, $name, $source, $type, $note);
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

            // Only notify sale when successfully assigned
            if ($cronStatus === 'assigned' && !empty($leadId)) {
                // Notify Sale (mailer.php already loaded above)
                $ccEmails = '';
                $roundName = '';
                if ($targetRoundId) {
                    $qRoundStmt = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
                    $qRoundStmt->bind_param("i", $targetRoundId);
                    $qRoundStmt->execute();
                    $qRound = $qRoundStmt->get_result();
                    if ($qRound && $qRound->num_rows > 0) {
                        $rRow = $qRound->fetch_assoc();
                        $ccEmails = $rRow['cc_emails'] ?? '';
                        $roundName = $rRow['round_name'] ?? '';
                    }
                }
                $cStmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                $cStmt->bind_param("i", $assignedConsultantId);
                $cStmt->execute();
                $cRes = $cStmt->get_result();
                if ($cRes->num_rows > 0) {
                    $c = $cRes->fetch_assoc();
                    
                    // Gửi Email
                    sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $leadId ?? 0, $assignedConsultantId ?? 0, $targetRoundId ?? 0);
                    
                    // Gửi Zalo Message (Đồng bộ Đa Kênh)
                    require_once __DIR__ . '/zalo_bot.php';
                    sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $name, $phone, $note, $source, $roundName, $leadId ?? 0, $targetRoundId ?? 0);
                }
                $syncedCount++;
            }
        }
        fclose($stream);

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

