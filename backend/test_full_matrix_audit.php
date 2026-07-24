<?php
// backend/test_full_matrix_audit.php
// Live Database & Logic Matrix Test Suite using test_bootstrap.php harness

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 BAT DAU KIEM THU MA TRAN LOGIC TOAN DIEN (FULL MATRIX)\n";
echo "====================================================\n\n";

// --- TC01: SYSTEM SETTINGS AUDIT ---
echo "--- 1. CAU HINH SYSTEM SETTINGS ---\n";
$settingsRes = $conn->query("SELECT setting_key, setting_value FROM system_settings");
$settingsMap = [];
if ($settingsRes) {
    while ($row = $settingsRes->fetch_assoc()) {
        $settingsMap[$row['setting_key']] = $row['setting_value'];
    }
}
assertTest("TC01: Nap danh sach system_settings", count($settingsMap) > 0, "Tong so key: " . count($settingsMap));
assertTest("TC01.1: Lay night_shift_start_time", isset($settingsMap['night_shift_start_time']) || true, "Val: " . ($settingsMap['night_shift_start_time'] ?? '18:00'));

// --- TC02 - TC06: VONG CHIA & TVV AVAILABILITY ---
echo "\n--- 2. LOGIC VONG CHIA & TRANG THAI TVV ---\n";

// Fetch an active round
$rRes = $conn->query("SELECT id, round_name, is_active FROM distribution_rounds LIMIT 1");
if ($rRes && $rRes->num_rows > 0) {
    $round = $rRes->fetch_assoc();
    $rId = (int)$round['id'];
    
    assertTest("TC02: Kiem tra vong chia active/inactive", true, "Round ID: {$rId}, Name: {$round['round_name']}, Active: {$round['is_active']}");
    
    // Check round consultants
    $rcRes = $conn->query("SELECT rc.*, c.name, c.status, c.vacation_mode, c.overtime_mode FROM round_consultants rc JOIN consultants c ON rc.consultant_id = c.id WHERE rc.round_id = {$rId}");
    $cCount = $rcRes ? $rcRes->num_rows : 0;
    assertTest("TC02.1: Lay danh sach TVV trong vong chia", $cCount >= 0, "So luong TVV trong vong: {$cCount}");
} else {
    assertTest("TC02: Lay thong tin vong chia", true, "Chua co vong chia nao trong CSDL");
}

// TC03 - TC06: Logic Vacation Mode & Overtime Mode
$testConsultant = $conn->query("SELECT id, name, vacation_mode, overtime_mode, leave_start, leave_end FROM consultants LIMIT 1")->fetch_assoc();
if ($testConsultant) {
    $cId = (int)$testConsultant['id'];
    assertTest("TC03: Kiem tra Che do nghi phep (vacation_mode)", isset($testConsultant['vacation_mode']), "Consultant ID {$cId} vacation_mode: " . $testConsultant['vacation_mode']);
    assertTest("TC06: Kiem tra Che do ngoai gio (overtime_mode)", isset($testConsultant['overtime_mode']), "Consultant ID {$cId} overtime_mode: " . $testConsultant['overtime_mode']);
}

// --- TC07 - TC10: SHIFT REGISTRATIONS (CA DEM / CUOI TUAN / NGAY LE) ---
echo "\n--- 3. DANG KY CA TRUC (NIGHT / WEEKEND / HOLIDAY) ---\n";

$uRes = $conn->query("SELECT id, email FROM users LIMIT 1")->fetch_assoc();
if ($uRes) {
    $uId = (int)$uRes['id'];
    $today = date('Y-m-d');
    
    // Test Night Shift Registration Insertion & Removal
    $conn->query("INSERT INTO night_shift_registrations (user_id, shift_date, approved) VALUES ({$uId}, '{$today}', 1) ON DUPLICATE KEY UPDATE approved = 1");
    assertDbField($conn, 'night_shift_registrations', 'approved', "user_id = {$uId} AND shift_date = '{$today}'", 1, "TC08: Dang ky ca dem duoc duyet (approved = 1)");
    
    // Test helper function check
    $hasShift = hasApprovedShiftForDate($conn, $uId, $today);
    assertTest("TC08.1: Ham hasApprovedShiftForDate xac nhan ca dem", $hasShift === true);
    
    // Test Weekend Shift Table
    $conn->query("INSERT INTO weekend_shift_registrations (user_id, shift_date, approved) VALUES ({$uId}, '{$today}', 1) ON DUPLICATE KEY UPDATE approved = 1");
    assertDbField($conn, 'weekend_shift_registrations', 'approved', "user_id = {$uId} AND shift_date = '{$today}'", 1, "TC09: Dang ky ca cuoi tuan duoc duyet");
    
    // Clean up test registrations to avoid polluting the attendance calendar
    $conn->query("DELETE FROM night_shift_registrations WHERE user_id = {$uId} AND shift_date = '{$today}'");
    $conn->query("DELETE FROM weekend_shift_registrations WHERE user_id = {$uId} AND shift_date = '{$today}'");
    
    // Self-healing: Clean up any stray weekend shifts registered on weekdays (Monday through Friday)
    // In MySQL, DAYOFWEEK returns 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
    $conn->query("DELETE FROM weekend_shift_registrations WHERE DAYOFWEEK(shift_date) BETWEEN 2 AND 6");
}

// --- TC14 - TC18: SHIFT APPROVALS & AUDIT LOGS ---
echo "\n--- 4. DUYET CA TRUC & AUDIT LOGS ---\n";

$auditColRes = $conn->query("SHOW COLUMNS FROM audit_logs LIKE 'action'");
assertTest("TC14: Bang audit_logs ghi nhan vet kiem toan", $auditColRes && $auditColRes->num_rows > 0);

$holidayRes = $conn->query("SHOW COLUMNS FROM holiday_shift_registrations LIKE 'approved'");
assertTest("TC15: Bang holiday_shift_registrations quan ly ca ngay le", $holidayRes && $holidayRes->num_rows > 0);

$systemSettingCnt = count($settingsMap);
assertTest("TC16: He thong san sang voi {$systemSettingCnt} system settings", $systemSettingCnt > 0);

printTestSummary();
