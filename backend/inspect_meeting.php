<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    require_once __DIR__ . '/db_connect.php';
    if (!isset($conn)) {
        throw new Exception("Connection variable not set");
    }
    $res = $conn->query("SELECT id, subject, type, status, done_at FROM activities WHERE subject LIKE '%Gặp tại sa bàn%'");
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = $row;
    }
    header('Content-Type: application/json');
    echo json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()], JSON_PRETTY_PRINT);
}
