<?php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: text/plain; charset=utf-8');

echo "--- RUNNING DIRECT UPDATE FOR ID 999 ---\n";
$upd1 = $conn->query("UPDATE users SET email = 'turniodev@gmail.com' WHERE id = 999");
echo "Update result: " . ($upd1 ? "success" : "failed") . "\n";
echo "Affected rows: " . $conn->affected_rows . "\n";

echo "\n--- RUNNING DIRECT UPDATE FOR ID 1000 ---\n";
$upd2 = $conn->query("UPDATE users SET email = 'dom.marketing.vn@gmail.com' WHERE id = 1000");
echo "Update result: " . ($upd2 ? "success" : "failed") . "\n";
echo "Affected rows: " . $conn->affected_rows . "\n";

echo "\n--- USERS TABLE AFTER UPDATE ---\n";
$resUsers = $conn->query("SELECT id, email, username, role FROM users WHERE email LIKE '%haidang%' OR email LIKE '%admin%' OR email LIKE '%dom.marketing.vn%' OR email LIKE '%turniodev%'");
while ($row = $resUsers->fetch_assoc()) {
    print_r($row);
}

echo "\n--- DESCRIBE LEADS ---\n";
$resDesc = $conn->query("DESCRIBE leads");
while ($row = $resDesc->fetch_assoc()) {
    print_r($row);
}

