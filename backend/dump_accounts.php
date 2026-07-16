<?php
require_once 'env.php';
require_once 'config.php';
require_once 'db_connect.php';

$stmt = $conn->prepare("SELECT * FROM accounts WHERE email = 'haidang@richland.net'");
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
print_r($row);
