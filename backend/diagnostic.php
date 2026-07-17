<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'env.php';
require_once 'config.php';
require_once 'db_connect.php';

echo "mysqli Connected.\n";

$res = $conn->query("DESCRIBE users");
if (!$res) {
    echo "Query DESCRIBE users failed: " . $conn->error . "\n";
} else {
    echo "users columns:\n";
    while ($row = $res->fetch_assoc()) {
        echo "- " . $row['Field'] . " (" . $row['Type'] . ")\n";
    }
}

$res2 = $conn->query("DESCRIBE accounts");
if (!$res2) {
    echo "Query DESCRIBE accounts failed: " . $conn->error . "\n";
} else {
    echo "accounts columns:\n";
    while ($row = $res2->fetch_assoc()) {
        echo "- " . $row['Field'] . " (" . $row['Type'] . ")\n";
    }
}
