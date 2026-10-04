<?php
// backend/test_lead_recall_and_form_fields.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== [KIỂM THỬ: HIỂN THỊ LOẠI HÌNH, APP LIÊN HỆ & THÔNG BÁO THU HỒI LEAD] ===\n\n";

// 1. Kiểm tra dữ liệu khách hàng Thông Vu (contact ID 68)
$stmt = $conn->prepare("SELECT id, notes, property_type FROM contacts WHERE id = 68");
$stmt->execute();
$cRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

assertTest("TC-01: Khách hàng Thông Vu có cột property_type lưu '1PN 48M2'", ($cRow['property_type'] ?? '') === '1PN 48M2', "Giá trị: " . ($cRow['property_type'] ?? 'null'));
assertTest("TC-02: Trường notes của Thông Vu có chứa '• loai_hinh: 1PN 48M2'", strpos($cRow['notes'] ?? '', '• loai_hinh: 1PN 48M2') !== false);
assertTest("TC-03: Trường notes của Thông Vu có chứa '• app_lienhe: Zalo'", strpos($cRow['notes'] ?? '', '• app_lienhe: Zalo') !== false);

// 2. Kiểm thử hàm gửi thông báo thu hồi lead sendSaleLeadRecalledNotification
assertTest("TC-04: Hàm sendSaleLeadRecalledNotification đã được định nghĩa trong webhook_logic.php", function_exists('sendSaleLeadRecalledNotification'));

// Lấy 1 sale và 1 lead test
$uRow = $conn->query("SELECT id, full_name, email FROM users WHERE role = 'sales' LIMIT 1")->fetch_assoc();
$testSaleId = $uRow ? (int)$uRow['id'] : 1003;
$lRow = $conn->query("SELECT id FROM leads LIMIT 1")->fetch_assoc();
$testLeadId = $lRow ? (int)$lRow['id'] : 70;

// Xóa thông báo test cũ
$conn->query("DELETE FROM notifications WHERE user_id = $testSaleId AND type = 'lead_recalled' AND title LIKE '%Thu hồi Lead%'");

// Kích hoạt hàm thông báo thu hồi
sendSaleLeadRecalledNotification($conn, $testLeadId, $testSaleId, 2, 'Ban Ngày - MIK Sensapark');

// Kiểm tra bản ghi thông báo trong bảng notifications
$notifCheck = $conn->query("SELECT id, title, body, type, link FROM notifications WHERE user_id = $testSaleId AND type = 'lead_recalled' ORDER BY id DESC LIMIT 1")->fetch_assoc();

assertTest("TC-05: Thông báo In-App Bell đã được tạo thành công cho Sale", !empty($notifCheck));
assertTest("TC-06: Loại thông báo là 'lead_recalled'", ($notifCheck['type'] ?? '') === 'lead_recalled');
assertTest("TC-07: Nội dung thông báo ghi rõ thời hạn và lý do thu hồi", strpos($notifCheck['body'] ?? '', '2 phút') !== false && strpos($notifCheck['body'] ?? '', 'thu hồi') !== false);

// Dọn dẹp thông báo test
if (!empty($notifCheck['id'])) {
    $conn->query("DELETE FROM notifications WHERE id = " . (int)$notifCheck['id']);
}

echo "\n";
printTestSummary();
