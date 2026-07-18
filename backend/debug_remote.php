<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    $stmt = $db->prepare("SELECT id, username, role, permissions_json FROM users WHERE id = 1000");
    $stmt->execute();
    $user = $stmt->fetch();

    $stmt2 = $db->prepare("SELECT id, first_name, last_name, owner_id, collaborator_ids, tenant_id, pipeline_status FROM contacts WHERE first_name LIKE '%Phúc%' OR last_name LIKE '%Hoàng%'");
    $stmt2->execute();
    $contacts = $stmt2->fetchAll();

    echo json_encode(['user' => $user, 'contacts' => $contacts]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
