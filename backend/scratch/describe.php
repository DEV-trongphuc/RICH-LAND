<?php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "=== COLUMNS OF CONSULTANTS ===\n";
    $stmt = $db->query("DESCRIBE `consultants`");
    print_r($stmt->fetchAll());

    echo "=== SAMPLE OF CONSULTANTS ===\n";
    $stmt = $db->query("SELECT * FROM `consultants` LIMIT 5");
    print_r($stmt->fetchAll());

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
