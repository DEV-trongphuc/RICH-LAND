<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: application/json");
$data = [];

$res = $conn->query("SHOW TABLES");
$data['tables'] = [];
while ($row = $res->fetch_row()) {
    $data['tables'][] = $row[0];
}

echo json_encode($data, JSON_PRETTY_PRINT);
