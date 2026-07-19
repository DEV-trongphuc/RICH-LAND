<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: application/json");
$data = [];

$data['php_time'] = date('Y-m-d H:i:s');
$data['current_hour'] = date('H');

try {
    $userRes = $conn->query("SELECT id, full_name, email, role FROM users WHERE full_name LIKE '%Hải Đăng%' OR role = 'sale' LIMIT 10");
    $data['users'] = [];
    while ($u = $userRes->fetch_assoc()) {
        $data['users'][] = $u;
    }
} catch (Exception $e) {
    $data['users_error'] = $e->getMessage();
}

try {
    $regRes = $conn->query("SELECT * FROM night_shift_registrations ORDER BY id DESC LIMIT 10");
    $data['registrations'] = [];
    while ($r = $regRes->fetch_assoc()) {
        $data['registrations'][] = $r;
    }
} catch (Exception $e) {
    $data['registrations_error'] = $e->getMessage();
}

echo json_encode($data, JSON_PRETTY_PRINT);
