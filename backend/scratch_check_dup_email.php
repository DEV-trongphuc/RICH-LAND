<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$phone = '0907474739';
$email = 'hoangsyhoa1963@gmail.com';

echo "=== SEARCHING LEADS BY PHONE: $phone ===\n";
$stmt1 = $conn->prepare("SELECT id, name, phone, email, status, assigned_to, created_at, last_interaction_date, connection_id FROM leads WHERE phone = ?");
$stmt1->bind_param("s", $phone);
$stmt1->execute();
$res1 = $stmt1->get_result();
if ($res1 && $res1->num_rows > 0) {
    while ($row = $res1->fetch_assoc()) {
        echo "ID: #{$row['id']} | Name: {$row['name']} | Phone: {$row['phone']} | Email: {$row['email']} | Status: {$row['status']} | Created: {$row['created_at']} | Connection: {$row['connection_id']}\n";
    }
} else {
    echo "No leads found by phone.\n";
}
$stmt1->close();

echo "\n=== SEARCHING LEADS BY EMAIL: $email ===\n";
$stmt2 = $conn->prepare("SELECT id, name, phone, email, status, assigned_to, created_at, last_interaction_date, connection_id FROM leads WHERE email = ?");
$stmt2->bind_param("s", $email);
$stmt2->execute();
$res2 = $stmt2->get_result();
if ($res2 && $res2->num_rows > 0) {
    while ($row = $res2->fetch_assoc()) {
        echo "ID: #{$row['id']} | Name: {$row['name']} | Phone: {$row['phone']} | Email: {$row['email']} | Status: {$row['status']} | Created: {$row['created_at']} | Connection: {$row['connection_id']}\n";
    }
} else {
    echo "No leads found by email.\n";
}
$stmt2->close();
?>
