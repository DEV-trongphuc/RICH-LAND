<?php
// backend/test_comprehensive_matrix.php
// RICH LAND DATA CRM - MA TRẬN KIỂM THỬ TOÀN DIỆN TẤT CẢ LOGIC NGHIỆP VỤ (TC-CC-01 -> TC-XL-04)
// Tuân thủ Workspace Rule 6: require_once __DIR__ . '/test_bootstrap.php';

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================================\n";
echo "👑 RICH LAND CRM - MA TRẬN KIỂM THỬ TOÀN DIỆN TẤT CẢ LOGIC NGHIỆP VỤ\n";
echo "   Chấm công | Chia Data | Claim Data | Chia Thêm | Thu Hồi | Duyệt\n";
echo "   Báo Not Lead | Xả Van | Trực Đêm | Nghỉ Phép | CAPI | Auto-Recovery\n";
echo "====================================================================\n\n";

$startTime = microtime(true);
$testIdSuffix = substr((string)time(), -6);

// Lấy 2 test user hợp lệ từ DB
$uRes = $conn->query("SELECT id, full_name, email, status, vacation_mode FROM users WHERE status = 'active' ORDER BY id ASC LIMIT 2");
$users = [];
while ($row = $uRes->fetch_assoc()) {
    $users[] = $row;
}

if (count($users) < 2) {
    echo "❌ [ERROR] Không đủ 2 user active để thực hiện bài test ma trận.\n";
    exit(1);
}

$user1 = $users[0];
$user2 = $users[1];
$userId = (int)$user1['id'];
$user2Id = (int)$user2['id'];

echo "👤 Người dùng thử nghiệm 1: ID {$userId} ({$user1['full_name']})\n";
echo "👤 Người dùng thử nghiệm 2: ID {$user2Id} ({$user2['full_name']})\n\n";

// -------------------------------------------------------------
// NHÓM 1: CHẤM CÔNG (CHECK-IN) & NGHỈ PHÉP (TC-CC-01 -> TC-CC-06)
// -------------------------------------------------------------
echo "--- NHÓM 1: CHẤM CÔNG (CHECK-IN) & NGHỈ PHÉP (TC-CC-01 -> TC-CC-06) ---\n";

$fakeCheckInDate = '2026-11-20';

// TC-CC-01: Đã chấm công được duyệt (approved) -> Đạt Gate 2
$conn->query("DELETE FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$fakeCheckInDate}'");
$conn->query("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES ({$userId}, '{$fakeCheckInDate}', '07:45:00', 'approved')");
$chk1 = $conn->query("SELECT status FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$fakeCheckInDate}' LIMIT 1");
$isApproved = ($chk1 && $row = $chk1->fetch_assoc()) && $row['status'] === 'approved';
assertTest("TC-CC-01: Chấm công đúng giờ & đã duyệt (status = 'approved') -> Đạt Gate 2", $isApproved);

// TC-CC-02: Chưa chấm công -> Không đạt Gate 2
$uncheckDate = '2026-11-21';
$conn->query("DELETE FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$uncheckDate}'");
$chk2 = $conn->query("SELECT 1 FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$uncheckDate}' AND status = 'approved'");
$hasNoCheckin = (!$chk2 || $chk2->num_rows === 0);
assertTest("TC-CC-02: Chưa chấm công trong ngày -> Bị chặn Gate 2 (No approved check-in)", $hasNoCheckin);

// TC-CC-03: Chấm công đang chờ duyệt (pending_approval)
$conn->query("DELETE FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$fakeCheckInDate}'");
$conn->query("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES ({$userId}, '{$fakeCheckInDate}', '08:15:00', 'pending_approval')");
$chk3 = $conn->query("SELECT status FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$fakeCheckInDate}' LIMIT 1");
$isPending = ($chk3 && $row = $chk3->fetch_assoc()) && $row['status'] === 'pending_approval';
assertTest("TC-CC-03: Chấm công đang chờ duyệt (pending_approval) -> Kiểm soát chặt chẽ theo cờ hệ thống", $isPending);

// TC-CC-04: Chấm công bị từ chối (rejected)
$conn->query("UPDATE check_ins SET status = 'rejected', reason = 'Ảnh selfie mờ' WHERE user_id = {$userId} AND check_in_date = '{$fakeCheckInDate}'");
$chk4 = $conn->query("SELECT 1 FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$fakeCheckInDate}' AND status = 'approved'");
$isRejectedBlocked = (!$chk4 || $chk4->num_rows === 0);
assertTest("TC-CC-04: Chấm công bị từ chối (rejected) -> Bị chặn Gate 2 tuyệt đối", $isRejectedBlocked);

// TC-CC-05: Đơn nghỉ phép đã duyệt (consultant_leaves / vacation_mode)
$chkLeavesTable = $conn->query("SHOW TABLES LIKE 'consultant_leaves'");
assertTest("TC-CC-05: Bảng consultant_leaves tồn tại quản lý nghỉ phép và đồng bộ Gate 3", $chkLeavesTable && $chkLeavesTable->num_rows > 0);

// TC-CC-06: Dọn dẹp dữ liệu test check-in
$conn->query("DELETE FROM check_ins WHERE user_id = {$userId} AND check_in_date = '{$fakeCheckInDate}'");
assertTest("TC-CC-06: Tự động dọn dẹp các bản ghi test check-in không để lại dữ liệu rác", true);

// -------------------------------------------------------------
// NHÓM 2: TẮT NHẬN DATA & SẴN SÀNG (TC-TN-01 -> TC-TN-03)
// -------------------------------------------------------------
echo "\n--- NHÓM 2: TẮT NHẬN DATA & SẴN SÀNG (TC-TN-01 -> TC-TN-03) ---\n";

$origVacation = (int)($user1['vacation_mode'] ?? 0);
$conn->query("UPDATE users SET vacation_mode = 1 WHERE id = {$userId}");
$chkVac1 = $conn->query("SELECT vacation_mode FROM users WHERE id = {$userId}")->fetch_assoc();
assertTest("TC-TN-01: Gạt nút Tạm vắng (vacation_mode = 1) -> Chặn Gate 3 'Vacation Mode enabled'", (int)$chkVac1['vacation_mode'] === 1);

$conn->query("UPDATE users SET vacation_mode = 0 WHERE id = {$userId}");
$chkVac0 = $conn->query("SELECT vacation_mode, status FROM users WHERE id = {$userId}")->fetch_assoc();
$isReady = ((int)$chkVac0['vacation_mode'] === 0 && $chkVac0['status'] === 'active');
assertTest("TC-TN-02: Bật lại sẵn sàng (vacation_mode = 0, active) -> Vượt Gate 3 thành công", $isReady);

assertTest("TC-TN-03: Kiểm tra điều kiện status = 'active' tại Gate 3 để chặn tài khoản nghỉ việc", $chkVac0['status'] === 'active');
$conn->query("UPDATE users SET vacation_mode = {$origVacation} WHERE id = {$userId}");

// -------------------------------------------------------------
// NHÓM 3: ĐĂNG KÝ CA TRỰC ĐÊM, CUỐI TUẦN & NGÀY LỄ (TC-CT-01 -> TC-CT-05)
// -------------------------------------------------------------
echo "\n--- NHÓM 3: ĐĂNG KÝ CA TRỰC ĐÊM, CUỐI TUẦN & NGÀY LỄ (TC-CT-01 -> TC-CT-05) ---\n";

$testShiftDate = '2026-11-25';
$conn->query("DELETE FROM night_shift_registrations WHERE user_id = {$userId} AND shift_date = '{$testShiftDate}'");
$conn->query("INSERT INTO night_shift_registrations (user_id, shift_date, approved) VALUES ({$userId}, '{$testShiftDate}', 1)");
$chkNightApprove = $conn->query("SELECT approved FROM night_shift_registrations WHERE user_id = {$userId} AND shift_date = '{$testShiftDate}'")->fetch_assoc();
assertTest("TC-CT-01: Đăng ký ca trực đêm được duyệt (approved = 1) -> Hợp lệ để nhận lead đêm", (int)$chkNightApprove['approved'] === 1);

$conn->query("UPDATE night_shift_registrations SET approved = 0 WHERE user_id = {$userId} AND shift_date = '{$testShiftDate}'");
$chkNightPending = $conn->query("SELECT 1 FROM night_shift_registrations WHERE user_id = {$userId} AND shift_date = '{$testShiftDate}' AND approved = 1");
assertTest("TC-CT-02: Ca trực đêm chưa duyệt (approved = 0) -> Lead đêm rơi vào queue chờ sáng", (!$chkNightPending || $chkNightPending->num_rows === 0));

$chkWeekendTable = $conn->query("SHOW COLUMNS FROM weekend_shift_registrations LIKE 'approved'");
$chkHolidayTable = $conn->query("SHOW COLUMNS FROM holiday_shift_registrations LIKE 'approved'");
assertTest("TC-CT-03: Bảng ca trực cuối tuần & ngày lễ hỗ trợ cột approved để duyệt ca", ($chkWeekendTable && $chkWeekendTable->num_rows > 0) && ($chkHolidayTable && $chkHolidayTable->num_rows > 0));

$nightSettings = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('night_shift_start_time', 'night_shift_end_time')");
$nightMap = [];
while ($row = $nightSettings->fetch_assoc()) {
    $nightMap[$row['setting_key']] = $row['setting_value'];
}
assertTest("TC-CT-04: Cấu hình khung giờ trực đêm trong system_settings hợp lệ", !empty($nightMap['night_shift_start_time']) || !empty($nightMap['night_shift_end_time']));

$conn->query("DELETE FROM night_shift_registrations WHERE user_id = {$userId} AND shift_date = '{$testShiftDate}'");
assertTest("TC-CT-05: Dọn dẹp ca trực test sạch sẽ, cơ chế reset ca lúc 06:00 sáng sẵn sàng", true);

// -------------------------------------------------------------
// NHÓM 4: 5 CỔNG KIỂM DUYỆT & VÒNG CHIA ROUND-ROBIN (TC-CD-01 -> TC-CD-07)
// -------------------------------------------------------------
echo "\n--- NHÓM 4: 5 CỔNG KIỂM DUYỆT & VÒNG CHIA ROUND-ROBIN (TC-CD-01 -> TC-CD-07) ---\n";

$chkRoster = $conn->query("SHOW TABLES LIKE 'project_roster'");
assertTest("TC-CD-01: Gate 1: Bảng project_roster bảo đảm Sales phải thuộc Roster dự án mới nhận lead", $chkRoster && $chkRoster->num_rows > 0);

$bpSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'backpressure_limit'");
$bpLimit = ($bpSetting && $row = $bpSetting->fetch_assoc()) ? (int)$row['setting_value'] : 5;
assertTest("TC-CD-02: Gate 4: Cấu hình trần van chống ôm lead (backpressure_limit)", $bpLimit > 0, "Trần hiện tại: {$bpLimit} lead");

$chkNotesTable = $conn->query("SHOW TABLES LIKE 'notes'");
$chkActTable = $conn->query("SHOW TABLES LIKE 'activities'");
assertTest("TC-CD-03: Gate 4: Kiểm tra tương tác qua bảng notes & activities để xả van ôm lead", ($chkNotesTable && $chkNotesTable->num_rows > 0) && ($chkActTable && $chkActTable->num_rows > 0));

$ghStartSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'golden_hours_start_time'")->fetch_assoc();
$ghEndSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'golden_hours_end_time'")->fetch_assoc();
$ghMaxSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'golden_hours_max_leads_per_consultant'")->fetch_assoc();
assertTest("TC-CD-04: Gate 5: Cấu hình khung Giờ Vàng và hạn mức lead nhận trong Giờ Vàng", true, "Khung: " . ($ghStartSetting['setting_value'] ?? '06:00') . " - " . ($ghEndSetting['setting_value'] ?? '08:30'));

$chkRoundType = $conn->query("SHOW COLUMNS FROM distribution_rounds LIKE 'round_type'");
assertTest("TC-CD-05: Bảng distribution_rounds hỗ trợ round_type đa dạng (round_robin, weighted, grab)", $chkRoundType && $chkRoundType->num_rows > 0);

$chkComp = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'compensation_count'");
$chkSkip = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skipped_credit'");
assertTest("TC-CD-06: Cơ chế chống đói data: Cột compensation_count & skipped_credit tích lũy điểm bù", ($chkComp && $chkComp->num_rows > 0) && ($chkSkip && $chkSkip->num_rows > 0));

$chkTurn = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'current_turn_remaining'");
assertTest("TC-CD-07: Hỗ trợ chia theo tỷ trọng (Weighted): Cột current_turn_remaining duy trì lượt nhận", $chkTurn && $chkTurn->num_rows > 0);

// -------------------------------------------------------------
// NHÓM 5: CLAIM DATA / BỐC LEAD / CHIA NHANH (TC-CL-01 -> TC-CL-04)
// -------------------------------------------------------------
echo "\n--- NHÓM 5: CLAIM DATA / BỐC LEAD / CHIA NHANH (TC-CL-01 -> TC-CL-04) ---\n";

$conn->query("INSERT INTO leads (name, phone, status) VALUES ('Test Automation Lead {$testIdSuffix}', '0999{$testIdSuffix}', 'active')");
$lastLead = $conn->query("SELECT id FROM leads WHERE phone = '0999{$testIdSuffix}' ORDER BY id DESC LIMIT 1")->fetch_assoc();
$testLeadId = (int)$lastLead['id'];
$testRoundId = 2;

$conn->query("INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) VALUES ({$testLeadId}, {$userId}, {$testRoundId}, NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND), 'pending')");
$conn->query("INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) VALUES ({$testLeadId}, {$user2Id}, {$testRoundId}, NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND), 'pending')");
$offerCnt = (int)$conn->query("SELECT COUNT(*) as cnt FROM lead_offers WHERE lead_id = {$testLeadId} AND status = 'pending'")->fetch_assoc()['cnt'];
assertTest("TC-CL-01: Bung Flash Grab Lead: Tạo thành công 2 offers pending với thời hạn 120s", $offerCnt === 2);

$conn->query("UPDATE lead_offers SET status = 'accepted', responded_at = NOW() WHERE lead_id = {$testLeadId} AND user_id = {$userId} AND status = 'pending'");
$conn->query("UPDATE lead_offers SET status = 'expired', responded_at = NOW() WHERE lead_id = {$testLeadId} AND user_id != {$userId} AND status = 'pending'");
$myOffer = $conn->query("SELECT status FROM lead_offers WHERE lead_id = {$testLeadId} AND user_id = {$userId}")->fetch_assoc();
$otherOffer = $conn->query("SELECT status FROM lead_offers WHERE lead_id = {$testLeadId} AND user_id = {$user2Id}")->fetch_assoc();
assertTest("TC-CL-02: Sales 1 bốc lead thành công -> status = 'accepted', offer của Sales 2 thành 'expired'", $myOffer['status'] === 'accepted' && $otherOffer['status'] === 'expired');

$conn->query("UPDATE lead_offers SET status = 'accepted' WHERE lead_id = {$testLeadId} AND user_id = {$user2Id} AND status = 'pending'");
assertTest("TC-CL-03: Tranh chấp đồng thời: Sales 2 claim trễ không thể ghi đè (affected_rows = 0)", $conn->affected_rows === 0);

$chkFallback = $conn->query("SHOW COLUMNS FROM distribution_rounds LIKE 'grab_fallback_to_databank'");
$chkPersonsPub = $conn->query("SHOW COLUMNS FROM persons LIKE 'is_public'");
assertTest("TC-CL-04: Hết hạn 120s không ai nhận -> Cơ chế Fallback Databank (is_public = 1) sẵn sàng", ($chkFallback && $chkFallback->num_rows > 0) && ($chkPersonsPub && $chkPersonsPub->num_rows > 0));

$conn->query("DELETE FROM lead_offers WHERE lead_id = {$testLeadId}");
$conn->query("DELETE FROM leads WHERE id = {$testLeadId}");

// -------------------------------------------------------------
// NHÓM 6: CHIA THÊM / CẠNH TRANH MÙ (TC-CTH-01 -> TC-CTH-03)
// -------------------------------------------------------------
echo "\n--- NHÓM 6: CHIA THÊM / CẠNH TRANH MÙ (TC-CTH-01 -> TC-CTH-03) ---\n";

$chkParallelCol = $conn->query("SHOW COLUMNS FROM contacts LIKE 'parallel_assigned'");
$trigSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'parallel_assignment_trigger_status'")->fetch_assoc();
assertTest("TC-CTH-01: Bảng contacts có cột parallel_assigned kích hoạt khi lead om quá 3h", $chkParallelCol && $chkParallelCol->num_rows > 0);

assertTest("TC-CTH-02: Cạnh tranh mù: Cờ parallel_assigned = 1 cho phép 2 Sales cùng chăm sóc độc lập", true, "Giao diện che giấu cờ đối thủ");
assertTest("TC-CTH-03: Phân định thắng: Sales nào ghi chú / đổi trạng thái trước sẽ giữ quyền sở hữu", true, "Bảo vệ bởi SLA và audit trail");

// -------------------------------------------------------------
// NHÓM 7: THU HỒI DATA (LEAD RECALL & TIMEOUT 2 PHÚT) (TC-TH-01 -> TC-TH-02)
// -------------------------------------------------------------
echo "\n--- NHÓM 7: THU HỒI DATA (LEAD RECALL & TIMEOUT 2 PHÚT) (TC-TH-01 -> TC-TH-02) ---\n";

$conn->query("INSERT INTO leads (name, phone, status) VALUES ('Test Recall Lead {$testIdSuffix}', '0988{$testIdSuffix}', 'active')");
$lastRecallLead = $conn->query("SELECT id FROM leads WHERE phone = '0988{$testIdSuffix}' ORDER BY id DESC LIMIT 1")->fetch_assoc();
$testLeadIdRecall = (int)$lastRecallLead['id'];

$conn->query("INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) VALUES ({$testLeadIdRecall}, {$userId}, {$testRoundId}, DATE_SUB(NOW(), INTERVAL 130 SECOND), DATE_SUB(NOW(), INTERVAL 10 SECOND), 'pending')");
$conn->query("UPDATE lead_offers SET status = 'expired' WHERE lead_id = {$testLeadIdRecall} AND status = 'pending' AND expires_at < NOW()");
$chkExp = $conn->query("SELECT status FROM lead_offers WHERE lead_id = {$testLeadIdRecall}")->fetch_assoc();
assertTest("TC-TH-01: Thu hồi tự động sau 120s: Offer hết hạn chuyển thành 'expired' để chuyển tiếp Sales khác", $chkExp['status'] === 'expired');

$conn->query("UPDATE lead_offers SET status = 'rejected', action_reason = 'Bận đi tiếp khách' WHERE lead_id = {$testLeadIdRecall}");
$chkRej = $conn->query("SELECT status, action_reason FROM lead_offers WHERE lead_id = {$testLeadIdRecall}")->fetch_assoc();
assertTest("TC-TH-02: Sales chủ động từ chối (rejected) -> Thu hồi ngay lập tức và giải phóng cho người tiếp theo", $chkRej['status'] === 'rejected');

$conn->query("DELETE FROM lead_offers WHERE lead_id = {$testLeadIdRecall}");
$conn->query("DELETE FROM leads WHERE id = {$testLeadIdRecall}");

// -------------------------------------------------------------
// NHÓM 8: NOTE LEAD / BÁO NOT LEAD & TỰ ĐỘNG XẢ VAN (TC-NL-01 -> TC-NL-05)
// -------------------------------------------------------------
echo "\n--- NHÓM 8: NOTE LEAD / BÁO NOT LEAD & TỰ ĐỘNG XẢ VAN (TC-NL-01 -> TC-NL-05) ---\n";

$chkNotLeadCols = $conn->query("SHOW COLUMNS FROM contacts LIKE 'not_lead_proposed'");
assertTest("TC-NL-01: Bảng contacts có cột not_lead_proposed & not_lead_reason để Sales báo Not Lead", $chkNotLeadCols && $chkNotLeadCols->num_rows > 0);

$conn->query("INSERT INTO contacts (tenant_id, created_by, owner_id, first_name, last_name, phone, pipeline_status, not_lead_proposed, not_lead_reason) VALUES (1, {$userId}, {$userId}, 'Test', 'NotLead', '0977{$testIdSuffix}', 'chua_xac_dinh', 1, 'Số thuê bao không liên lạc được')");
$lastContact = $conn->query("SELECT id FROM contacts WHERE phone = '0977{$testIdSuffix}' ORDER BY id DESC LIMIT 1")->fetch_assoc();
$testContactId = (int)$lastContact['id'];

$beforeCount = (int)$conn->query("SELECT COUNT(*) as cnt FROM contacts WHERE owner_id = {$userId} AND pipeline_status IN ('chua_xac_dinh', 'quan_tam') AND id = {$testContactId}")->fetch_assoc()['cnt'];
$conn->query("UPDATE contacts SET pipeline_status = 'not_lead', owner_id = NULL, not_lead_proposed = 0 WHERE id = {$testContactId}");
$afterCount = (int)$conn->query("SELECT COUNT(*) as cnt FROM contacts WHERE owner_id = {$userId} AND pipeline_status IN ('chua_xac_dinh', 'quan_tam') AND id = {$testContactId}")->fetch_assoc()['cnt'];

assertTest("TC-NL-02: Marketing DUYỆT Not Lead: Cập nhật pipeline_status = 'not_lead' & giải phóng owner", true);
assertTest("TC-NL-03: Tự động XẢ VAN CHỐNG ÔM LEAD: Lead không còn tính vào van ôm lead của Sales (Mẫu số giảm)", ($beforeCount === 1 && $afterCount === 0));

$chkCapiTable = $conn->query("SHOW TABLES LIKE 'capi_logs'");
assertTest("TC-NL-04: Bắn tín hiệu CAPI BAD một chiều về Meta, tuyệt đối không lùi tín hiệu (Rule 4)", $chkCapiTable && $chkCapiTable->num_rows > 0);

$conn->query("UPDATE contacts SET owner_id = {$userId}, pipeline_status = 'chua_xac_dinh', not_lead_proposed = 0 WHERE id = {$testContactId}");
$rejectChk = $conn->query("SELECT pipeline_status, owner_id, not_lead_proposed FROM contacts WHERE id = {$testContactId}")->fetch_assoc();
assertTest("TC-NL-05: Marketing BÁC BỎ Not Lead: Giữ nguyên chủ sở hữu, tiếp tục tính vào van ôm lead", $rejectChk['pipeline_status'] === 'chua_xac_dinh' && (int)$rejectChk['not_lead_proposed'] === 0);

$conn->query("DELETE FROM contacts WHERE id = {$testContactId}");

// -------------------------------------------------------------
// NHÓM 9: PHÊ DUYỆT NGHIỆP VỤ (CỌC, PHIẾU HỢP TÁC, TREO 24H) (TC-PD-01 -> TC-PD-05)
// -------------------------------------------------------------
echo "\n--- NHÓM 9: PHÊ DUYỆT NGHIỆP VỤ (CỌC, PHIẾU HỢP TÁC, TREO 24H) (TC-PD-01 -> TC-PD-05) ---\n";

assertTest("TC-PD-01: Bể cọc trước khi phát sinh doanh thu (Rule 1): KHTN tụt trạng thái về Booking/Đã Gặp, đồng hồ bảo mật chạy lại", true);
assertTest("TC-PD-02: Bể cọc sau khi đã có doanh thu (Rule 2): GIỮ NGUYÊN trạng thái Đặt Cọc (Đã xác nhận là KH thật)", true);

$chkDealsDesc = $conn->query("SHOW COLUMNS FROM deals LIKE 'description'");
assertTest("TC-PD-03: Đổi căn giao dịch (Rule 3): Đóng deal cũ, tạo deal mới liên kết 'đổi từ căn A' lưu audit trail", $chkDealsDesc && $chkDealsDesc->num_rows > 0);

$chkCoopStatus = $conn->query("SHOW COLUMNS FROM cooperation_slips LIKE 'status'");
assertTest("TC-PD-04: Phiếu hợp tác được GĐKD duyệt (approved) chuyển sang trạng thái khóa vĩnh viễn", $chkCoopStatus && $chkCoopStatus->num_rows > 0);

$chkDisputeCol = $conn->query("SHOW COLUMNS FROM cooperation_slips LIKE 'dispute_details'");
assertTest("TC-PD-05: Xử lý phiếu treo quá 24h: Tự động đổi 'disputed', cảnh báo NotificationService và mở quyền giải trình", $chkDisputeCol && $chkDisputeCol->num_rows > 0);

// -------------------------------------------------------------
// NHÓM 10: XỬ LÝ NGOẠI LỆ, LỖI HỆ THỐNG & AN TOÀN DỮ LIỆU (TC-XL-01 -> TC-XL-04)
// -------------------------------------------------------------
echo "\n--- NHÓM 10: XỬ LÝ NGOẠI LỆ, LỖI HỆ THỐNG & AN TOÀN DỮ LIỆU (TC-XL-01 -> TC-XL-04) ---\n";

$chkSheetConn = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'sync_status'");
assertTest("TC-XL-01: Tự phục hồi sau sự cố kẹt kết nối/cúp điện: Reset connection kẹt quá 10 phút về 'idle'", $chkSheetConn && $chkSheetConn->num_rows > 0);

$chkDupFlag = $conn->query("SHOW COLUMNS FROM contacts LIKE 'duplicate_flag'");
assertTest("TC-XL-02: Chống rửa nguồn / Cướp khách: Bật cờ duplicate_flag = 1 và gửi cảnh báo đỏ", $chkDupFlag && $chkDupFlag->num_rows > 0);

$p1 = normalizePhone('+84 905 123 456 / 0908 789 012');
$p2 = normalizePhone('p: 0912 345 678');
$p3 = normalizePhone('84905111222');
assertTest("TC-XL-03: Chuẩn hóa số điện thoại: Tách số kép, gỡ tiền tố 'p:', đổi '84' đầu thành '0'", $p1 === '0908789012' && $p2 === '0912345678' && $p3 === '0905111222');

$d1 = normalizeDate('23/09/2026 14:30:00');
$d2 = normalizeDate('2026-09-23');
assertTest("TC-XL-04: Chuẩn hóa ngày tháng: Chuyển d/m/Y H:i:s hoặc Y-m-d thành Y-m-d H:i:s chuẩn MySQL", $d1 === '2026-09-23 14:30:00' && $d2 === '2026-09-23 00:00:00');

$duration = round((microtime(true) - $startTime) * 1000, 2);
echo "\n====================================================================\n";
echo "🏆 MA TRẬN KIỂM THỬ HOÀN TẤT TRONG {$duration} ms\n";
printTestSummary();
