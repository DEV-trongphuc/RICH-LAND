<?php
// d:\RICH_LAND_DATA_UI\backend\scratch\check_users.php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    $users = $db->query("SELECT id, email, full_name, role FROM users")->fetchAll();
    echo "=== USERS CURRENTLY IN DB ===\n";
    print_r($users);
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
