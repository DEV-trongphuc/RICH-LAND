<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=== ALL DATABASES ===\n";
$res = $conn->query("SHOW DATABASES");
while ($row = $res->fetch_row()) {
    echo $row[0] . "\n";
}
