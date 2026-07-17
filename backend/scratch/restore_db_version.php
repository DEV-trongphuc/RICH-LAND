<?php
// d:\RICH_LAND_DATA_UI\backend\scratch\restore_db_version.php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "=== COLUMNS OF system_settings ===\n";
    $stmt = $db->query("DESCRIBE system_settings");
    print_r($stmt->fetchAll());
    
    echo "=== INSERTING db_version = 160 ===\n";
    $db->exec("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '160') ON DUPLICATE KEY UPDATE setting_value = '160'");
    echo "SUCCESS!\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
