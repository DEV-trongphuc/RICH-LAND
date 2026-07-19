<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: application/json");
$data = [];

$userId = 1000;
$data['php_time'] = date('Y-m-d H:i:s');
$data['current_hour'] = date('H');

// 1. Check weekend registrations
try {
    $res = $conn->query("SELECT * FROM weekend_shift_registrations WHERE user_id = $userId ORDER BY id DESC LIMIT 5");
    $data['weekend'] = [];
    while ($row = $res->fetch_assoc()) {
        $data['weekend'][] = $row;
    }
} catch (Exception $e) {
    $data['weekend_error'] = $e->getMessage();
}

// 2. Check holiday registrations
try {
    $res = $conn->query("SELECT * FROM holiday_shift_registrations WHERE user_id = $userId ORDER BY id DESC LIMIT 5");
    $data['holiday'] = [];
    while ($row = $res->fetch_assoc()) {
        $data['holiday'][] = $row;
    }
} catch (Exception $e) {
    $data['holiday_error'] = $e->getMessage();
}

// 3. Check night registrations
try {
    $res = $conn->query("SELECT * FROM night_shift_registrations WHERE user_id = $userId ORDER BY id DESC LIMIT 5");
    $data['night'] = [];
    while ($row = $res->fetch_assoc()) {
        $data['night'][] = $row;
    }
} catch (Exception $e) {
    $data['night_error'] = $e->getMessage();
}

echo json_encode($data, JSON_PRETTY_PRINT);
