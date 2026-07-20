<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=== DATABASE INFO ===\n";
echo "DATABASE(): " . $conn->query("SELECT DATABASE()")->fetch_row()[0] . "\n";
echo "USER(): " . $conn->query("SELECT USER()")->fetch_row()[0] . "\n";

echo "\n=== VIEW: consultants ===\n";
try {
    $res = $conn->query("DESCRIBE consultants");
    $cols = [];
    while ($row = $res->fetch_assoc()) {
        $cols[] = $row['Field'] . ' (' . $row['Type'] . ')';
    }
    echo implode("\n", $cols) . "\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

echo "\n=== VIEW: accounts ===\n";
try {
    $res = $conn->query("DESCRIBE accounts");
    $cols = [];
    while ($row = $res->fetch_assoc()) {
        $cols[] = $row['Field'] . ' (' . $row['Type'] . ')';
    }
    echo implode("\n", $cols) . "\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
