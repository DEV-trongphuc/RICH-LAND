<?php
header('Content-Type: text/plain; charset=utf-8');
require_once 'config.php';
require_once 'config/Database.php';

try {
    $db = Database::getInstance();
    $stmt = $db->query("SHOW COLUMNS FROM deals");
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cols as $col) {
        echo "Field: {$col['Field']} | Type: {$col['Type']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
