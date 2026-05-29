<?php
// backend/audit_multiple_leads.php
// Chạy file này để kiểm tra xem có nhiều lead bị trùng SĐT hoặc Email trong DB hay không

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

$phone = '0907474739';
$email = 'hoangsyhoa1963@gmail.com';

echo "=== CÁC LEAD CÓ SĐT: $phone ===\n";
$stmt = $conn->prepare("SELECT id, name, phone, email, assigned_to, created_at, last_interaction_date, status FROM leads WHERE phone = ?");
$stmt->bind_param("s", $phone);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
$stmt->close();

echo "\n=== CÁC LEAD CÓ EMAIL: $email ===\n";
$stmt2 = $conn->prepare("SELECT id, name, phone, email, assigned_to, created_at, last_interaction_date, status FROM leads WHERE email = ?");
$stmt2->bind_param("s", $email);
$stmt2->execute();
$res2 = $stmt2->get_result();
while ($row = $res2->fetch_assoc()) {
    print_r($row);
}
$stmt2->close();
