<?php
// D:\RICH_LAND_DATA_UI\scratch\check_users.php
require_once __DIR__ . '/../backend/db_connect.php';

$res = $conn->query("SELECT id, username, email, full_name, role, tenant_id FROM users");
$users = [];
while ($row = $res->fetch_assoc()) {
    $users[] = $row;
}
echo json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
