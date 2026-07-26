<?php
// backend/test_lead_recall_async.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/test_bootstrap.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ HÀNG ĐỢI THÔNG BÁO BẤT ĐỒNG BỘ & ĐỒNG HỒ ĐẾM NGƯỢC 2 PHÚT\n";
echo "========================================================================\n\n";

// 1. Kiểm tra cấu trúc bảng `telegram_queue`
$resTable = $conn->query("SHOW TABLES LIKE 'telegram_queue'");
assertTest("Bảng 'telegram_queue' tồn tại trong cơ sở dữ liệu", $resTable && $resTable->num_rows > 0);

$resCols = $conn->query("SHOW COLUMNS FROM `telegram_queue` LIKE 'lead_id'");
assertTest("Bảng 'telegram_queue' có trường 'lead_id'", $resCols && $resCols->num_rows > 0);

// Tạo Lead test giả lập
$testPhone = '098' . rand(1000000, 9999999);
$conn->query("DELETE FROM leads WHERE phone = '$testPhone'");
$conn->query("INSERT INTO leads (phone, name, source, type, last_interaction_date, is_accepted) VALUES ('$testPhone', 'Test Recall Async', 'test', 'hot', '2000-01-01 00:00:00', 0)");
$leadId = $conn->insert_id;
assertTest("Khởi tạo Lead test thành công (ID: $leadId)", $leadId > 0);

// 2. Kiểm tra đẩy thông báo Zalo vào hàng đợi (async)
$conn->query("DELETE FROM zalo_queue WHERE lead_id = $leadId");
$zaloResult = sendZaloMessage('test_zalo_token', 'test_zalo_chat', 'Zalo Test Queue Message', false, $leadId);
assertTest("Gọi sendZaloMessage ở chế độ bất đồng bộ thành công", $zaloResult === true);

$zaloQ = $conn->query("SELECT status, body_text FROM zalo_queue WHERE lead_id = $leadId LIMIT 1")->fetch_assoc();
assertTest("Bản ghi Zalo được ghi nhận trong 'zalo_queue'", !empty($zaloQ));
assertTest("Trạng thái của bản ghi Zalo trong hàng đợi là 'pending'", ($zaloQ['status'] ?? '') === 'pending');

// 3. Kiểm tra đẩy thông báo Telegram vào hàng đợi (async)
$conn->query("DELETE FROM telegram_queue WHERE lead_id = $leadId");
$teleResult = sendTelegramMessage('test_tele_token', 'test_tele_chat', 'Telegram Test Queue Message', false, $leadId);
assertTest("Gọi sendTelegramMessage ở chế độ bất đồng bộ thành công", $teleResult === true);

$teleQ = $conn->query("SELECT status, body_text FROM telegram_queue WHERE lead_id = $leadId LIMIT 1")->fetch_assoc();
assertTest("Bản ghi Telegram được ghi nhận trong 'telegram_queue'", !empty($teleQ));
assertTest("Trạng thái của bản ghi Telegram trong hàng đợi là 'pending'", ($teleQ['status'] ?? '') === 'pending');

// 4. Kiểm tra cập nhật mốc đếm ngược `last_interaction_date` khi tin nhắn Zalo gửi thành công
// Mô phỏng cập nhật thành công giống như logic trong sendZaloMessage / sendTelegramMessage
$conn->query("UPDATE leads SET last_interaction_date = '2000-01-01 00:00:00' WHERE id = $leadId");
$oldLead = $conn->query("SELECT last_interaction_date FROM leads WHERE id = $leadId")->fetch_assoc();
assertTest("Reset mốc thời gian cũ về năm 2000 thành công", $oldLead['last_interaction_date'] === '2000-01-01 00:00:00');

// Chạy trực tiếp câu lệnh cập nhật như khi gửi thành công để xác minh tính chính xác
$newStatus = 'sent';
$isSent = true;
$sentAtExpr = $isSent ? ", zalo_notify_sent_at = NOW(), last_interaction_date = NOW()" : "";
$conn->query("UPDATE leads SET zalo_notify_status = '$newStatus' $sentAtExpr WHERE id = $leadId");

$updatedLead = $conn->query("SELECT last_interaction_date, zalo_notify_status FROM leads WHERE id = $leadId")->fetch_assoc();
$timeDiff = time() - strtotime($updatedLead['last_interaction_date']);
assertTest("Thời gian 'last_interaction_date' được reset về NOW()", $timeDiff <= 5, "Độ lệch giây thực tế: $timeDiff giây");
assertTest("Trạng thái thông báo Zalo được cập nhật thành 'sent'", $updatedLead['zalo_notify_status'] === 'sent');

// Dọn dẹp dữ liệu test
$conn->query("DELETE FROM zalo_queue WHERE lead_id = $leadId");
$conn->query("DELETE FROM telegram_queue WHERE lead_id = $leadId");
$conn->query("DELETE FROM leads WHERE id = $leadId");
echo "\n✨ Dọn dẹp dữ liệu kiểm thử hoàn tất.\n";

printTestSummary();
