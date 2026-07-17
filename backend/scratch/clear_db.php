<?php
// d:\RICH_LAND_DATA_UI\backend\scratch\clear_db.php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    // Get all base tables
    $stmt = $db->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    $tables = [];
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        $tables[] = $row[0];
    }
    
    echo "=== TRUNCATING TABLES EXCEPT users AND tenants ===\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 0;");
    
    foreach ($tables as $table) {
        if ($table === 'users' || $table === 'tenants') {
            echo "Skipping table: $table\n";
            continue;
        }
        $db->exec("TRUNCATE TABLE `$table`\n");
        echo "Truncated table: $table\n";
    }
    
    $db->exec("SET FOREIGN_KEY_CHECKS = 1;");
    echo "=== DATABASE CLEARED SUCCESSFULLY ===\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
