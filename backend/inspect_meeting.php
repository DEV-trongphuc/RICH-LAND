<?php
require_once __DIR__ . '/db_connect.php';
$res = $conn->query("SELECT id, subject, type, status, done_at, cancel_count FROM activities WHERE subject LIKE '%Gặp tại sa bàn%'");
$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = $row;
}
header('Content-Type: application/json');
echo json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
