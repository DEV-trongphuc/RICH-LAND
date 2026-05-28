<?php
header("Content-Type: text/plain; charset=utf-8");
require_once __DIR__ . '/db_connect.php';

echo "=== TIMEZONE CONFIGS ===\n";
echo "PHP date.timezone: " . ini_get('date.timezone') . "\n";
echo "PHP local time: " . date('Y-m-d H:i:s') . "\n";
$resTz = $conn->query("SELECT NOW() as db_now, @@global.time_zone as global_tz, @@session.time_zone as session_tz, UTC_TIMESTAMP() as utc_now");
if ($resTz) {
    $row = $resTz->fetch_assoc();
    echo "MySQL NOW(): " . $row['db_now'] . "\n";
    echo "MySQL UTC_NOW(): " . $row['utc_now'] . "\n";
    echo "MySQL global_tz: " . $row['global_tz'] . "\n";
    echo "MySQL session_tz: " . $row['session_tz'] . "\n";
}

echo "\n=== FINDING LEADS CREATED AROUND 2026-05-28 13:14:03 ===\n";
$q = $conn->query("SELECT id, name, created_at, zalo_notify_status, email_notify_status, zalo_notify_sent_at, email_notify_sent_at FROM leads WHERE created_at LIKE '2026-05-28 13:%' ORDER BY created_at DESC");
if ($q) {
    while ($row = $q->fetch_assoc()) {
        echo "Lead ID: #{$row['id']} | Name: {$row['name']} | Created: {$row['created_at']}\n";
        echo "  - Zalo Status: {$row['zalo_notify_status']} | Sent At in DB: {$row['zalo_notify_sent_at']}\n";
        echo "  - Email Status: {$row['email_notify_status']} | Sent At in DB: {$row['email_notify_sent_at']}\n";
        
        // Find in zalo_queue
        $z = $conn->query("SELECT id, status, created_at, sent_at FROM zalo_queue WHERE lead_id = {$row['id']} OR body_text LIKE '%" . $row['name'] . "%'");
        if ($z && $z->num_rows > 0) {
            echo "  - Match in zalo_queue:\n";
            while ($zRow = $z->fetch_assoc()) {
                echo "    * Zalo Q ID #{$zRow['id']} | Status: {$zRow['status']} | Created: {$zRow['created_at']} | Sent: {$zRow['sent_at']}\n";
            }
        } else {
            echo "  - No match in zalo_queue\n";
        }

        // Find in mail_queue
        $m = $conn->query("SELECT id, status, created_at, sent_at FROM mail_queue WHERE lead_id = {$row['id']} OR subject LIKE '%" . $row['name'] . "%' OR body_html LIKE '%" . $row['name'] . "%'");
        if ($m && $m->num_rows > 0) {
            echo "  - Match in mail_queue:\n";
            while ($mRow = $m->fetch_assoc()) {
                echo "    * Mail Q ID #{$mRow['id']} | Status: {$mRow['status']} | Created: {$mRow['created_at']} | Sent: {$mRow['sent_at']}\n";
            }
        } else {
            echo "  - No match in mail_queue\n";
        }
        echo "\n";
    }
} else {
    echo "Query failed: " . $conn->error . "\n";
}
?>
