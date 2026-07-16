<?php
include __DIR__ . '/db_connect.php';
$s = $conn->query("SELECT id, full_name, email, role, avatar_url FROM users WHERE full_name LIKE '%Đăng%' OR full_name LIKE '%Dang%'");
$res = [];
while ($row = $s->fetch_assoc()) {
    $res[] = $row;
}
print_r($res);
