<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'config.php';
require_once 'config/Database.php';

try {
    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT * FROM activities WHERE id = ?");
    $stmt->execute([19763]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($row, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
