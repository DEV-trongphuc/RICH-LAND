<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "Active Database: " . $conn->query("SELECT DATABASE()")->fetch_row()[0] . "\n";
echo "Host: " . $servername . "\n";
echo "User: " . $username . "\n";

try {
    $res = $conn->query("SHOW CREATE VIEW consultants");
    if ($res) {
        $row = $res->fetch_row();
        echo "\n=== CREATE VIEW consultants ===\n";
        echo $row[1] . "\n";
    } else {
        echo "\nFailed to SHOW CREATE VIEW consultants\n";
    }
} catch (Exception $e) {
    echo "\nError: " . $e->getMessage() . "\n";
}

try {
    $res = $conn->query("SHOW CREATE TABLE consultants");
    if ($res) {
        $row = $res->fetch_row();
        echo "\n=== CREATE TABLE consultants ===\n";
        echo $row[1] . "\n";
    }
} catch (Exception $e) {
    echo "\nError: " . $e->getMessage() . "\n";
}

$res = $conn->query("DESCRIBE consultants");
echo "\nColumns in consultants:\n";
while ($row = $res->fetch_assoc()) {
    echo $row['Field'] . " | ";
}
echo "\n";
