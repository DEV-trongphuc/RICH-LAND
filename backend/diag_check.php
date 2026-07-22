<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db_connect.php';

echo "=== DIAGNOSTIC CHECK FOR NOTIFICATIONS & LOGS ===\n\n";

echo "1. NOTIFICATIONS FOR USER 1000:\n";
$resN = $conn->query("SELECT * FROM notifications WHERE user_id = 1000 ORDER BY id DESC LIMIT 10");
if ($resN) {
    while ($n = $resN->fetch_assoc()) {
        print_r($n);
    }
}

echo "\n2. COMMUNICATION LOGS FOR USER 1000 OR RECENT:\n";
$resL = $conn->query("SELECT * FROM communication_logs ORDER BY id DESC LIMIT 10");
if ($resL) {
    while ($l = $resL->fetch_assoc()) {
        print_r($l);
    }
}
