<?php
require_once __DIR__ . '/db_connect.php';

echo "=== System Timezone Audit ===\n";
echo "PHP Default Timezone: " . date_default_timezone_get() . "\n";
echo "PHP Current Time: " . date('Y-m-d H:i:s') . "\n";

$res = $conn->query("SELECT NOW() as db_time, @@session.time_zone as sess_tz, @@global.time_zone as glob_tz");
if ($res && $row = $res->fetch_assoc()) {
    echo "MySQL Current Time: " . $row['db_time'] . "\n";
    echo "MySQL Session Timezone: " . $row['sess_tz'] . "\n";
    echo "MySQL Global Timezone: " . $row['glob_tz'] . "\n";
    
    $phpTime = date('Y-m-d H:i:s');
    $dbTime = $row['db_time'];
    $diff = abs(strtotime($phpTime) - strtotime($dbTime));
    if ($diff < 2) {
        echo "✅ Timezone check PASSED (PHP and MySQL times are aligned).\n";
    } else {
        echo "❌ Timezone check FAILED (PHP and MySQL times differ by $diff seconds).\n";
    }
} else {
    echo "❌ Failed to query MySQL timezone info.\n";
}
?>
