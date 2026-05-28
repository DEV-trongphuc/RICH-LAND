<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=== TIME INFO ===\n";
echo "PHP local time: " . date('Y-m-d H:i:s') . "\n";
echo "PHP timezone: " . date_default_timezone_get() . "\n";

$res = $conn->query("SELECT NOW() as db_now, @@global.time_zone as global_tz, @@session.time_zone as session_tz");
if ($res) {
    $row = $res->fetch_assoc();
    echo "MySQL NOW(): " . $row['db_now'] . "\n";
    echo "MySQL global timezone: " . $row['global_tz'] . "\n";
    echo "MySQL session timezone: " . $row['session_tz'] . "\n";
}

echo "\n=== LATEST 10 LEADS NOTIFICATION STATUS ===\n";
$resLeads = $conn->query("SELECT id, name, created_at, zalo_notify_status, email_notify_status, zalo_notify_sent_at, email_notify_sent_at FROM leads ORDER BY id DESC LIMIT 10");
if ($resLeads) {
    while ($row = $resLeads->fetch_assoc()) {
        echo "Lead ID: #{$row['id']} | Name: {$row['name']}\n";
        echo "  - Created At (Thời gian nhận): {$row['created_at']}\n";
        echo "  - Zalo Status: {$row['zalo_notify_status']} | Sent At: {$row['zalo_notify_sent_at']}\n";
        echo "  - Email Status: {$row['email_notify_status']} | Sent At: {$row['email_notify_sent_at']}\n";
    }
}
?>
