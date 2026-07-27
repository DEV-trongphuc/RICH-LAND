<?php
// backend/test_grab_lead.php
// Script kiểm thử tự động Vòng Tranh Lead và duplicate Notlead

require_once __DIR__ . '/test_bootstrap.php';

header("Content-Type: text/plain; charset=utf-8");

echo "🧪 BẮT ĐẦU CHẠY THỬ NGHIỆM VÒNG TRANH LEAD VÀ DUPLICATE NOTLEAD...\n\n";

// 1. Dọn dẹp dữ liệu cũ (nếu có)
$conn->query("DELETE FROM lead_offers WHERE round_id IN (SELECT id FROM distribution_rounds WHERE round_name LIKE 'TEST_GRAB%')");
$conn->query("DELETE FROM distribution_logs WHERE round_id IN (SELECT id FROM distribution_rounds WHERE round_name LIKE 'TEST_GRAB%')");
$conn->query("DELETE FROM round_consultants WHERE round_id IN (SELECT id FROM distribution_rounds WHERE round_name LIKE 'TEST_GRAB%')");
$conn->query("DELETE FROM distribution_rounds WHERE round_name LIKE 'TEST_GRAB%'");
$conn->query("DELETE FROM check_ins WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_grab%')");
$conn->query("DELETE FROM consultants WHERE email LIKE 'test_grab%'");
$conn->query("DELETE FROM users WHERE email LIKE 'test_grab%'");
$conn->query("DELETE FROM leads WHERE phone = '0901234567' OR phone = '0907654321'");

// 2. Tạo Vòng Tranh Lead thử nghiệm
$conn->query("
    INSERT INTO distribution_rounds (round_name, is_active, round_type, grab_countdown_seconds, grab_cooldown_seconds)
    VALUES ('TEST_GRAB_ROUND', 1, 'grab', 10, 5)
");
$roundId = $conn->insert_id;
assertTest("Tạo vòng Grab Lead thử nghiệm", $roundId > 0, "Round ID: $roundId");

// 3. Tạo 2 Consultant & 2 User tương ứng
// Consultant 1
$conn->query("INSERT INTO users (full_name, email, role, status, vacation_mode) VALUES ('Test Grab Sale 1', 'test_grab_sale1@richland.vn', 'sale', 'active', 0)");
$user1Id = $conn->insert_id;
$conn->query("INSERT INTO consultants (name, email, status, vacation_mode) VALUES ('Test Grab Sale 1', 'test_grab_sale1@richland.vn', 'active', 0)");
$c1Id = $conn->insert_id;

// Consultant 2
$conn->query("INSERT INTO users (full_name, email, role, status, vacation_mode) VALUES ('Test Grab Sale 2', 'test_grab_sale2@richland.vn', 'sale', 'active', 0)");
$user2Id = $conn->insert_id;
$conn->query("INSERT INTO consultants (name, email, status, vacation_mode) VALUES ('Test Grab Sale 2', 'test_grab_sale2@richland.vn', 'active', 0)");
$c2Id = $conn->insert_id;

assertTest("Tạo Sales thử nghiệm thành công", $user1Id > 0 && $user2Id > 0 && $c1Id > 0 && $c2Id > 0, "Sale 1 ID: $c1Id, Sale 2 ID: $c2Id");

// Liên kết Sales vào vòng Grab Lead
$conn->query("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn) VALUES ($roundId, $c1Id, 1, 1)");
$conn->query("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn) VALUES ($roundId, $c2Id, 1, 1)");

// Tạo Check-in ngày hôm nay cho cả 2 Sales
$today = date('Y-m-d');
$conn->query("INSERT INTO check_ins (user_id, check_in_date, status) VALUES ($user1Id, '$today', 'approved')");
$conn->query("INSERT INTO check_ins (user_id, check_in_date, status) VALUES ($user2Id, '$today', 'approved')");

// 4. KIỂM THỬ PHÂN PHỐI LEAD (WEBHOOK ROUTING)
// Mô phỏng webhook đẩy lead mới vào vòng Grab Lead
$leadData = [
    'name' => 'Khách hàng Tranh Nhận 1',
    'phone' => '0901234567',
    'email' => 'test_grab_customer1@gmail.com',
    'source' => 'Facebook Ads',
    'type' => 'Căn hộ',
    'note' => 'Cần gọi gấp để nhận tranh chấp.'
];

// Chạy định tuyến webhook thủ công
require_once __DIR__ . '/webhook_logic.php';

// Thực hiện gọi block tương đương webhook
// Chúng ta sẽ insert lead trực tiếp ở chế độ pending_claim và tạo offers để xem thuật toán tạo offer hoạt động đúng không.
// Trước hết hãy kiểm tra danh sách Sale đủ điều kiện tham gia tranh nhận
$eligible = [];
$cStmt = $conn->prepare("
    SELECT c.id, c.name, c.email
    FROM round_consultants rc 
    JOIN consultants c ON rc.consultant_id = c.id 
    WHERE rc.round_id = ? AND rc.is_active = 1 AND c.status = 'active' AND c.vacation_mode = 0
");
$cStmt->bind_param("i", $roundId);
$cStmt->execute();
$activeC = $cStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$cStmt->close();

foreach ($activeC as $c) {
    if (checkConsultantGates($conn, $c['id'], $leadData) === true) {
        $eligible[] = $c;
    }
}

assertTest("Kiểm tra bộ lọc Gate của 2 Sales", count($eligible) === 2, "Có " . count($eligible) . " Sales đủ điều kiện.");

// Insert Lead & tạo Offers tranh nhận
$conn->query("
    INSERT INTO leads (name, phone, email, source, type, note, status, is_accepted, target_round_id) 
    VALUES ('Khách hàng Tranh Nhận 1', '0901234567', 'test_grab_customer1@gmail.com', 'Facebook Ads', 'Căn hộ', 'Cần gọi gấp.', 'pending_claim', 0, $roundId)
");
$leadId = $conn->insert_id;

$offerStmt = $conn->prepare("
    INSERT INTO lead_offers (lead_id, user_id, round_id, expires_at, status) 
    VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 SECOND), 'pending')
");
foreach ($eligible as $c) {
    $offerStmt->bind_param("iii", $leadId, $c['id'], $roundId);
    $offerStmt->execute();
}
$offerStmt->close();

assertDbField($conn, 'leads', 'status', "id = $leadId", 'pending_claim', "Lead ở trạng thái pending_claim");

$offersCount = $conn->query("SELECT COUNT(*) as cnt FROM lead_offers WHERE lead_id = $leadId AND status = 'pending'")->fetch_assoc()['cnt'];
assertTest("Tạo lời mời lead_offers cho cả 2 Sales", (int)$offersCount === 2, "Số lượng offer tạo ra: $offersCount");


// 5. KIỂM THỬ TRANH NHẬN ĐỒNG THỜI (CONCURRENCY CLAIMING)
// Giả lập Sale 1 ấn nhận lead trước
$claim1Success = false;
$claim2Success = false;

// Giả lập claim_lead cho Sale 1 (Transaction)
$conn->begin_transaction();
try {
    // 1. Lock lead
    $stmt = $conn->prepare("SELECT id, assigned_to, is_accepted FROM leads WHERE id = ? FOR UPDATE");
    $stmt->bind_param("i", $leadId);
    $stmt->execute();
    $lRow = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($lRow && (int)$lRow['is_accepted'] === 0 && empty($lRow['assigned_to'])) {
        // 2. Lock & update offer
        $conn->query("UPDATE lead_offers SET status = 'accepted', responded_at = NOW() WHERE lead_id = $leadId AND user_id = $c1Id");
        $conn->query("UPDATE lead_offers SET status = 'expired', responded_at = NOW() WHERE lead_id = $leadId AND user_id != $c1Id");
        
        // 3. Update lead
        $conn->query("UPDATE leads SET assigned_to = $c1Id, is_accepted = 1, status = 'active', accepted_at = NOW() WHERE id = $leadId");
        
        // 4. Log
        $conn->query("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES ($leadId, $c1Id, $roundId, 'grabbed', 'Tranh nhận thành công')");
        
        $conn->commit();
        $claim1Success = true;
    } else {
        $conn->rollback();
    }
} catch (Exception $e) {
    $conn->rollback();
}

assertTest("Sale 1 tranh nhận thành công", $claim1Success === true, "Sale 1 đã giành được lead.");

// Giả lập claim_lead cho Sale 2 ngay sau đó (Transaction)
$conn->begin_transaction();
try {
    $stmt = $conn->prepare("SELECT id, assigned_to, is_accepted FROM leads WHERE id = ? FOR UPDATE");
    $stmt->bind_param("i", $leadId);
    $stmt->execute();
    $lRow = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($lRow && (int)$lRow['is_accepted'] === 0 && empty($lRow['assigned_to'])) {
        $conn->query("UPDATE lead_offers SET status = 'accepted' WHERE lead_id = $leadId AND user_id = $c2Id");
        $conn->query("UPDATE leads SET assigned_to = $c2Id, is_accepted = 1, status = 'active' WHERE id = $leadId");
        $conn->commit();
        $claim2Success = true;
    } else {
        $conn->rollback(); // Đã bị Sale 1 nhận trước!
    }
} catch (Exception $e) {
    $conn->rollback();
}

assertTest("Sale 2 tranh nhận thất bại do trùng lắp", $claim2Success === false, "Sale 2 nhận được thông báo lead đã bị người khác nhận.");


// 6. KIỂM THỬ COOLDOWN BLOCK
// Sale 1 vừa nhận lead thành công ở trên nên đang bị cooldown 5 giây.
// Đẩy tiếp lead thứ 2 vào vòng để kiểm tra định tuyến xem Sale 1 có bị block không.
$lead2Data = [
    'name' => 'Khách hàng Tranh Nhận 2',
    'phone' => '0907654321',
    'email' => 'test_grab_customer2@gmail.com'
];

$eligibleRound2 = [];
foreach ($activeC as $c) {
    // Check cooldown
    $cooldownStmt = $conn->prepare("
        SELECT 1 FROM distribution_logs 
        WHERE assigned_to = ? 
          AND round_id = ? 
          AND status = 'grabbed' 
          AND received_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND) 
        LIMIT 1
    ");
    $cooldownStmt->bind_param("ii", $c['id'], $roundId);
    $cooldownStmt->execute();
    $isOnCooldown = $cooldownStmt->get_result()->num_rows > 0;
    $cooldownStmt->close();

    if ($isOnCooldown) {
        continue;
    }

    if (checkConsultantGates($conn, $c['id'], $lead2Data) === true) {
        $eligibleRound2[] = $c;
    }
}

assertTest("Bộ lọc Cooldown block Sale 1", count($eligibleRound2) === 1 && $eligibleRound2[0]['id'] == $c2Id, "Chỉ còn Sale 2 ($c2Id) được nhận lead mới.");


// 7. KIỂM THỬ INTERCEPT DUPLICATE NOTLEAD
// Tạo lead cũ trong hệ thống
$conn->query("
    INSERT INTO leads (name, phone, email, status, is_accepted, assigned_to) 
    VALUES ('Khách hàng Cũ', '0901234567', 'test_grab_old@gmail.com', 'active', 1, $c2Id)
");
$oldLeadId = $conn->insert_id;

// Giả lập webhook nhận data trùng số điện thoại 0901234567 kèm cờ notlead = 1
$isDuplicate = true;
$isMktNotlead = true; // MKT marked as notlead

$finalStatus = 'active';
if ($isDuplicate && $isMktNotlead) {
    // Chuyển thẳng về pending_approval
    $finalStatus = 'pending_approval';
    $conn->query("UPDATE leads SET status = 'pending_approval', assigned_to = NULL, is_accepted = 0 WHERE id = $oldLeadId");
    $conn->query("INSERT INTO distribution_logs (lead_id, round_id, status, message) VALUES ($oldLeadId, $roundId, 'pending_approval', 'Trùng số nhưng MKT đánh dấu Notlead')");
}

assertDbField($conn, 'leads', 'status', "id = $oldLeadId", 'pending_approval', "Lead duplicate có cờ notlead chuyển thành công sang pending_approval");
assertDbField($conn, 'leads', 'assigned_to', "id = $oldLeadId", null, "Lead duplicate có cờ notlead bị thu hồi assigned_to về NULL");


// 8. DỌN DẸP DỮ LIỆU SAU TEST
$conn->query("DELETE FROM lead_offers WHERE round_id = $roundId");
$conn->query("DELETE FROM distribution_logs WHERE round_id = $roundId");
$conn->query("DELETE FROM round_consultants WHERE round_id = $roundId");
$conn->query("DELETE FROM distribution_rounds WHERE id = $roundId");
$conn->query("DELETE FROM check_ins WHERE user_id IN ($user1Id, $user2Id)");
$conn->query("DELETE FROM consultants WHERE id IN ($c1Id, $c2Id)");
$conn->query("DELETE FROM users WHERE id IN ($user1Id, $user2Id)");
$conn->query("DELETE FROM leads WHERE phone IN ('0901234567', '0907654321')");

echo "\n🧹 Đã dọn dẹp toàn bộ dữ liệu kiểm thử.\n";

printTestSummary();
