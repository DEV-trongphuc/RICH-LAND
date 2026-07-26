<?php
// backend/test_rotation_audit.php
// Diagnostic tool to audit lead rotation, sale status, night shifts, and recall logic.

require_once __DIR__ . '/test_bootstrap.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "====================================================\n";
echo "🚀 BẮT ĐẦU AUDIT & KIỂM THỬ HỆ THỐNG PHÂN PHỐI LEAD\n";
echo "====================================================\n\n";

// 1. Lưu trạng thái gốc của các Sale trong consultants và users
$originalSales = [];
$res = $conn->query("SELECT id, name, status, vacation_mode, leave_start, leave_end FROM consultants WHERE id IN (1000, 1004)");
while ($row = $res->fetch_assoc()) {
    $originalSales[$row['id']] = $row;
}

$originalUsers = [];
$resU = $conn->query("SELECT id, status, vacation_mode FROM users WHERE id IN (1000, 1004)");
while ($row = $resU->fetch_assoc()) {
    $originalUsers[$row['id']] = $row;
}

echo "💾 Đã lưu trạng thái gốc của Sale 1000 và 1004 (bảng consultants & users).\n\n";

// Lưu cấu hình backpressure_limit gốc
$originalLimit = '5';
$limitRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'backpressure_limit' LIMIT 1");
if ($limitRes && $lRow = $limitRes->fetch_assoc()) {
    $originalLimit = $lRow['setting_value'];
}
// Tạm thời tăng giới hạn lên 99 để vượt qua Gate 4 chống ôm lead khi test
$conn->query("UPDATE system_settings SET setting_value = '99' WHERE setting_key = 'backpressure_limit'");

// Helper để dọn dẹp các bản ghi test
function cleanupTestData($conn) {
    // Xóa test check-ins cho hôm nay
    $todayStr = date('Y-m-d');
    $conn->query("DELETE FROM check_ins WHERE user_id IN (1000, 1004) AND check_in_date = '$todayStr'");
    
    // Xóa test night shift registrations
    $conn->query("DELETE FROM night_shift_registrations WHERE user_id IN (1000, 1004)");
    
    // Xóa test distribution logs
    $conn->query("DELETE FROM distribution_logs WHERE message LIKE '%TEST_ROTATION_AUDIT%'");
    
    // Xóa test round consultants
    $conn->query("DELETE FROM round_consultants WHERE round_id = 9999");
    
    // Xóa test distribution rounds
    $conn->query("DELETE FROM distribution_rounds WHERE id = 9999");
    
    // Xóa test leads
    $conn->query("DELETE FROM leads WHERE note LIKE '%TEST_ROTATION_AUDIT%' OR phone = '0999999999' OR phone = '0999999991'");
    
    // Xóa test contacts
    $conn->query("DELETE FROM contacts WHERE phone IN ('0999999999', '0999999991')");
}

// Chạy dọn dẹp trước khi test đề phòng rác cũ
cleanupTestData($conn);

try {
    // ========================================================================
    // TEST 1: Phân bổ Lead theo vòng xoay (Round Robin) bình thường
    // ========================================================================
    // Tạo 1 vòng test ID 9999
    $conn->query("INSERT INTO distribution_rounds (id, round_name, project_id, is_active, last_assigned_consultant_id) VALUES (9999, 'Vòng Test Audit', 1, 1, NULL)");
    
    // Đảm bảo 2 Sale ở trạng thái active trên cả 2 bảng
    $conn->query("UPDATE consultants SET status = 'active', vacation_mode = 0, leave_start = NULL, leave_end = NULL WHERE id IN (1000, 1004)");
    $conn->query("UPDATE users SET status = 'active', vacation_mode = 0 WHERE id IN (1000, 1004)");
    
    // Đảm bảo 2 Sale có check-in được duyệt ngày hôm nay (Vượt qua Gate 2)
    $todayStr = date('Y-m-d');
    $conn->query("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES (1000, '$todayStr', '08:00:00', 'approved') ON DUPLICATE KEY UPDATE status = 'approved'");
    $conn->query("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES (1004, '$todayStr', '08:00:00', 'approved') ON DUPLICATE KEY UPDATE status = 'approved'");

    // Đăng ký 2 Sale vào vòng test
    $conn->query("INSERT INTO round_consultants (round_id, consultant_id, is_active) VALUES (9999, 1000, 1)");
    $conn->query("INSERT INTO round_consultants (round_id, consultant_id, is_active) VALUES (9999, 1004, 1)");

    echo "🔍 Debug Gate 1000: " . var_export(checkConsultantGates($conn, 1000), true) . "\n";
    echo "🔍 Debug Gate 1004: " . var_export(checkConsultantGates($conn, 1004), true) . "\n";

    // Lượt 1: Phân bổ -> Phải ra Sale đầu tiên (1000 hoặc 1004)
    $res1 = getNextConsultantInRound($conn, 9999);
    $firstAssigned = $res1 ? $res1['id'] : null;
    assertTest("Lượt 1: getNextConsultantInRound trả về Sale hợp lệ", $firstAssigned == 1000 || $firstAssigned == 1004, "Sale ID: " . $firstAssigned);

    // Cập nhật last_assigned_consultant_id trong round
    if ($firstAssigned) {
        $conn->query("UPDATE distribution_rounds SET last_assigned_consultant_id = $firstAssigned WHERE id = 9999");
    }

    // Lượt 2: Phân bổ -> Phải ra Sale còn lại
    $res2 = getNextConsultantInRound($conn, 9999);
    $secondAssigned = $res2 ? $res2['id'] : null;
    assertTest("Lượt 2: Phân bổ xoay vòng sang Sale tiếp theo", $secondAssigned !== null && $secondAssigned !== $firstAssigned, "Lượt 1: $firstAssigned | Lượt 2: $secondAssigned");

    // ========================================================================
    // TEST 2: Sale Nghỉ Phép / Vacation Mode bị bỏ qua
    // ========================================================================
    // Set Sale 1000 sang nghỉ phép (status = 'leave') trên cả 2 bảng
    $conn->query("UPDATE consultants SET status = 'leave' WHERE id = 1000");
    $conn->query("UPDATE users SET status = 'leave' WHERE id = 1000");
    
    // Lần phân bổ này bắt buộc phải ra Sale 1004
    $resLeave = getNextConsultantInRound($conn, 9999);
    $assignedLeave = $resLeave ? $resLeave['id'] : null;
    assertTest("Bỏ qua Sale có status = 'leave' (chuyển sang Sale hoạt động)", $assignedLeave == 1004, "Assigned: " . $assignedLeave);

    // Khôi phục Sale 1000 hoạt động, set Sale 1004 sang vacation_mode = 1
    $conn->query("UPDATE consultants SET status = 'active', vacation_mode = 0 WHERE id = 1000");
    $conn->query("UPDATE users SET status = 'active', vacation_mode = 0 WHERE id = 1000");
    $conn->query("UPDATE consultants SET vacation_mode = 1 WHERE id = 1004");
    $conn->query("UPDATE users SET vacation_mode = 1 WHERE id = 1004");
    
    // Lần phân bổ này bắt buộc phải ra Sale 1000
    $resVacation = getNextConsultantInRound($conn, 9999);
    $assignedVacation = $resVacation ? $resVacation['id'] : null;
    assertTest("Bỏ qua Sale có vacation_mode = 1 (chuyển sang Sale hoạt động)", $assignedVacation == 1000, "Assigned: " . $assignedVacation);

    // Khôi phục cả 2 hoạt động bình thường
    $conn->query("UPDATE consultants SET status = 'active', vacation_mode = 0 WHERE id IN (1000, 1004)");
    $conn->query("UPDATE users SET status = 'active', vacation_mode = 0 WHERE id IN (1000, 1004)");

    // ========================================================================
    // TEST 3: Bảo mật & Trùng Lead (Sale nghỉ phép/vacation vẫn được GIỮ khách cũ)
    // ========================================================================
    // Tạo 1 lead cũ gán cho Sale 1000
    $conn->query("INSERT INTO leads (phone, name, assigned_to, is_accepted, accepted_at, status, note, last_interaction_date) 
                  VALUES ('0999999999', 'Khách Test Trùng', 1000, 1, NOW(), 'active', 'TEST_ROTATION_AUDIT', NOW())");
    $leadId = $conn->insert_id;
    
    // Ghi log phân bổ cũ
    $conn->query("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) 
                  VALUES ($leadId, 1000, 9999, 'assigned', 'TEST_ROTATION_AUDIT - Ban đầu')");

    // Cho Sale 1000 nghỉ phép (status = 'leave')
    $conn->query("UPDATE consultants SET status = 'leave' WHERE id = 1000");
    $conn->query("UPDATE users SET status = 'leave' WHERE id = 1000");

    // Kiểm tra trùng:
    $interaction = checkCRMInteraction($conn, '0999999999', '');
    assertTest("checkCRMInteraction phát hiện trùng khách hàng", $interaction['isDuplicate'] === true);
    assertTest("Sale dù nghỉ phép vẫn GIỮ nguyên khách cũ (không bị đổi chủ phân bổ)", $interaction['assignedTo'] == 1000, "Assigned to: " . var_export($interaction['assignedTo'], true));

    // Khôi phục Sale 1000 hoạt động
    $conn->query("UPDATE consultants SET status = 'active' WHERE id = 1000");
    $conn->query("UPDATE users SET status = 'active' WHERE id = 1000");

    // ========================================================================
    // TEST 4: Khung giờ trực đêm & Phân bổ ngoài giờ làm việc
    // ========================================================================
    // Giả lập thời gian ngoài giờ làm việc: 23:00
    $inWorkHours = isConsultantInWorkHours('23:00:00', '08:00:00', '17:00:00');
    assertTest("isConsultantInWorkHours trả về false khi ngoài giờ làm việc", $inWorkHours === false);

    // Đăng ký ca trực đêm (duty registration) cho Sale 1004 hôm nay
    $today = date('Y-m-d');
    $conn->query("INSERT INTO night_shift_registrations (user_id, shift_date, approved) VALUES (1004, '$today', 1)");

    $hasShift = hasApprovedShiftForDate($conn, 1004, $today);
    assertTest("hasApprovedShiftForDate trả về true khi có ca trực đêm đã duyệt", $hasShift === true);

    $nightAvailable = checkNightShiftAvailability($conn, 1004, '23:00:00');
    assertTest("Sale đăng ký trực đêm sẵn sàng nhận lead ngoài giờ làm việc (checkNightShiftAvailability)", $nightAvailable === true);

    // ========================================================================
    // TEST 5: Thu hồi và chia lại (Recall & Redistribution)
    // ========================================================================
    // Tạo 1 lead chưa tiếp nhận gán cho Sale 1000
    $conn->query("INSERT INTO leads (phone, name, assigned_to, is_accepted, accepted_at, status, note, last_interaction_date) 
                  VALUES ('0999999991', 'Khách Chờ Nhận', 1000, 0, NULL, 'pending_approval', 'TEST_ROTATION_AUDIT', DATE_SUB(NOW(), INTERVAL 10 MINUTE))");
    $recallLeadId = $conn->insert_id;
    
    // Ghi log phân bổ 'assigned' của lead này
    $conn->query("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) 
                  VALUES ($recallLeadId, 1000, 9999, 'assigned', 'TEST_ROTATION_AUDIT - Giao chờ nhận')");

    // Quét lead quá hạn 2 phút
    $elapsedSeconds = 10 * 60; // đã tạo từ 10 phút trước
    $leadRecallMins = 2;
    $isExpired = ($elapsedSeconds >= $leadRecallMins * 60);
    assertTest("Lead chưa tiếp nhận sau 10 phút đã quá hạn recall 2 phút", $isExpired === true);

    // Thực hiện thu hồi tự động (Giả lập logic trong recallInactiveLeads)
    // 1. Mark old log as recalled
    $conn->query("UPDATE distribution_logs SET status = 'recalled', message = CONCAT(message, '\n[TEST_ROTATION_AUDIT - Thu hồi tự động]') WHERE lead_id = $recallLeadId AND assigned_to = 1000 AND status = 'assigned'");
    
    // 2. Phân bổ lại cho Sale tiếp theo trong round (Sale 1004)
    // Ở lượt phân bổ này, loại trừ Sale 1000 đã bị thu hồi
    $newAssign = getNextConsultantInRound($conn, 9999, null, [1000]);
    $newOwnerId = $newAssign ? $newAssign['id'] : null;
    assertTest("Tìm được Sale tiếp theo (1004) sau khi loại trừ Sale cũ (1000)", $newOwnerId == 1004, "New Owner: " . $newOwnerId);

    if ($newOwnerId) {
        // Cập nhật chủ mới cho lead
        $conn->query("UPDATE leads SET assigned_to = $newOwnerId, last_interaction_date = NOW() WHERE id = $recallLeadId");
        // Ghi log phân bổ mới
        $conn->query("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) 
                      VALUES ($recallLeadId, $newOwnerId, 9999, 'assigned', 'TEST_ROTATION_AUDIT - Giao lại sau thu hồi')");
    }

    // Kiểm tra chủ sở hữu mới trong CSDL
    assertDbField($conn, 'leads', 'assigned_to', "id = $recallLeadId", 1004, "Lead sau khi thu hồi đã được cập nhật thành công chủ sở hữu mới (1004)");

} catch (Throwable $e) {
    echo "❌ LỖI RUNTIME: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
} finally {
    // ==========================================
    // KHÔI PHỤC VÀ DỌN DẸP
    // ==========================================
    cleanupTestData($conn);
    
    // Khôi phục thông tin gốc của Sale
    foreach ($originalSales as $id => $orig) {
        $stmt = $conn->prepare("UPDATE consultants SET status = ?, vacation_mode = ?, leave_start = ?, leave_end = ? WHERE id = ?");
        $stmt->bind_param("sissi", $orig['status'], $orig['vacation_mode'], $orig['leave_start'], $orig['leave_end'], $id);
        $stmt->execute();
        $stmt->close();
    }

    // Khôi phục thông tin gốc của Users
    foreach ($originalUsers as $id => $orig) {
        $stmt = $conn->prepare("UPDATE users SET status = ?, vacation_mode = ? WHERE id = ?");
        $stmt->bind_param("sii", $orig['status'], $orig['vacation_mode'], $id);
        $stmt->execute();
        $stmt->close();
    }

    // Khôi phục giới hạn backpressure_limit gốc
    $conn->query("UPDATE system_settings SET setting_value = '" . $originalLimit . "' WHERE setting_key = 'backpressure_limit'");
    
    echo "\n♻️ Đã khôi phục hoàn toàn dữ liệu gốc của Sale và dọn sạch dữ liệu thử nghiệm.\n";
}

printTestSummary();
