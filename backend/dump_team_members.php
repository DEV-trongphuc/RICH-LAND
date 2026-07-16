<?php
require_once 'env.php';
require_once 'config.php';
require_once 'db_connect.php';

$stmt1 = $conn->prepare("SELECT id, username, full_name, email, team_id FROM users WHERE team_id = 1");
$stmt1->execute();
$users = $stmt1->get_result()->fetch_all(MYSQLI_ASSOC);

echo "USERS WITH TEAM_ID = 1:\n";
print_r($users);

$stmt2 = $conn->prepare("SELECT id, name, email, team_id FROM consultants WHERE team_id = 1");
$stmt2->execute();
$consultants = $stmt2->get_result()->fetch_all(MYSQLI_ASSOC);

echo "\nCONSULTANTS WITH TEAM_ID = 1:\n";
print_r($consultants);
