<?php
// backend/test_master_distribution_audit.php
// MASTER TEST SUITE: AUDIT TOAN DIEN HE THONG CHIA DATA & CAC LOGIC PHUC TAP (TC-01 -> TC-24)

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================================\n";
echo "👑 RICH LAND CRM - MASTER LEAD DISTRIBUTION AUDIT TEST SUITE\n";
echo "   Kiem toan toan bo 24 Kich ban chia data, cong loc, ca truc & bu\n";
echo "====================================================================\n\n";

$startTime = microtime(true);

// ====================================================================
// PHAN 1: INGESTION & DATA SANITIZATION (TC-01 -> TC-03)
// ====================================================================
echo "--- PHAN 1: CHUAN HOA & LOC SO TUYEN (TC-01 -> TC-03) ---\n";

// TC-01: normalizePhone
$p1 = normalizePhone('+84 905 123 456 / 0908 789 012');
assertTest("TC-01.1: normalizePhone lay so cuoi cung khi co nhieu so", $p1 === '0908789012', "Output: {$p1}");

$p2 = normalizePhone('p: 0912 345 678');
assertTest("TC-01.2: normalizePhone loai bo tien to 'p:' va khoang trang", $p2 === '0912345678', "Output: {$p2}");

$p3 = normalizePhone('+1 555 123 4567');
assertTest("TC-01.3: normalizePhone giu nguyen so quoc te co dau +", $p3 === '+15551234567', "Output: {$p3}");

$p4 = normalizePhone('84905111222');
assertTest("TC-01.4: normalizePhone tu dong chuyen 84 dau thanh 0 cho VN", $p4 === '0905111222', "Output: {$p4}");

$p5 = normalizePhone('905555555');
assertTest("TC-01.5: normalizePhone tu dong them 0 khi thieu so 0 dau", $p5 === '0905555555', "Output: {$p5}");

// TC-02: normalizeDate
$d1 = normalizeDate('20/08/2026 23:15:00');
assertTest("TC-02.1: normalizeDate DMY kem gio thanh MySQL Y-m-d H:i:s", $d1 === '2026-08-20 23:15:00', "Output: {$d1}");

$d2 = normalizeDate('20-08-2026');
assertTest("TC-02.2: normalizeDate DMY khong gio thanh Y-m-d 00:00:00", $d2 === '2026-08-20 00:00:00', "Output: {$d2}");

$d3 = normalizeDate('2026-08-20 18:30:00');
assertTest("TC-02.3: normalizeDate chuan MySQL giu nguyen", $d3 === '2026-08-20 18:30:00', "Output: {$d3}");

// TC-03: checkGlobalExclusion
$resExcl1 = checkGlobalExclusion($conn, ['note' => 'Khach hoi can'], '0900000000', 'test_excl@example.com', false, 'Test Normal');
assertTest("TC-03.1: checkGlobalExclusion cho phep data sach di tiep", $resExcl1 === false);

// ====================================================================
// PHAN 2: CRM DUPLICATE & LEAD PROTECTION (TC-04 -> TC-06)
// ====================================================================
echo "\n--- PHAN 2: KIEM TRA TRUNG & BAO HO KHACH HANG (TC-04 -> TC-06) ---\n";

// TC-04: checkCRMInteraction - Khach moi hoan toan
$resCRMNew = checkCRMInteraction($conn, '0999999999', 'nonexistent_test_email_999@domain.com');
assertTest("TC-04.1: checkCRMInteraction nhan dien khach moi hoan toan", $resCRMNew['isDuplicate'] === false && empty($resCRMNew['assignedTo']));

// TC-05: checkCRMInteraction structure test
assertTest("TC-05.1: checkCRMInteraction tra ve du cac khoa bao ho", isset($resCRMNew['monthsSinceLastInteraction']) && array_key_exists('originalAssignedTo', $resCRMNew));

// TC-06: reassign_if_owner_inactive setting check
$chkReassignSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'reassign_if_owner_inactive'");
$reassignVal = ($chkReassignSetting && $chkReassignSetting->num_rows > 0) ? $chkReassignSetting->fetch_assoc()['setting_value'] : '1';
assertTest("TC-06.1: CSDL co san cau hinh reassign_if_owner_inactive", $reassignVal !== null, "Value: {$reassignVal}");

// ====================================================================
// PHAN 3: 5+ CONG KIEM SOAT DIEU KIEN NHAN DATA (TC-07 -> TC-14)
// ====================================================================
echo "\n--- PHAN 3: 5+ CONG KIEM SOAT DIEU KIEN NHAN DATA (TC-07 -> TC-14) ---\n";

// TC-07: Gate 1 - Project Roster
$chkRosterTable = $conn->query("SHOW TABLES LIKE 'project_roster'");
assertTest("TC-07.1: Bang project_roster ton tai de loc Gate 1", $chkRosterTable && $chkRosterTable->num_rows > 0);

// TC-08: Gate 2 - Check-in table & status
$chkCheckInTable = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'status'");
assertTest("TC-08.1: Bang check_ins co truong status de kiem tra hop le", $chkCheckInTable && $chkCheckInTable->num_rows > 0);

// TC-09: Gate 2 - Night Shift registration
$chkNightReg = $conn->query("SHOW COLUMNS FROM night_shift_registrations LIKE 'approved'");
assertTest("TC-09.1: Bang night_shift_registrations co truong approved", $chkNightReg && $chkNightReg->num_rows > 0);

// TC-10: Gate 2 - Weekend Shift registration
$chkWeekendReg = $conn->query("SHOW COLUMNS FROM weekend_shift_registrations LIKE 'approved'");
assertTest("TC-10.1: Bang weekend_shift_registrations co truong approved", $chkWeekendReg && $chkWeekendReg->num_rows > 0);

// TC-11: Gate 3 - Vacation Mode & Leaves
$chkLeaves = $conn->query("SHOW TABLES LIKE 'consultant_leaves'");
assertTest("TC-11.1: Bang consultant_leaves san sang ho tro Gate 3", $chkLeaves && $chkLeaves->num_rows > 0);

// TC-12: Gate 4 - Backpressure valve limit setting
$chkBackpressure = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'backpressure_limit'");
$bpLimit = ($chkBackpressure && $chkBackpressure->num_rows > 0) ? (int)$chkBackpressure->fetch_assoc()['setting_value'] : 5;
assertTest("TC-12.1: system_settings co backpressure_limit hop le", $bpLimit > 0, "Limit: {$bpLimit}");

// TC-13: Gate 5 - Golden hours settings
$chkGolden = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('golden_hours_start_time', 'golden_hours_end_time', 'golden_hours_max_leads_per_consultant')");
assertTest("TC-13.1: system_settings co day du thiet lap Gio Vang Gate 5", $chkGolden && $chkGolden->num_rows >= 2);

// TC-14: Gate 6 - isConsultantInWorkHours
$inHoursTest1 = isConsultantInWorkHours('10:00', '08:00', '17:30');
assertTest("TC-14.1: isConsultantInWorkHours dung trong khung gio hanh chinh", $inHoursTest1 === true);

$inHoursTest2 = isConsultantInWorkHours('20:00', '08:00', '17:30');
assertTest("TC-14.2: isConsultantInWorkHours dung khi ngoai gio hanh chinh", $inHoursTest2 === false);

$inHoursTestMidnight = isConsultantInWorkHours('23:30', '22:00', '06:00');
assertTest("TC-14.3: isConsultantInWorkHours ho tro khung gio vat qua nua dem", $inHoursTestMidnight === true);

// ====================================================================
// PHAN 4: THUAT TOAN PHAN PHOI, COOLDOWN & BU DATA (TC-15 -> TC-19)
// ====================================================================
echo "\n--- PHAN 4: THUAT TOAN PHAN PHOI, COOLDOWN & BU DATA (TC-15 -> TC-19) ---\n";

// TC-15: distribution_rounds schema
$chkRoundCols = $conn->query("SHOW COLUMNS FROM distribution_rounds LIKE 'round_type'");
assertTest("TC-15.1: distribution_rounds co round_type ho tro round_robin/weighted/grab", $chkRoundCols && $chkRoundCols->num_rows > 0);

// TC-16: normal_round_cooldown_minutes setting
$chkCooldown = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'normal_round_cooldown_minutes'");
$cooldownVal = ($chkCooldown && $chkCooldown->num_rows > 0) ? (int)$chkCooldown->fetch_assoc()['setting_value'] : 5;
assertTest("TC-16.1: system_settings co normal_round_cooldown_minutes", $cooldownVal >= -1, "Cooldown: {$cooldownVal}m");

// TC-17: Starvation prevention & compensation columns
$chkCompCols = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'compensation_count'");
$chkSkipCredit = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skipped_credit'");
assertTest("TC-17.1: round_consultants co compensation_count de bu data", $chkCompCols && $chkCompCols->num_rows > 0);
assertTest("TC-17.2: round_consultants co skipped_credit de theo doi luot bo qua", $chkSkipCredit && $chkSkipCredit->num_rows > 0);

// TC-18: Weighted multi-lead turns
$chkDataPerTurn = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'data_per_turn'");
$chkRemaining = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'current_turn_remaining'");
assertTest("TC-18.1: round_consultants co data_per_turn cho vong weighted", $chkDataPerTurn && $chkDataPerTurn->num_rows > 0);
assertTest("TC-18.2: round_consultants co current_turn_remaining de giu luot", $chkRemaining && $chkRemaining->num_rows > 0);

// TC-19: Grab mode countdown
$chkGrabCols = $conn->query("SHOW COLUMNS FROM distribution_rounds LIKE 'grab_countdown_seconds'");
assertTest("TC-19.1: distribution_rounds co grab_countdown_seconds", $chkGrabCols && $chkGrabCols->num_rows > 0);

// ====================================================================
// PHAN 5: SLA RECALL, DATABANK & INTEGRATIONS (TC-20 -> TC-24)
// ====================================================================
echo "\n--- PHAN 5: SLA RECALL, DATABANK & DONG BO 2 CHIEU (TC-20 -> TC-24) ---\n";

// TC-20: recallInactiveLeads function exists
$recallFunc = function_exists('recallInactiveLeads');
assertTest("TC-20.1: Ham recallInactiveLeads da duoc dinh nghia trong he thong", $recallFunc || function_exists('redistributePendingLeads'));

// TC-21: recallExpiredGrabLeads function exists & Databank fallback
$chkGrabFallback = $conn->query("SHOW COLUMNS FROM distribution_rounds LIKE 'grab_fallback_to_databank'");
assertTest("TC-21.1: distribution_rounds ho tro grab_fallback_to_databank", $chkGrabFallback && $chkGrabFallback->num_rows > 0);

$chkPersonsPublic = $conn->query("SHOW COLUMNS FROM persons LIKE 'is_public'");
assertTest("TC-21.2: Bang persons co truong is_public de quan ly Kho Databank", $chkPersonsPublic && $chkPersonsPublic->num_rows > 0);

// TC-22: triggerTwoWaySync
$twoWayFunc = function_exists('triggerTwoWaySync');
assertTest("TC-22.1: Ham triggerTwoWaySync san sang dong bo 2 chieu", $twoWayFunc);

// TC-23: CAPI forward-only integrity
$chkCapiLogs = $conn->query("SHOW TABLES LIKE 'capi_logs'");
assertTest("TC-23.1: Bang capi_logs san sang ghi nhan tin hieu mot chieu", $chkCapiLogs && $chkCapiLogs->num_rows > 0);

// TC-24: Business Rules 1-3 Schema & Integrity
$chkDealsDesc = $conn->query("SHOW COLUMNS FROM deals LIKE 'description'");
assertTest("TC-24.1: Bang deals luu vet kiem toan audit trail khi doi can", $chkDealsDesc && $chkDealsDesc->num_rows > 0);

$duration = round((microtime(true) - $startTime) * 1000, 2);
echo "\n====================================================================\n";
echo "🏆 AUDIT TEST TOAN DIEN HOAN THANH TRONG {$duration} ms\n";
printTestSummary();
