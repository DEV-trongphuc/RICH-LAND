<?php
require_once 'db_connect.php';

echo "=== DESCRIBE LEADS ===\n";
$res = $conn->query("DESCRIBE leads");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "\n=== DESCRIBE DISTRIBUTION_LOGS ===\n";
$res = $conn->query("DESCRIBE distribution_logs");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
?>
