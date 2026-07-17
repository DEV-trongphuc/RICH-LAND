<?php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "=== INSERTING DB_VERSION = 159 ===\n";
    $db->exec("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '159') ON DUPLICATE KEY UPDATE setting_value = '159'");
    $db->exec("INSERT INTO system_settings (setting_key, setting_value) VALUES ('lead_response_timeout_minutes', '2') ON DUPLICATE KEY UPDATE setting_value = '2'");

    echo "=== SYSTEM SETTINGS ===\n";
    $stmt = $db->query("SELECT * FROM system_settings");
    print_r($stmt->fetchAll());

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
