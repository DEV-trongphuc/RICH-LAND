<?php
// backend/scratch_migrate_by_log_ids.php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

header("Content-Type: text/plain; charset=utf-8");

$updates = [
    'Facebook Ads - Form' => [30163, 30162],
    'Website IDEAS' => [4893],
    'Hotline' => [4895],
    'Messenger' => [4918]
];

echo "=== MIGRATING SOURCES BY LOG IDs (UI IDs) ===\n\n";

foreach ($updates as $source => $logIds) {
    foreach ($logIds as $logId) {
        // Find actual lead_id from distribution_logs
        $stmt = $conn->prepare("SELECT lead_id FROM distribution_logs WHERE id = ?");
        $stmt->bind_param("i", $logId);
        $stmt->execute();
        $res = $stmt->get_result();
        $leadId = null;
        if ($res && $res->num_rows > 0) {
            $leadId = $res->fetch_assoc()['lead_id'];
        }
        $stmt->close();

        if (!$leadId) {
            echo "UI ID (Log ID): #$logId | NOT FOUND in distribution_logs table.\n";
            continue;
        }

        // Fetch current source
        $stmt = $conn->prepare("SELECT name, source FROM leads WHERE id = ?");
        $stmt->bind_param("i", $leadId);
        $stmt->execute();
        $res = $stmt->get_result();
        $leadName = '';
        $currentSource = null;
        if ($res && $res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $leadName = $row['name'];
            $currentSource = $row['source'];
        }
        $stmt->close();

        if ($currentSource === null) {
            echo "UI ID: #$logId (Lead ID: #$leadId) | Lead not found in leads table.\n";
            continue;
        }

        if ($currentSource === $source) {
            echo "UI ID: #$logId (Lead ID: #$leadId) | Source is already '{$source}'. Checking sync queue...\n";
            if (function_exists('triggerTwoWaySync')) {
                $triggered = triggerTwoWaySync($conn, $leadId);
                echo "  -> Triggered Google Sheets sync queue: " . ($triggered ? "SUCCESS" : "NO SYNC NEEDED (or disabled)") . "\n";
            }
            continue;
        }

        // Update database source
        $upStmt = $conn->prepare("UPDATE leads SET source = ? WHERE id = ?");
        $upStmt->bind_param("si", $source, $leadId);
        if ($upStmt->execute()) {
            $affected = $upStmt->affected_rows;
            echo "UI ID: #$logId (Lead ID: #$leadId, Name: '{$leadName}') | Updated source from '{$currentSource}' to '{$source}' (Affected rows: {$affected}).\n";
            
            // Trigger sync
            if (function_exists('triggerTwoWaySync')) {
                $triggered = triggerTwoWaySync($conn, $leadId);
                echo "  -> Triggered Google Sheets sync queue: " . ($triggered ? "SUCCESS" : "NO SYNC NEEDED (or disabled)") . "\n";
            }
        } else {
            echo "UI ID: #$logId (Lead ID: #$leadId) | Failed to update database source: " . $upStmt->error . "\n";
        }
        $upStmt->close();
    }
}

echo "\nMigration run complete. If sync queue was triggered, the cron queue worker will sync changes to Google Sheets.\n";
?>
