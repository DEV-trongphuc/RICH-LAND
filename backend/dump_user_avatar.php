<?php
require_once 'env.php';
require_once 'config.php';
require_once 'db_connect.php';

$stmt = $conn->prepare("SELECT id, username, full_name, email, avatar_url FROM users WHERE full_name LIKE '%Hải Đăng%' OR username LIKE '%dang%'");
$stmt->execute();
$users = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

echo "USERS:\n";
print_r($users);

$stmt2 = $conn->prepare("SELECT id, name, email, avatar FROM consultants WHERE name LIKE '%Hải Đăng%' OR email LIKE '%dang%'");
$stmt2->execute();
$consultants = $stmt2->get_result()->fetch_all(MYSQLI_ASSOC);

echo "\nCONSULTANTS:\n";
print_r($consultants);
