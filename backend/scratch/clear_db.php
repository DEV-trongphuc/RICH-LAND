<?php
// D:\RICH_LAND_DATA_UI\backend\scratch\clear_db.php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "=== DISABLING FOREIGN KEY CHECKS ===\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");

    // Fetch all tables dynamically
    $stmt = $db->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $keepTables = ['users', 'accounts', 'consultants', 'schema_migrations'];

    foreach ($tables as $table) {
        if (in_array($table, $keepTables)) {
            continue;
        }
        echo "Truncating table `$table`...\n";
        try {
            $db->exec("TRUNCATE TABLE `$table`");
        } catch (Exception $ex) {
            echo "Error truncating `$table`: " . $ex->getMessage() . ". Trying DELETE...\n";
            try {
                $db->exec("DELETE FROM `$table`");
            } catch (Exception $ex2) {
                echo "Failed to DELETE `$table`: " . $ex2->getMessage() . "\n";
            }
        }
    }

    $allowedUserIds = [2713, 2712, 999, 1002, 1000, 1001];
    $allowedUserIdsStr = implode(',', $allowedUserIds);

    echo "Cleaning `users` table, keeping only IDs: $allowedUserIdsStr...\n";
    try {
        $db->exec("DELETE FROM `users` WHERE id NOT IN ($allowedUserIdsStr)");
    } catch (Exception $e) {
        echo "Error cleaning `users`: " . $e->getMessage() . "\n";
    }

    echo "Cleaning `accounts` table, keeping only IDs: $allowedUserIdsStr...\n";
    try {
        $db->exec("DELETE FROM `accounts` WHERE id NOT IN ($allowedUserIdsStr)");
    } catch (Exception $e) {
        echo "Error cleaning `accounts` (expected if view): " . $e->getMessage() . "\n";
    }

    echo "Cleaning `consultants` table, keeping only IDs: $allowedUserIdsStr...\n";
    try {
        $db->exec("DELETE FROM `consultants` WHERE id NOT IN ($allowedUserIdsStr)");
    } catch (Exception $e) {
        echo "Error cleaning `consultants` (expected if view): " . $e->getMessage() . "\n";
    }

    echo "=== ENABLING FOREIGN KEY CHECKS ===\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 1");

    echo "=== DATABASE FULL RESET COMPLETED SUCCESSFULLY ===\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
