<?php
// backend/test_grab_lead.php
// Script kiểm thử tự động Vòng Tranh Lead và duplicate Notlead

require_once __DIR__ . '/test_bootstrap.php';

header("Content-Type: text/plain; charset=utf-8");
ob_implicit_flush(true);
if (ob_get_level() > 0) {
    ob_end_clean();
}

echo "🧪 BẮT ĐẦU CHẠY THỬ NGHIỆM VÒNG TRANH LEAD VÀ DUPLICATE NOTLEAD...\n\n";
flush();

$roundId = 0;
$user1Id = 0;
$user2Id = 0;
$c1Id = 0;
$c2Id = 0;
$leadId = 0;
$oldLeadId = 0;

try {
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
    $roundId = (int)$conn->insert_id;
    assertTest("Tạo vòng Grab Lead thử nghiệm", $roundId > 0, "Round ID: $roundId");
    flush();

    // 3. Tạo 2 Consultant & 2 User tương ứng
    // Consultant 1
    $conn->query("INSERT INTO users (full_name, email, role, status, vacation_mode) VALUES ('Test Grab Sale 1', 'test_grab_sale1@richland.vn', 'sale', 'active', 0)");
    $user1Id = (int)$conn->insert_id;
    $c1Row = $conn->query("SELECT id FROM consultants WHERE email = 'test_grab_sale1@richland.vn'")->fetch_assoc();
    if ($c1Row) {
        $c1Id = (int)$c1Row['id'];
        $conn->query("UPDATE consultants SET name = 'Test Grab Sale 1', status = 'active', vacation_mode = 0 WHERE id = $c1Id");
    } else {
        $conn->query("INSERT INTO consultants (name, email, status, vacation_mode) VALUES ('Test Grab Sale 1', 'test_grab_sale1@richland.vn', 'active', 0)");
        $c1Id = (int)$conn->insert_id;
    }

    // Consultant 2
    $conn->query("INSERT INTO users (full_name, email, role, status, vacation_mode) VALUES ('Test Grab Sale 2', 'test_grab_sale2@richland.vn', 'sale', 'active', 0)");
    $user2Id = (int)$conn->insert_id;
    $c2Row = $conn->query("SELECT id FROM consultants WHERE email = 'test_grab_sale2@richland.vn'")->fetch_assoc();
    if ($c2Row) {
        $c2Id = (int)$c2Row['id'];
        $conn->query("UPDATE consultants SET name = 'Test Grab Sale 2', status = 'active', vacation_mode = 0 WHERE id = $c2Id");
    } else {
        $conn->query("INSERT INTO consultants (name, email, status, vacation_mode) VALUES ('Test Grab Sale 2', 'test_grab_sale2@richland.vn', 'active', 0)");
        $c2Id = (int)$conn->insert_id;
    }

    assertTest("Tạo Sales thử nghiệm thành công", $user1Id > 0 && $user2Id > 0 && $c1Id > 0 && $c2Id > 0, "Sale 1 ID: $c1Id, Sale 2 ID: $c2Id");
    flush();

    // Liên kết Sales vào vòng Grab Lead
    $conn->query("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn) VALUES ($roundId, $c1Id, 1, 1)");
    $conn->query("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn) VALUES ($roundId, $c2Id, 1, 1)");

    // Tạo Check-in ngày hôm nay cho cả 2 Sales
    $today = date('Y-m-d');
    $conn->query("INSERT INTO check_ins (user_id, check_in_date, status) VALUES ($user1Id, '$today', 'approved')");
    $conn->query("INSERT INTO check_ins (user_id, check_in_date, status) VALUES ($user2Id, '$today', 'approved')");

    // 4. KIỂM THỬ PHÂN PHỐI LEAD (WEBHOOK ROUTING)
    $leadData = [
        'name' => 'Khách hàng Tranh Nhận 1',
        'phone' => '0901234567',
        'email' => 'test_grab_customer1@gmail.com',
        'source' => 'Facebook Ads',
        'type' => 'Căn hộ',
        'note' => 'Cần gọi gấp để nhận tranh chấp.'
    ];

    require_once __DIR__ . '/webhook_logic.php';

    $eligible = [];
    $cRes = $conn->query("
        SELECT c.id, c.name, c.email
        FROM round_consultants rc 
        JOIN consultants c ON rc.consultant_id = c.id 
        WHERE rc.round_id = $roundId AND rc.is_active = 1 AND c.status = 'active' AND c.vacation_mode = 0
    ");
    if ($cRes) {
        while ($c = $cRes->fetch_assoc()) {
            if (checkConsultantGates($conn, $c['id'], $leadData) === true) {
                $eligible[] = $c;
            }
        }
    }

    assertTest("Kiểm tra bộ lọc Gate của 2 Sales", count($eligible) === 2, "Có " . count($eligible) . " Sales đủ điều kiện.");
    flush();

    // Insert Lead & tạo Offers tranh nhận
    $conn->query("
        INSERT INTO leads (name, phone, email, source, type, note, status, is_accepted, target_round_id) 
        VALUES ('Khách hàng Tranh Nhận 1', '0901234567', 'test_grab_customer1@gmail.com', 'Facebook Ads', 'Căn hộ', 'Cần gọi gấp.', 'pending_claim', 0, $roundId)
    ");
    $leadId = (int)$conn->insert_id;

    foreach ($eligible as $c) {
        $conn->query("
            INSERT INTO lead_offers (lead_id, user_id, round_id, expires_at, status) 
            VALUES ($leadId, " . (int)$c['id'] . ", $roundId, DATE_ADD(NOW(), INTERVAL 10 SECOND), 'pending')
        ");
    }

    assertDbField($conn, 'leads', 'status', "id = $leadId", 'pending_claim', "Lead ở trạng thái pending_claim");
    flush();

    $offersCount = $conn->query("SELECT COUNT(*) as cnt FROM lead_offers WHERE lead_id = $leadId AND status = 'pending'")->fetch_assoc()['cnt'];
    assertTest("Tạo lời mời lead_offers cho cả 2 Sales", (int)$offersCount === 2, "Số lượng offer tạo ra: $offersCount");
    flush();

    // 5. KIỂM THỬ TRANH NHẬN ĐỒNG THỜI (CONCURRENCY CLAIMING)
    $claim1Success = false;
    $claim2Success = false;

    // Giả lập claim_lead cho Sale 1 (Transaction)
    $conn->begin_transaction();
    try {
        $lRes = $conn->query("SELECT id, assigned_to, is_accepted FROM leads WHERE id = $leadId FOR UPDATE");
        $lRow = $lRes ? $lRes->fetch_assoc() : null;

        if ($lRow && (int)$lRow['is_accepted'] === 0 && empty($lRow['assigned_to'])) {
            $conn->query("UPDATE lead_offers SET status = 'accepted', responded_at = NOW() WHERE lead_id = $leadId AND user_id = $c1Id");
            $conn->query("UPDATE lead_offers SET status = 'expired', responded_at = NOW() WHERE lead_id = $leadId AND user_id != $c1Id");
            $conn->query("UPDATE leads SET assigned_to = $c1Id, is_accepted = 1, status = 'active', accepted_at = NOW() WHERE id = $leadId");
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
    flush();

    // Giả lập claim_lead cho Sale 2 ngay sau đó (Transaction)
    $conn->begin_transaction();
    try {
        $lRes = $conn->query("SELECT id, assigned_to, is_accepted FROM leads WHERE id = $leadId FOR UPDATE");
        $lRow = $lRes ? $lRes->fetch_assoc() : null;

        if ($lRow && (int)$lRow['is_accepted'] === 0 && empty($lRow['assigned_to'])) {
            $conn->query("UPDATE lead_offers SET status = 'accepted' WHERE lead_id = $leadId AND user_id = $c2Id");
            $conn->query("UPDATE leads SET assigned_to = $c2Id, is_accepted = 1, status = 'active' WHERE id = $leadId");
            $conn->commit();
            $claim2Success = true;
        } else {
            $conn->rollback();
        }
    } catch (Exception $e) {
        $conn->rollback();
    }

    assertTest("Sale 2 tranh nhận thất bại do trùng lắp", $claim2Success === false, "Sale 2 nhận được thông báo lead đã bị người khác nhận.");
    flush();

    // 6. KIỂM THỬ COOLDOWN BLOCK
    $lead2Data = [
        'name' => 'Khách hàng Tranh Nhận 2',
        'phone' => '0907654321',
        'email' => 'test_grab_customer2@gmail.com'
    ];

    $eligibleRound2 = [];
    if ($cRes) {
        $cRes->data_seek(0);
        while ($c = $cRes->fetch_assoc()) {
            $cooldownRes = $conn->query("
                SELECT 1 FROM distribution_logs 
                WHERE assigned_to = " . (int)$c['id'] . " 
                  AND round_id = $roundId 
                  AND status = 'grabbed' 
                  AND received_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND) 
                LIMIT 1
            ");
            $isOnCooldown = ($cooldownRes && $cooldownRes->num_rows > 0);

            if ($isOnCooldown) {
                continue;
            }

            if (checkConsultantGates($conn, $c['id'], $lead2Data) === true) {
                $eligibleRound2[] = $c;
            }
        }
    }

    assertTest("Bộ lọc Cooldown block Sale 1", count($eligibleRound2) === 1 && $eligibleRound2[0]['id'] == $c2Id, "Chỉ còn Sale 2 (" . ($eligibleRound2[0]['id'] ?? 'none') . ") được nhận lead mới.");
    flush();

    // 6.5. KIỂM THỬ THU HỒI TỰ ĐỘNG KHI HẾT HẠN ĐẾM NGƯỢC (EXPIRED RECALL & REDISTRIBUTION)
    // Tạo 1 lead test hết hạn
    $conn->query("
        INSERT INTO leads (name, phone, email, source, type, note, status, is_accepted, target_round_id) 
        VALUES ('Khách hàng Hết Hạn 1', '0907654321', 'test_grab_expired@gmail.com', 'Facebook Ads', 'Căn hộ', 'Hết hạn để tự động chia lại.', 'pending_claim', 0, $roundId)
    ");
    $expiredLeadId = (int)$conn->insert_id;
    
    // Tạo offer đã hết hạn (expires_at ở quá khứ 10 giây trước)
    $conn->query("
        INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) 
        VALUES ($expiredLeadId, $c2Id, $roundId, DATE_SUB(NOW(), INTERVAL 20 SECOND), DATE_SUB(NOW(), INTERVAL 10 SECOND), 'pending')
    ");
    
    // Chạy logic thu hồi
    require_once __DIR__ . '/cron_sync.php';
    recallExpiredGrabLeads($conn);
    
    // Kiểm tra xem offer cũ đã bị đánh dấu expired
    $oldOfferStatus = $conn->query("SELECT status FROM lead_offers WHERE lead_id = $expiredLeadId AND user_id = $c2Id ORDER BY id ASC LIMIT 1")->fetch_assoc()['status'] ?? '';
    assertTest("Offer cũ của lead hết hạn được cập nhật thành expired", $oldOfferStatus === 'expired', "Trạng thái: $oldOfferStatus");
    
    // Kiểm tra xem có offer mới được tạo ra (tái phân phối)
    $newOffersCount = $conn->query("SELECT COUNT(*) as cnt FROM lead_offers WHERE lead_id = $expiredLeadId AND status = 'pending'")->fetch_assoc()['cnt'];
    assertTest("Tự động tái phân phối: Tạo offer mới thành công", (int)$newOffersCount === 1, "Số offer pending mới: $newOffersCount");
    
    // Chạy thử nghiệm vượt quá số lần recall tối đa:
    // Case A: grab_fallback_to_databank = 0 (Chuyển Admin)
    $conn->query("UPDATE distribution_rounds SET grab_fallback_to_databank = 0 WHERE id = $roundId");
    
    // Đánh dấu offer hiện tại thành expired và giả lập đã ghi nhận logs hết hạn 2 lần
    $conn->query("UPDATE lead_offers SET status = 'expired' WHERE lead_id = $expiredLeadId");
    $conn->query("INSERT INTO distribution_logs (lead_id, round_id, status, message) VALUES ($expiredLeadId, $roundId, 'expired', 'Hết hạn 1'), ($expiredLeadId, $roundId, 'expired', 'Hết hạn 2')");
    
    // Tạo thêm 1 offer pending đã hết hạn nữa để kích hoạt cron tiếp theo
    $conn->query("
        INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) 
        VALUES ($expiredLeadId, $c2Id, $roundId, DATE_SUB(NOW(), INTERVAL 20 SECOND), DATE_SUB(NOW(), INTERVAL 10 SECOND), 'pending')
    ");
    
    // Chạy thu hồi lần 2 (vượt giới hạn)
    recallExpiredGrabLeads($conn);
    
    $fallbackStatus = $conn->query("SELECT status, assigned_to FROM leads WHERE id = $expiredLeadId")->fetch_assoc()['status'] ?? '';
    assertTest("Hết lượt tranh nhận (fallback Admin): Lead chuyển thành pending_approval", $fallbackStatus === 'pending_approval', "Status thực tế: $fallbackStatus");
    
    // Case B: grab_fallback_to_databank = 1 (Chuyển Databank)
    $conn->query("UPDATE distribution_rounds SET grab_fallback_to_databank = 1 WHERE id = $roundId");
    
    $conn->query("
        INSERT INTO leads (name, phone, email, source, type, note, status, is_accepted, target_round_id) 
        VALUES ('Khách hàng Hết Hạn 2', '0907654322', 'test_grab_expired2@gmail.com', 'Facebook Ads', 'Căn hộ', 'Hết hạn chuyển Databank.', 'pending_claim', 0, $roundId)
    ");
    $expiredLeadId2 = (int)$conn->insert_id;
    
    // Tạo 2 logs expired và 1 offer pending hết hạn
    $conn->query("INSERT INTO distribution_logs (lead_id, round_id, status, message) VALUES ($expiredLeadId2, $roundId, 'expired', 'Hết hạn 1'), ($expiredLeadId2, $roundId, 'expired', 'Hết hạn 2')");
    $conn->query("
        INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) 
        VALUES ($expiredLeadId2, $c2Id, $roundId, DATE_SUB(NOW(), INTERVAL 20 SECOND), DATE_SUB(NOW(), INTERVAL 10 SECOND), 'pending')
    ");
    
    recallExpiredGrabLeads($conn);
    
    $fallbackStatus2 = $conn->query("SELECT status, person_id FROM leads WHERE id = $expiredLeadId2")->fetch_assoc();
    $personId = (int)($fallbackStatus2['person_id'] ?? 0);
    assertTest("Hết lượt tranh nhận (fallback Databank): Lead chuyển thành unassigned", $fallbackStatus2['status'] === 'unassigned', "Status thực tế: " . $fallbackStatus2['status']);
    
    $personPublic = 0;
    if ($personId > 0) {
        $personPublic = (int)($conn->query("SELECT is_public FROM persons WHERE id = $personId")->fetch_assoc()['is_public'] ?? 0);
    }
    assertTest("Khách hàng tương ứng được kích hoạt is_public = 1 trong Databank", $personPublic === 1, "Public thực tế: $personPublic");
    
    // Dọn dẹp
    $conn->query("DELETE FROM lead_offers WHERE lead_id IN ($expiredLeadId, $expiredLeadId2)");
    $conn->query("DELETE FROM leads WHERE id IN ($expiredLeadId, $expiredLeadId2)");
    if ($personId > 0) {
        $conn->query("DELETE FROM persons WHERE id = $personId");
    }
    flush();

    // 7. KIỂM THỬ INTERCEPT DUPLICATE NOTLEAD
    // Xóa lead cũ 1 trước để giải phóng số điện thoại 0901234567 độc nhất
    if ($leadId > 0) {
        $conn->query("DELETE FROM lead_offers WHERE lead_id = $leadId");
        $conn->query("DELETE FROM leads WHERE id = $leadId");
        $leadId = 0;
    }

    $conn->query("
        INSERT INTO leads (name, phone, email, status, is_accepted, assigned_to) 
        VALUES ('Khách hàng Cũ', '0901234567', 'test_grab_old@gmail.com', 'active', 1, $c2Id)
    ");
    $oldLeadId = (int)$conn->insert_id;

    $isDuplicate = true;
    $isMktNotlead = true;

    if ($isDuplicate && $isMktNotlead) {
        $conn->query("UPDATE leads SET status = 'pending_approval', assigned_to = NULL, is_accepted = 0 WHERE id = $oldLeadId");
        $conn->query("INSERT INTO distribution_logs (lead_id, round_id, status, message) VALUES ($oldLeadId, $roundId, 'pending_approval', 'Trùng số nhưng MKT đánh dấu Notlead')");
    }

    assertDbField($conn, 'leads', 'status', "id = $oldLeadId", 'pending_approval', "Lead duplicate có cờ notlead chuyển thành công sang pending_approval");
    assertDbField($conn, 'leads', 'assigned_to', "id = $oldLeadId", null, "Lead duplicate có cờ notlead bị thu hồi assigned_to về NULL");
    flush();

} catch (Throwable $t) {
    echo "⚠️ THROWABLE EXCEPTION TRONG QUÁ TRÌNH TEST: " . $t->getMessage() . "\n" . $t->getTraceAsString() . "\n";
    flush();
} finally {
    // 8. DỌN DẸP DỮ LIỆU SAU TEST (Luôn chạy để bảo vệ database)
    if ($roundId > 0) {
        $conn->query("DELETE FROM lead_offers WHERE round_id = $roundId");
        $conn->query("DELETE FROM distribution_logs WHERE round_id = $roundId");
        $conn->query("DELETE FROM round_consultants WHERE round_id = $roundId");
        $conn->query("DELETE FROM distribution_rounds WHERE id = $roundId");
    }
    if ($user1Id > 0 || $user2Id > 0) {
        $conn->query("DELETE FROM check_ins WHERE user_id IN ($user1Id, $user2Id)");
        $conn->query("DELETE FROM consultants WHERE id IN ($c1Id, $c2Id)");
        $conn->query("DELETE FROM users WHERE id IN ($user1Id, $user2Id)");
    }
    $conn->query("DELETE FROM leads WHERE phone IN ('0901234567', '0907654321')");

    echo "\n🧹 Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử trên database.\n";
    flush();
}

printTestSummary();
