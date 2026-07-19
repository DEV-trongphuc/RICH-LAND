<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: application/json");
$data = [];

try {
    // 1. Get all registrations for the last 3 days
    $res = $conn->query("SELECT r.*, u.full_name FROM night_shift_registrations r JOIN users u ON r.user_id = u.id ORDER BY r.id DESC LIMIT 20");
    $data['all_night_registrations'] = [];
    while ($row = $res->fetch_assoc()) {
        $data['all_night_registrations'][] = $row;
    }
} catch (Exception $e) {
    $data['error'] = $e->getMessage();
}

echo json_encode($data, JSON_PRETTY_PRINT);
