<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'config.php';
require_once 'config/Database.php';

try {
    $db = Database::getInstance();
    $stmt = $db->query("SELECT id, user_id, title, body, type, link, created_at FROM notifications WHERE user_id = 1007 AND type = 'mention' ORDER BY id DESC LIMIT 5");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
