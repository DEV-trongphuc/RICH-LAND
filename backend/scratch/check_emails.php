<?php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: text/plain; charset=utf-8');

echo "--- USERS TABLE ---\n";
$resUsers = $conn->query("SELECT id, email, username FROM users WHERE id IN (999, 1000, 1002)");
while ($row = $resUsers->fetch_assoc()) {
    print_r($row);
}

echo "\n--- CONSULTANTS VIEW/TABLE ---\n";
$resCons = $conn->query("SELECT id, email, name FROM consultants WHERE id IN (999, 1000, 1002)");
while ($row = $resCons->fetch_assoc()) {
    print_r($row);
}
