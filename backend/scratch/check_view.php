<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DIAGNOSTIC: SHOW CREATE VIEW consultants ===\n\n";

$res = $conn->query("SHOW CREATE VIEW consultants");
if ($res) {
    $row = $res->fetch_row();
    echo "View Name: " . $row[0] . "\n\n";
    echo "Create View Statement:\n" . $row[1] . "\n";
} else {
    echo "Failed: " . $conn->error . "\n";
}
