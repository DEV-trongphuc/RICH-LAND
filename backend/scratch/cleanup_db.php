<?php
// backend/scratch/cleanup_db.php
require_once __DIR__ . '/../db_connect.php';

try {
    echo "=== STARTING DATABASE CLEANUP ===\n";

    $conn->query("SET FOREIGN_KEY_CHECKS = 0;");

    // List of system tables to preserve (do not truncate/delete)
    $preserveTables = [
        'system_settings',
        'schema_migrations',
        'pipeline_stages',
        'tenants'
    ];

    $tablesResult = $conn->query("SHOW TABLES");
    while ($row = $tablesResult->fetch_row()) {
        $tableName = $row[0];
        
        // Skip views
        if ($tableName === 'accounts' || $tableName === 'consultants') {
            continue;
        }

        if (in_array($tableName, $preserveTables, true)) {
            echo "Preserving system table: $tableName\n";
            continue;
        }

        if ($tableName === 'users') {
            // Delete non-demo users
            $conn->query("DELETE FROM users WHERE id NOT IN (999, 1000, 1001, 1002)");
            // Ensure team_id is null for these 4 users since teams are deleted
            $conn->query("UPDATE users SET team_id = NULL WHERE id IN (999, 1000, 1001, 1002)");
            echo "Cleaned table: users (kept exactly 4 demo accounts)\n";
        } else {
            // Truncate other tables
            $conn->query("TRUNCATE TABLE `$tableName`");
            // If Truncate fails or is blocked, try DELETE
            if ($conn->errno) {
                $conn->query("DELETE FROM `$tableName`");
                echo "Deleted all rows from: $tableName\n";
            } else {
                echo "Truncated table: $tableName\n";
            }
        }
    }

    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");
    echo "=== DATABASE CLEANUP COMPLETED SUCCESSFULLY ===\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
