<?php
// backend/audit_lead.php
// Hãy chạy file này để kiểm tra thông tin dữ liệu của Nguyễn Thị Linh Đan và lead Hoa Hoàng

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "=== KIỂM TRA TVV: Nguyễn Thị Linh Đan ===\n";
$stmt = $conn->prepare("SELECT id, name, email, status, vacation_mode, leave_start, leave_end FROM consultants WHERE name LIKE ?");
$searchName = '%Linh Đan%';
$stmt->bind_param("s", $searchName);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
$stmt->close();

echo "\n=== KIỂM TRA LEAD: Hoa Hoàng (0907474739) ===\n";
$stmt2 = $conn->prepare("SELECT id, name, phone, email, assigned_to, created_at, status FROM leads WHERE phone = ?");
$phone = '0907474739';
$stmt2->bind_param("s", $phone);
$stmt2->execute();
$res2 = $stmt2->get_result();
$leadId = 0;
while ($row = $res2->fetch_assoc()) {
    $leadId = $row['id'];
    print_r($row);
}
$stmt2->close();

if ($leadId > 0) {
    echo "\n=== LỊCH SỬ PHÂN BỔ CỦA LEAD NÀY TRONG LOGS ===\n";
    $stmt3 = $conn->prepare("SELECT dl.id, dl.assigned_to, c.name as consultant_name, dl.round_id, dl.status, dl.message, dl.received_at 
                             FROM distribution_logs dl 
                             LEFT JOIN consultants c ON dl.assigned_to = c.id
                             WHERE dl.lead_id = ? 
                             ORDER BY dl.id ASC");
    $stmt3->bind_param("i", $leadId);
    $stmt3->execute();
    $res3 = $stmt3->get_result();
    while ($row = $res3->fetch_assoc()) {
        print_r($row);
    }
    $stmt3->close();
} else {
    echo "\nKhông tìm thấy lead này để kiểm tra lịch sử logs.\n";
}
