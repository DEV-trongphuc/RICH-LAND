<?php
require_once __DIR__ . '/db_connect.php';

$userId = 1000;
header("Content-Type: text/plain");
echo "Current Date/Time in PHP: " . date('Y-m-d H:i:s') . "\n";
echo "Current Hour: " . date('H') . "\n";

$currentHour = (int)date('H');
$shiftDate = ($currentHour < 6) ? date('Y-m-d', strtotime('-1 day')) : date('Y-m-d');
echo "Resolved Shift Date: " . $shiftDate . "\n";

$res = $conn->query("SELECT * FROM night_shift_registrations WHERE user_id = $userId ORDER BY id DESC LIMIT 5");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "ID: {$row['id']}, Date: {$row['shift_date']}, Approved: {$row['approved']}, Created At: {$row['created_at']}\n";
    }
} else {
    echo "Query failed: " . $conn->error . "\n";
}
