<?php
header('Content-Type: text/plain; charset=utf-8');
require_once 'config.php';
require_once 'config/Database.php';

try {
    $db = Database::getInstance();
    $stmt = $db->query("SELECT id, user_id, title, body, type, link, created_at FROM notifications ORDER BY id DESC LIMIT 15");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "ID: {$row['id']} | UserID: {$row['user_id']} | Title: {$row['title']} | Body: {$row['body']} | Type: {$row['type']} | Link: {$row['link']} | CreatedAt: {$row['created_at']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
