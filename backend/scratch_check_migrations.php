<?php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "=== COLUMNS OF USERS ===\n";
    $stmt = $db->query("DESCRIBE users");
    print_r($stmt->fetchAll());

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
