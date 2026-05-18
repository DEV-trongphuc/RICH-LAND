<?php
// cron_sync.php
// Script to pull data from Google Sheets based on active connections

require_once __DIR__ . '/db_connect.php';

// Helper for routing
require_once __DIR__ . '/webhook_logic.php'; // We will extract routing logic into a separate file or just redefine them if not too complex. But better to extract.

function logSync($msg) {
    echo "[" . date('Y-m-d H:i:s') . "] " . $msg . "\n";
}

logSync("Starting Google Sheets Sync Cronjob...");

// Get active connections
$stmt = $conn->prepare("SELECT * FROM sheet_connections WHERE is_active = 1");
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
        $mapStmt = $conn->prepare("SELECT sheet_column, system_field FROM field_mappings WHERE connection_id = ?");
        $mapStmt->bind_param("i", $connItem['id']);
        $mapStmt->execute();
        $mappingsResult = $mapStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        
        $mappings = [];
        foreach ($mappingsResult as $row) {
            $sysField = $row['system_field'];
            if (!isset($mappings[$sysField])) {
                $mappings[$sysField] = [];
            }
            $mappings[$sysField][] = $row['sheet_column'];
        }

        // Helper function for extraction
        if (!function_exists('extractMappedValues')) {
            function extractMappedValues($mappingsArray, $systemField, $data) {
                if (!isset($mappingsArray[$systemField])) return '';
                $values = [];
                foreach ($mappingsArray[$systemField] as $colName) {
                    if (isset($data[$colName]) && $data[$colName] !== '') {
                        $values[] = $colName . ': ' . $data[$colName];
                    }
                }
                if (count($values) === 1 && $systemField !== 'note') {
                    $colName = $mappingsArray[$systemField][0];
                    return $data[$colName] ?? '';
                }
                return implode("\n", $values);
            }
        }

        // Fetch CSV from Google Sheets using gviz/tq
        $csvUrl = "https://docs.google.com/spreadsheets/d/" . trim($connItem['spreadsheet_id']) . "/gviz/tq?tqx=out:csv";
        
        $ch = curl_init($csvUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($csvData)) {
            throw new Exception("Failed to fetch CSV. HTTP Code: $httpCode");
        }

        // Parse CSV
        $lines = explode("\n", $csvData);
        $headers = [];
        $syncedCount = 0;

        foreach ($lines as $i => $line) {
            $row = str_getcsv($line);
            if ($i === 0) {
                // Headers
                $headers = array_map(function($h) { return trim($h, "\" "); }, $row);
                continue;
            }

            if (empty(array_filter($row))) continue; // skip empty rows

            $rowData = [];
            foreach ($headers as $colIdx => $colName) {
                $rowData[$colName] = trim($row[$colIdx] ?? '', "\" ");
            }

            // Extract fields based on mapping
            $phone = extractMappedValues($mappings, 'phone', $rowData);
            $email = extractMappedValues($mappings, 'email', $rowData);
            $source = extractMappedValues($mappings, 'source', $rowData);
            $type = extractMappedValues($mappings, 'type', $rowData);
            $note = extractMappedValues($mappings, 'note', $rowData);
            $name = extractMappedValues($mappings, 'name', $rowData);

            if (empty($phone) && empty($email)) {
                continue; // Cannot sync without phone or email
            }

            // --- 1. Check CRM (Duplication & 6-month rule) ---
            $crmCheckResult = checkCRMInteraction($conn, $phone, $email);

            if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < 6) {
                // Duplicate < 6 months, skip assigning to new round but update last interaction
                $assignedTo = $crmCheckResult['assignedTo'];
                $leadId = updateLead($conn, $phone, $email, $assignedTo);
                logDistribution($conn, $leadId, $assignedTo, null, 'duplicate', 'Duplicate < 6 months via cron_sync.');
                continue;
            }

            // --- 2. Evaluate Dynamic Rules to determine Target Round ---
            $targetRoundId = evaluateRules($conn, $rowData, $source, $type);

            if (!$targetRoundId) {
                logDistribution($conn, null, null, null, 'unassigned', 'No matching rule found via cron_sync.');
                continue;
            }

            // --- 3. Round-Robin Assignment ---
            $assignedConsultantId = getNextConsultantInRound($conn, $targetRoundId);

            if (!$assignedConsultantId) {
                logDistribution($conn, null, null, $targetRoundId, 'pending', 'No active consultants in this round via cron_sync.');
                continue;
            }

            // --- 4. Process new Lead and Log Distribution ---
            if ($crmCheckResult['isDuplicate']) {
                $leadId = updateLead($conn, $phone, $email, $assignedConsultantId);
            } else {
                $leadId = insertLead($conn, $rowData, $assignedConsultantId, $phone, $email, $name);
            }

            logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, 'assigned', 'Assigned via round-robin via cron_sync.');

            // Notify Sale
            require_once __DIR__ . '/mailer.php';
            
            $ccEmails = '';
            if ($targetRoundId) {
                $qRound = $conn->query("SELECT cc_emails FROM distribution_rounds WHERE id = $targetRoundId");
                if ($qRound && $qRound->num_rows > 0) {
                    $ccEmails = $qRound->fetch_assoc()['cc_emails'] ?? '';
                }
            }
            
            $cStmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
            $cStmt->bind_param("i", $assignedConsultantId);
            $cStmt->execute();
            $cRes = $cStmt->get_result();
            if ($cRes->num_rows > 0) {
                $c = $cRes->fetch_assoc();
                sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails);
            }

            $syncedCount++;
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

