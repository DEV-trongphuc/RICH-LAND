<?php
header('Content-Type: text/plain; charset=utf-8');
require_once 'config.php';
require_once 'config/Database.php';

try {
    $db = Database::getInstance();
    $stmt = $db->query("SHOW INDEX FROM notifications");
    $indexes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "=== NOTIFICATIONS INDEXES ===\n";
    foreach ($indexes as $index) {
        echo "Table: {$index['Table']} | Non_unique: {$index['Non_unique']} | Key_name: {$index['Key_name']} | Seq_in_index: {$index['Seq_in_index']} | Column_name: {$index['Column_name']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
