<?php
// backend/test_round_active_schedule.php
// RICH LAND DATA CRM - Verification Test for Round Active Schedule & Priority Routing

require_once __DIR__ . '/test_bootstrap.php';

header("Content-Type: text/plain; charset=utf-8");

echo "====================================================\n";
echo "🧪 BẮT ĐẦU KIỂM THỬ: KHUNG GIỜ ACTIVE & ĐỊNH TUYẾN ƯU TIÊN\n";
echo "====================================================\n\n";

// --- 1. KIỂM THỬ CẤU TRÚC BẢNG (SCHEMA VERIFICATION) ---
echo "--- [PHẦN 1: CẤU TRÚC BẢNG DISTRIBUTION_ROUNDS] ---\n";
$cols = [];
$resCols = $conn->query("SHOW COLUMNS FROM distribution_rounds");
if ($resCols) {
    while ($c = $resCols->fetch_assoc()) {
        $cols[] = $c['Field'];
    }
}
assertTest("Cột is_schedule_active tồn tại", in_array('is_schedule_active', $cols));
assertTest("Cột active_time_start tồn tại", in_array('active_time_start', $cols));
assertTest("Cột active_time_end tồn tại", in_array('active_time_end', $cols));
assertTest("Cột active_days tồn tại", in_array('active_days', $cols));

// --- 2. KIỂM THỬ UNIT TEST HÀM isRoundCurrentlyActive ---
echo "\n--- [PHẦN 2: UNIT TEST HÀM isRoundCurrentlyActive] ---\n";

// Case 1: Vòng bị tắt thủ công (is_active = 0)
$mockRoundOff = ['is_active' => 0, 'is_schedule_active' => 0];
assertTest("Vòng is_active=0 luôn trả về false", isRoundCurrentlyActive($mockRoundOff) === false);

// Case 2: Vòng không bật giới hạn giờ (is_schedule_active = 0)
$mockRound247 = ['is_active' => 1, 'is_schedule_active' => 0];
assertTest("Vòng 24/7 (is_schedule_active=0) luôn trả về true", isRoundCurrentlyActive($mockRound247) === true);

// Case 3: Ca ngày 08:00 - 18:00
$mockDayShift = [
    'is_active' => 1,
    'is_schedule_active' => 1,
    'active_time_start' => '08:00',
    'active_time_end' => '18:00',
    'active_days' => '1,2,3,4,5,6,7'
];
assertTest("Ca ngày 08:00-18:00 tại 10:00 -> active", isRoundCurrentlyActive($mockDayShift, '10:00') === true);
assertTest("Ca ngày 08:00-18:00 tại 08:00 -> active", isRoundCurrentlyActive($mockDayShift, '08:00') === true);
assertTest("Ca ngày 08:00-18:00 tại 18:00 -> active", isRoundCurrentlyActive($mockDayShift, '18:00') === true);
assertTest("Ca ngày 08:00-18:00 tại 07:59 -> inactive", isRoundCurrentlyActive($mockDayShift, '07:59') === false);
assertTest("Ca ngày 08:00-18:00 tại 18:01 -> inactive", isRoundCurrentlyActive($mockDayShift, '18:01') === false);
assertTest("Ca ngày 08:00-18:00 tại 23:00 -> inactive", isRoundCurrentlyActive($mockDayShift, '23:00') === false);

// Case 4: Ca đêm vắt qua nửa đêm (22:00 - 06:00 sáng hôm sau)
$mockNightShift = [
    'is_active' => 1,
    'is_schedule_active' => 1,
    'active_time_start' => '22:00',
    'active_time_end' => '06:00',
    'active_days' => '1,2,3,4,5,6,7'
];
assertTest("Ca đêm 22:00-06:00 tại 23:30 -> active", isRoundCurrentlyActive($mockNightShift, '23:30') === true);
assertTest("Ca đêm 22:00-06:00 tại 02:15 -> active", isRoundCurrentlyActive($mockNightShift, '02:15') === true);
assertTest("Ca đêm 22:00-06:00 tại 06:00 -> active", isRoundCurrentlyActive($mockNightShift, '06:00') === true);
assertTest("Ca đêm 22:00-06:00 tại 22:00 -> active", isRoundCurrentlyActive($mockNightShift, '22:00') === true);
assertTest("Ca đêm 22:00-06:00 tại 06:01 -> inactive", isRoundCurrentlyActive($mockNightShift, '06:01') === false);
assertTest("Ca đêm 22:00-06:00 tại 14:00 -> inactive", isRoundCurrentlyActive($mockNightShift, '14:00') === false);

// Case 5: Giới hạn theo ngày trong tuần (chỉ ngày hôm nay hoặc không phải hôm nay)
$currentDay = (int)date('N');
$yesterdayDay = ($currentDay === 1) ? 7 : ($currentDay - 1);
$mockDayOnly = [
    'is_active' => 1,
    'is_schedule_active' => 1,
    'active_time_start' => '00:00',
    'active_time_end' => '23:59',
    'active_days' => (string)$currentDay
];
assertTest("Vòng cấu hình khớp thứ hôm nay -> active", isRoundCurrentlyActive($mockDayOnly) === true);

$mockOtherDayOnly = [
    'is_active' => 1,
    'is_schedule_active' => 1,
    'active_time_start' => '00:00',
    'active_time_end' => '23:59',
    'active_days' => (string)$yesterdayDay
];
assertTest("Vòng cấu hình không bao gồm thứ hôm nay -> inactive", isRoundCurrentlyActive($mockOtherDayOnly) === false);

// --- 3. KIỂM THỬ TÍCH HỢP evaluateRules VỚI CƠ CHẾ CASCADE PRIORITY ---
echo "\n--- [PHẦN 3: INTEGRATION TEST evaluateRules & PRIORITY CASCADE] ---\n";

$testRoundDayId = null;
$testRoundNightId = null;
$testRuleDayId = null;
$testRuleNightId = null;

try {
    // 3.1 Tạo Vòng Ca Ngày (08:00 - 18:00)
    $stmtR1 = $conn->prepare("INSERT INTO distribution_rounds (round_name, is_active, is_schedule_active, active_time_start, active_time_end, active_days, round_type) VALUES ('[TEST] Vòng Ca Ngày', 1, 1, '08:00', '18:00', '1,2,3,4,5,6,7', 'round_robin')");
    $stmtR1->execute();
    $testRoundDayId = $conn->insert_id;
    $stmtR1->close();

    // 3.2 Tạo Vòng Ca Đêm (18:00 - 08:00)
    $stmtR2 = $conn->prepare("INSERT INTO distribution_rounds (round_name, is_active, is_schedule_active, active_time_start, active_time_end, active_days, round_type) VALUES ('[TEST] Vòng Ca Đêm', 1, 1, '18:00', '08:00', '1,2,3,4,5,6,7', 'round_robin')");
    $stmtR2->execute();
    $testRoundNightId = $conn->insert_id;
    $stmtR2->close();

    assertTest("Đã tạo 2 vòng kiểm thử DB (Round Day #{$testRoundDayId}, Round Night #{$testRoundNightId})", $testRoundDayId > 0 && $testRoundNightId > 0);

    // 3.3 Tạo 2 Routing Rules:
    // Rule 1: Priority = 100, trỏ vào Vòng Ca Ngày
    // Rule 2: Priority = 200, trỏ vào Vòng Ca Đêm
    $testCampaignKey = 'TEST_CAMPAIGN_' . time();
    $condJson = json_encode([
        ['conditions' => [['col' => 'campaign', 'op' => 'equals', 'val' => $testCampaignKey]]]
    ]);

    $stmtRule1 = $conn->prepare("INSERT INTO routing_rules (target_round_id, condition_column, condition_operator, condition_value, conditions_json, priority) VALUES (?, 'campaign', 'equals', ?, ?, 100)");
    $stmtRule1->bind_param("iss", $testRoundDayId, $testCampaignKey, $condJson);
    $stmtRule1->execute();
    $testRuleDayId = $conn->insert_id;
    $stmtRule1->close();

    $stmtRule2 = $conn->prepare("INSERT INTO routing_rules (target_round_id, condition_column, condition_operator, condition_value, conditions_json, priority) VALUES (?, 'campaign', 'equals', ?, ?, 200)");
    $stmtRule2->bind_param("iss", $testRoundNightId, $testCampaignKey, $condJson);
    $stmtRule2->execute();
    $testRuleNightId = $conn->insert_id;
    $stmtRule2->close();

    assertTest("Đã tạo 2 routing rules (Rule #{$testRuleDayId} Priority 100 -> Round Day, Rule #{$testRuleNightId} Priority 200 -> Round Night)", $testRuleDayId > 0 && $testRuleNightId > 0);

    // 3.4 Giả lập dữ liệu Lead đổ về
    $mockLeadData = [
        'name' => 'Nguyễn Test',
        'phone' => '0988776655',
        'campaign' => $testCampaignKey
    ];

    // TEST CASE A: Lead về lúc 10:00 sáng
    // Rule 1 (Priority 100) khớp điều kiện VÀ Vòng Ca Ngày đang active -> CHỌN RULE 1
    $evalDay = evaluateRules($conn, $mockLeadData, 'facebook', '', null, 'sheets', '10:00');
    assertTest("Thời điểm 10:00 (ban ngày): Trúng Rule 1 (Round Day #{$testRoundDayId})", 
        is_array($evalDay) && (int)$evalDay['target_round_id'] === (int)$testRoundDayId,
        "Actual Target Round: " . ($evalDay['target_round_id'] ?? 'null')
    );

    // TEST CASE B: Lead về lúc 21:00 tối
    // Rule 1 (Priority 100) khớp điều kiện NHƯNG Vòng Ca Ngày hết giờ (18:00)
    // -> Hệ thống PHẢI TỰ ĐỘNG BỎ QUA Rule 1 và NHƯỜNG QUYỀN cho Rule 2 (Priority 200)
    // -> Rule 2 Vòng Ca Đêm đang active (18:00 - 08:00) -> CHỌN RULE 2
    $evalNight = evaluateRules($conn, $mockLeadData, 'facebook', '', null, 'sheets', '21:00');
    assertTest("Thời điểm 21:00 (ban đêm): Rule 1 hết giờ -> Tự động trôi xuống Rule 2 (Round Night #{$testRoundNightId})", 
        is_array($evalNight) && (int)$evalNight['target_round_id'] === (int)$testRoundNightId,
        "Actual Target Round: " . ($evalNight['target_round_id'] ?? 'null')
    );

    // TEST CASE C: Khi cả 2 Vòng đều bị tắt thủ công
    $conn->query("UPDATE distribution_rounds SET is_active = 0 WHERE id IN ($testRoundDayId, $testRoundNightId)");
    $evalBothOff = evaluateRules($conn, $mockLeadData, 'facebook', '', null, 'sheets', '10:00');
    assertTest("Khi cả 2 vòng đều không active: evaluateRules trả về null để rơi vào Fallback",
        $evalBothOff === null,
        "Actual Result: " . var_export($evalBothOff, true)
    );

} catch (\Throwable $e) {
    echo "❌ Lỗi ngoại lệ trong quá trình test: " . $e->getMessage() . "\n";
    $testStats['fail']++;
} finally {
    // Dọn dẹp dữ liệu test
    if ($testRuleDayId) $conn->query("DELETE FROM routing_rules WHERE id = $testRuleDayId");
    if ($testRuleNightId) $conn->query("DELETE FROM routing_rules WHERE id = $testRuleNightId");
    if ($testRoundDayId) $conn->query("DELETE FROM distribution_rounds WHERE id = $testRoundDayId");
    if ($testRoundNightId) $conn->query("DELETE FROM distribution_rounds WHERE id = $testRoundNightId");
    echo "🧹 Đã dọn dẹp sạch sẽ dữ liệu test.\n";
}

printTestSummary();
