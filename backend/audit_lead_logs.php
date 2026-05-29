<?php
// backend/audit_lead_logs.php
// Chạy file này để tìm tất cả các hành động của admin tác động lên lead 886 hoặc SĐT 0907474739

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

$leadId = 886;
$phone = '0907474739';

echo "=== LỊCH SỬ TÁC ĐỘNG LÊN LEAD $leadId TRONG ADMIN LOGS ===\n";
$stmt = $conn->prepare("SELECT id, account_id, action, details, ip_address, created_at 
                        FROM admin_logs 
                        WHERE details LIKE ? OR details LIKE ? 
                        ORDER BY id DESC");
$searchId = "%$leadId%";
$searchPhone = "%$phone%";
$stmt->bind_param("ss", $searchId, $searchPhone);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
$stmt->close();
