<?php
// backend/scratch_migrate_sources.php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

$updates = [
    'Facebook Ads - Form' => [30163, 30162],
    'Website IDEAS' => [4893],
    'Hotline' => [4895],
    'Messenger' => [4918]
];

echo "=== MIGRATING LEAD SOURCES ===\n";

foreach ($updates as $source => $ids) {
    foreach ($ids as $id) {
        // Query current source to check if it actually needs updating
        $stmt = $conn->prepare("SELECT source FROM leads WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $currentSource = null;
        if ($res && $res->num_rows > 0) {
            $currentSource = $res->fetch_assoc()['source'];
        }
        $stmt->close();

        if ($currentSource === null) {
            echo "Lead ID: #$id | NOT FOUND in database.\n";
            continue;
        }

        if ($currentSource === $source) {
            echo "Lead ID: #$id | Source is already '{$source}'. Checking sync queue...\n";
            // Still trigger two-way sync just in case sheet has old value
            if (function_exists('triggerTwoWaySync')) {
                $triggered = triggerTwoWaySync($conn, $id);
                echo "  -> Triggered Google Sheets sync queue: " . ($triggered ? "SUCCESS" : "NO SYNC NEEDED (or disabled)") . "\n";
            }
            continue;
        }

        // Update lead source in database
        $upStmt = $conn->prepare("UPDATE leads SET source = ? WHERE id = ?");
        $upStmt->bind_param("si", $source, $id);
        if ($upStmt->execute()) {
            $affected = $upStmt->affected_rows;
            echo "Lead ID: #$id | Updated source from '{$currentSource}' to '{$source}' (Affected rows: {$affected}).\n";
            
            // Trigger Google Sheets sync
            if (function_exists('triggerTwoWaySync')) {
                $triggered = triggerTwoWaySync($conn, $id);
                echo "  -> Triggered Google Sheets sync queue: " . ($triggered ? "SUCCESS" : "NO SYNC NEEDED (or disabled)") . "\n";
            }
        } else {
            echo "Lead ID: #$id | Failed to update source: " . $upStmt->error . "\n";
        }
        $upStmt->close();
    }
}

echo "\nMigration run complete. If sync queue was triggered, the cron queue worker will sync changes to Google Sheets.\n";
?>
