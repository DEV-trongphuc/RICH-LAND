<?php
require_once __DIR__ . '/db_connect.php';

echo "=== CHECKING RECENT LOGS FOR USER 1000 ===\n\n";

$resN = $conn->query("SELECT * FROM notifications WHERE user_id = 1000 ORDER BY id DESC LIMIT 2");
echo "NOTIFICATIONS:\n";
while ($n = $resN->fetch_assoc()) {
    print_r($n);
}

echo "\nCOMMUNICATION LOGS:\n";
$resL = $conn->query("SELECT * FROM communication_logs ORDER BY id DESC LIMIT 5");
while ($l = $resL->fetch_assoc()) {
    print_r($l);
}
