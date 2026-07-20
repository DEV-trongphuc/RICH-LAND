<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

try {
    $stmt = $conn->prepare("SELECT id, name, email FROM consultants WHERE telegram_chat_id = ? LIMIT 1");
    if ($stmt) {
        $chatId = '7834122759';
        $stmt->bind_param("s", $chatId);
        $stmt->execute();
        $res = $stmt->get_result();
        echo "Query succeeded! Found rows: " . $res->num_rows . "\n";
        $stmt->close();
    } else {
        echo "Failed to prepare statement.\n";
    }
} catch (Exception $e) {
    echo "QUERY ERROR: " . $e->getMessage() . "\n";
}
