<?php
require_once __DIR__ . '/db_connect.php';
$res = $conn->query("SELECT id, role, full_name, email, team_id FROM users WHERE email LIKE '%haidang%' OR full_name LIKE '%Đăng%'");
$users = [];
while ($row = $res->fetch_assoc()) {
    $users[] = $row;
}
echo json_encode($users);
