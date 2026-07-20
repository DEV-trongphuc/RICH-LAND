<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=== DATABASE METADATA ===\n";
echo "DATABASE(): " . $conn->query("SELECT DATABASE()")->fetch_row()[0] . "\n";
echo "USER(): " . $conn->query("SELECT USER()")->fetch_row()[0] . "\n";

$vars = ['hostname', 'port', 'socket', 'datadir', 'version'];
foreach ($vars as $v) {
    $res = $conn->query("SELECT @@$v");
    if ($res) {
        echo "@@$v: " . $res->fetch_row()[0] . "\n";
    } else {
        echo "@@$v: error\n";
    }
}

echo "\n=== DESCRIBE consultants ===\n";
$res = $conn->query("DESCRIBE consultants");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo $row['Field'] . "\n";
    }
}
