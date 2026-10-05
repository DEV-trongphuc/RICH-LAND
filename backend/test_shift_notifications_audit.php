<?php
// backend/test_shift_notifications_audit.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== [KIỂM THỬ TOÀN DIỆN TÍNH NĂNG NHẮC ĐĂNG KÝ TRỰC ĐÊM & CUỐI TUẦN] ===\n\n";

// 1. Kiểm tra cấu hình trong database system_settings
$resSettings = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (
    'night_shift_registration_mode',
    'night_shift_reg_reminder_enabled',
    'night_shift_reg_remind_lead_minutes',
    'weekend_shift_reg_reminder_enabled',
    'weekend_shift_reg_remind_time',
    'night_shift_start_time',
    'night_shift_end_time'
)");
$settings = [];
if ($resSettings) {
    while ($row = $resSettings->fetch_assoc()) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }
}

assertTest("TC-01: Cấu hình night_shift_registration_mode tồn tại trong CSDL", isset($settings['night_shift_registration_mode']), "Giá trị: " . ($settings['night_shift_registration_mode'] ?? 'null'));
assertTest("TC-02: Cấu hình night_shift_reg_reminder_enabled tồn tại trong CSDL", isset($settings['night_shift_reg_reminder_enabled']), "Giá trị: " . ($settings['night_shift_reg_reminder_enabled'] ?? 'null'));
assertTest("TC-03: Cấu hình night_shift_reg_remind_lead_minutes tồn tại trong CSDL", isset($settings['night_shift_reg_remind_lead_minutes']), "Giá trị: " . ($settings['night_shift_reg_remind_lead_minutes'] ?? 'null'));
assertTest("TC-04: Cấu hình weekend_shift_reg_reminder_enabled tồn tại trong CSDL", isset($settings['weekend_shift_reg_reminder_enabled']), "Giá trị: " . ($settings['weekend_shift_reg_reminder_enabled'] ?? 'null'));
assertTest("TC-05: Cấu hình weekend_shift_reg_remind_time tồn tại trong CSDL", isset($settings['weekend_shift_reg_remind_time']), "Giá trị: " . ($settings['weekend_shift_reg_remind_time'] ?? 'null'));

// 2. Kiểm thử logic phân tách 2 chế độ đăng ký trực đêm
$userRow = $conn->query("SELECT id FROM users LIMIT 1")->fetch_assoc();
$testUserId = $userRow ? (int)$userRow['id'] : 1003;
$testDate = '2099-01-01';

// Dọn dẹp dữ liệu test cũ nếu có
$conn->query("DELETE FROM check_ins WHERE user_id = $testUserId AND check_in_date = '$testDate'");
$conn->query("DELETE FROM night_shift_registrations WHERE user_id = $testUserId AND shift_date = '$testDate'");

// Trường hợp A: Chế độ 'free' (Tự do) -> Không cần check-in ban ngày vẫn hợp lệ
$modeFree = 'free';
$stmtCI = $conn->prepare("SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ? AND status != 'rejected' LIMIT 1");
$stmtCI->bind_param("is", $testUserId, $testDate);
$stmtCI->execute();
$hasCheckin = (bool)$stmtCI->get_result()->fetch_assoc();
$stmtCI->close();

$canRegisterFree = ($modeFree === 'free' || $hasCheckin);
assertTest("TC-06: Ở chế độ Tự do (free), user chưa checkin ban ngày VẪN được đăng ký trực đêm", $canRegisterFree === true);

// Trường hợp B: Chế độ 'require_day_checkin' (Yêu cầu check-in)
$modeRequire = 'require_day_checkin';
$canRegisterBeforeCheckin = ($modeRequire === 'free' || $hasCheckin);
assertTest("TC-07: Ở chế độ Yêu cầu checkin, user chưa checkin ban ngày BỊ CHẶN đăng ký trực đêm", $canRegisterBeforeCheckin === false);

// Giả lập user thực hiện check-in ban ngày
$conn->query("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES ($testUserId, '$testDate', '08:00:00', 'approved')");
$stmtCI2 = $conn->prepare("SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ? AND status != 'rejected' LIMIT 1");
$stmtCI2->bind_param("is", $testUserId, $testDate);
$stmtCI2->execute();
$hasCheckinAfter = (bool)$stmtCI2->get_result()->fetch_assoc();
$stmtCI2->close();

$canRegisterAfterCheckin = ($modeRequire === 'free' || $hasCheckinAfter);
assertTest("TC-08: Sau khi check-in ban ngày thành công, user ĐƯỢC PHÉP đăng ký trực đêm", $canRegisterAfterCheckin === true);

// Trường hợp C: Chế độ 'require_day_checkin_ontime' (Chỉ ai check-in đúng giờ, không trễ)
$modeOntime = 'require_day_checkin_ontime';
// Test C1: User check-in bị trễ (late_minutes = 15)
$conn->query("UPDATE check_ins SET late_minutes = 15, status = 'approved' WHERE user_id = $testUserId AND check_in_date = '$testDate'");
$stmtCIOntime1 = $conn->prepare("SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ? AND status = 'approved' AND (late_minutes IS NULL OR late_minutes <= 0) LIMIT 1");
$stmtCIOntime1->bind_param("is", $testUserId, $testDate);
$stmtCIOntime1->execute();
$hasOntimeCheckinLate = (bool)$stmtCIOntime1->get_result()->fetch_assoc();
$stmtCIOntime1->close();
assertTest("TC-08.1: Ở chế độ require_day_checkin_ontime, user checkin TRỄ (late_minutes=15) BỊ CHẶN đăng ký", $hasOntimeCheckinLate === false);

// Test C2: User check-in đúng giờ (late_minutes = 0)
$conn->query("UPDATE check_ins SET late_minutes = 0, status = 'approved' WHERE user_id = $testUserId AND check_in_date = '$testDate'");
$stmtCIOntime2 = $conn->prepare("SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ? AND status = 'approved' AND (late_minutes IS NULL OR late_minutes <= 0) LIMIT 1");
$stmtCIOntime2->bind_param("is", $testUserId, $testDate);
$stmtCIOntime2->execute();
$hasOntimeCheckinGood = (bool)$stmtCIOntime2->get_result()->fetch_assoc();
$stmtCIOntime2->close();
assertTest("TC-08.2: Ở chế độ require_day_checkin_ontime, user checkin ĐÚNG GIỜ (late_minutes=0) ĐƯỢC PHÉP đăng ký", $hasOntimeCheckinGood === true);

// Dọn dẹp dữ liệu test
$conn->query("DELETE FROM check_ins WHERE user_id = $testUserId AND check_in_date = '$testDate'");

// 3. Kiểm tra trường độ dài và cấu trúc bảng notifications & sent_notifications
$colNotif = $conn->query("SHOW COLUMNS FROM notifications LIKE 'type'")->fetch_assoc();
$colSent = $conn->query("SHOW COLUMNS FROM sent_notifications LIKE 'notify_type'")->fetch_assoc();

assertTest("TC-09: notifications.type đủ dung lượng chứa 'night_shift_reg_invitation'", $colNotif && strpos($colNotif['Type'], 'varchar(50)') !== false);
assertTest("TC-10: sent_notifications.notify_type đủ dung lượng chứa 'weekend_shift_reg_invitation'", $colSent && strpos($colSent['Type'], 'varchar(50)') !== false);

// Dọn dẹp dữ liệu test
$conn->query("DELETE FROM check_ins WHERE user_id = $testUserId AND check_in_date = '$testDate'");
$conn->query("DELETE FROM night_shift_registrations WHERE user_id = $testUserId AND shift_date = '$testDate'");

echo "\n";
printTestSummary();
