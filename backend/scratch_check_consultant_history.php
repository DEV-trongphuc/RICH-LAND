<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== ADMIN LOGS FOR CONSULTANT 1002 OR 1004 ===\n";
$stmt = $conn->prepare("SELECT * FROM admin_logs WHERE details LIKE '%1002%' OR details LIKE '%danntl%' OR details LIKE '%1004%' OR details LIKE '%uyennp%' ORDER BY id DESC");
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo "Log ID: #{$row['id']} | Action: {$row['action']} | Created At: {$row['created_at']}\n";
        echo "Details: {$row['details']}\n";
        echo "----------------------------------------\n";
    }
} else {
    echo "No admin logs found for these consultants.\n";
}
$stmt->close();
?>
