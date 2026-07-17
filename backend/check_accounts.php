<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain");

$res = $conn->query("SELECT id, username, email, role, full_name FROM users");
echo "=== USERS ===\n";
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

$res2 = $conn->query("SELECT id, username, email, role, name FROM accounts");
echo "=== ACCOUNTS ===\n";
while ($row = $res2->fetch_assoc()) {
    print_r($row);
}
