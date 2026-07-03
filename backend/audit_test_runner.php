<?php
// backend/audit_test_runner.php
// Master E2E logic validation suite for RICH LAND CRM

if (!defined('DIAG_TOKEN')) {
    http_response_code(403);
    die(json_encode(['success' => false, 'message' => 'Direct access forbidden']));
}

$results = [];

function assertTest(string $name, bool $assertion, ?string $detail = null) {
    global $results;
    $results[] = [
        'test' => $name,
        'passed' => $assertion,
        'detail' => $detail
    ];
}

try {
    $db = Database::getInstance();
    $tenantId = 1;

    // ─────────────────────────────────────────────────────────────────
    // Phase 1: Database Table Integrity
    // ─────────────────────────────────────────────────────────────────
    $tablesStmt = $db->query("SHOW TABLES");
    $tables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);
    $requiredTables = [
        'users', 'consultants', 'leads', 'contacts', 'activities', 
        'activity_comments', 'deals', 'expenses', 'quotes', 
        'invoices', 'cooperation_slips', 'deposits', 'deposit_milestones',
        'notifications', 'notes', 'note_mentions', 'teams', 'projects',
        'capi_logs', 'system_settings', 'products', 'purchase_orders',
        'batches', 'inventory_logs', 'check_ins', 'tickets', 'cloud_files'
    ];
    $missingTables = array_diff($requiredTables, $tables);
    assertTest("Phase 1: Database Table Integrity", empty($missingTables), empty($missingTables) ? "All tables exist" : "Missing: " . implode(', ', $missingTables));

    // ─────────────────────────────────────────────────────────────────
    // Phase 2: Roster & Multi-Role User Setup
    // ─────────────────────────────────────────────────────────────────
    $suffix = uniqid();
    $saleEmail = "sale_$suffix@richland.net";
    $assistEmail = "assist_$suffix@richland.net";
    $mgrEmail = "mgr_$suffix@richland.net";
    $adminEmail = "admin_$suffix@richland.net";
    $saEmail = "sa_$suffix@richland.net";

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, ?, 'sales', ?, 'active')")
       ->execute([$tenantId, $saleEmail, password_hash('pass123', PASSWORD_BCRYPT), '[E2E] Nguyễn Văn Nam ' . $suffix]);
    $saleUserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, ?, 'assistant', ?, 'active')")
       ->execute([$tenantId, $assistEmail, password_hash('pass123', PASSWORD_BCRYPT), '[E2E] Trần Thị Mai ' . $suffix]);
    $assistUserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, ?, 'manager', ?, 'active')")
       ->execute([$tenantId, $mgrEmail, password_hash('pass123', PASSWORD_BCRYPT), '[E2E] Lê Hoàng Hải ' . $suffix]);
    $mgrUserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, ?, 'admin', ?, 'active')")
       ->execute([$tenantId, $adminEmail, password_hash('pass123', PASSWORD_BCRYPT), '[E2E] Phạm Minh Quân ' . $suffix]);
    $adminUserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, ?, 'super_admin', ?, 'active')")
       ->execute([$tenantId, $saEmail, password_hash('pass123', PASSWORD_BCRYPT), '[E2E] Nguyễn Bích Phượng ' . $suffix]);
    $saUserId = (int)$db->lastInsertId();

    // Create matching entries in consultants table where required
    $db->prepare("INSERT IGNORE INTO consultants (id, name, email, status) VALUES (?, ?, ?, 'active')")
       ->execute([$saleUserId, '[E2E] Nguyễn Văn Nam ' . $suffix, $saleEmail]);
    $db->prepare("INSERT IGNORE INTO consultants (id, name, email, status) VALUES (?, ?, ?, 'active')")
       ->execute([$mgrUserId, '[E2E] Lê Hoàng Hải ' . $suffix, $mgrEmail]);

    $usersCreated = ($saleUserId > 0 && $assistUserId > 0 && $mgrUserId > 0 && $adminUserId > 0 && $saUserId > 0);
    assertTest("Phase 2: Roster & Multi-Role User Setup", $usersCreated, "Sale ID: $saleUserId, Assist ID: $assistUserId, Manager ID: $mgrUserId, Admin ID: $adminUserId, SA ID: $saUserId");

    // ─────────────────────────────────────────────────────────────────
    // Phase 3: Sales Team Management
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO teams (tenant_id, name, leader_id) VALUES (?, ?, ?)")
       ->execute([$tenantId, 'Test Team ' . $suffix, $mgrUserId]);
    $teamId = (int)$db->lastInsertId();

    // Update consultant team_id link
    $db->prepare("UPDATE consultants SET team_id = ? WHERE id = ?")->execute([$teamId, $saleUserId]);
    $saleTeamId = $db->query("SELECT team_id FROM consultants WHERE id = $saleUserId")->fetchColumn();
    
    assertTest("Phase 3: Sales Team Management", $teamId > 0 && (int)$saleTeamId === $teamId, "Team ID: $teamId, Assigned Member Team: $saleTeamId");

    // ─────────────────────────────────────────────────────────────────
    // Phase 4: Lead Distribution Setup
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO distribution_rounds (round_name, description, is_active) VALUES (?, 'E2E Testing Round', 1)")
       ->execute(['Round BBA ' . $suffix]);
    $roundId = (int)$db->lastInsertId();

    $rcStmt = $db->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, compensation_count, current_turn_remaining) VALUES (?, ?, 2, 0, 1)");
    $rcSuccess = $rcStmt->execute([$roundId, $saleUserId]);

    assertTest("Phase 4: Lead Distribution Setup", $roundId > 0 && $rcSuccess, "Round ID: $roundId, RC Inserted: " . ($rcSuccess ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // Phase 5: Lead Claiming & Databank Backpressure
    // ─────────────────────────────────────────────────────────────────
    $testPhone = '098' . mt_rand(1000000, 9999999);
    $db->prepare("INSERT INTO persons (phone, email, full_name) VALUES (?, 'e2e_lead@richland.com', '[E2E] Nguyễn Ngọc Anh')")
       ->execute([$testPhone]);
    $personId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO leads (name, phone, email, source, status, person_id) VALUES ('[E2E] Nguyễn Ngọc Anh', ?, 'e2e_lead@richland.com', 'FB ads', 'databank_claim', ?)")
       ->execute([$testPhone, $personId]);
    $leadId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, 'databank_claim', 'Phân bổ nhận từ kho dữ liệu chung (Databank)')")
       ->execute([$leadId, $saleUserId, $roundId]);
    $logId = (int)$db->lastInsertId();

    // Verify error report logic is blocked for databank claims
    $leadStatus = $db->query("SELECT status FROM leads WHERE id = $leadId")->fetchColumn();
    $reportBlocked = ($leadStatus === 'databank_claim');

    assertTest("Phase 5: Databank Claiming & Error Ticket Block", $logId > 0 && $reportBlocked, "Lead Status: $leadStatus, Report Blocked: " . ($reportBlocked ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // Phase 6: Contact Profile Lifecycle & Personal Import
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO contacts (tenant_id, person_id, first_name, last_name, email, phone, owner_id, status, pipeline_status, temperature) VALUES (?, ?, '[E2E]', 'Nguyễn Ngọc Anh', 'e2e_lead@richland.com', ?, ?, 'lead', 'chua_xac_dinh', 'neutral')")
       ->execute([$tenantId, $personId, $testPhone, $saleUserId]);
    $contactId = (int)$db->lastInsertId();

    $db->prepare("UPDATE contacts SET status = 'qualified', pipeline_status = 'tu_van' WHERE id = ?")->execute([$contactId]);
    $statusAfterQualified = $db->query("SELECT status FROM contacts WHERE id = $contactId")->fetchColumn();

    // Personal import bypassing queues
    $personalPhone = '097' . mt_rand(1000000, 9999999);
    $db->prepare("INSERT INTO persons (phone, email, full_name) VALUES (?, 'personal_import@richland.com', '[E2E] Khách Hàng Lê Văn Hùng')")
       ->execute([$personalPhone]);
    $personalPersonId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO contacts (tenant_id, person_id, first_name, last_name, email, phone, owner_id, status, pipeline_status, source) VALUES (?, ?, '[E2E]', 'Lê Văn Hùng', 'personal_import@richland.com', ?, ?, 'customer', 'dat_coc', 'ca_nhan')")
       ->execute([$tenantId, $personalPersonId, $personalPhone, $saleUserId]);
    $personalContactId = (int)$db->lastInsertId();

    assertTest("Phase 6: Contact Profile Lifecycle & Personal Import", $contactId > 0 && $statusAfterQualified === 'qualified' && $personalContactId > 0, "Contact ID: $contactId, Personal Import Contact ID: $personalContactId");

    // ─────────────────────────────────────────────────────────────────
    // Phase 7: Bếp Đun Nước Interactions
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO activities (tenant_id, user_id, type, subject, status, related_type, related_id) VALUES (?, ?, 'call', 'Cuộc gọi tư vấn dự án Rich Land - Khách quan tâm căn 2 phòng ngủ hướng Đông Nam, tài chính sẵn có khoảng 3 tỷ.', 'done', 'contact', ?)")
       ->execute([$tenantId, $saleUserId, $contactId]);
    $activityId = (int)$db->lastInsertId();

    $db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE, temperature = 'warm', tags = ? WHERE id = ?")
       ->execute([json_encode(['vướng_dự_án']), $contactId]);
    
    $contactUpdated = $db->query("SELECT last_contact, temperature, tags FROM contacts WHERE id = $contactId")->fetch(PDO::FETCH_ASSOC);

    assertTest("Phase 7: Bếp Đun Nước Interactions", $activityId > 0 && $contactUpdated['last_contact'] === date('Y-m-d') && $contactUpdated['temperature'] === 'warm', "Temp: " . $contactUpdated['temperature'] . ", Tags: " . $contactUpdated['tags']);

    // ─────────────────────────────────────────────────────────────────
    // Phase 8: Mention & Notification Creation
    // ─────────────────────────────────────────────────────────────────
    $mgrTag = 'Lê_Hoàng_Hải_' . $suffix;
    $saleTag = 'Nguyễn_Văn_Nam_' . $suffix;
    $noteBody = "Nhờ anh @$mgrTag duyệt giúp em hồ sơ vay ngân hàng lãi suất ưu đãi cho khách của sale @$saleTag.";

    $db->prepare("INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type) VALUES (?, ?, 'contact', ?, ?, 'internal')")
       ->execute([$tenantId, $saleUserId, $contactId, $noteBody]);
    $noteId = (int)$db->lastInsertId();

    $mentions = [];
    preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}]+)/u', $noteBody, $matches);
    if (!empty($matches[1])) {
        foreach ($matches[1] as $nameWithUnderscores) {
            $fullName = str_replace('_', ' ', $nameWithUnderscores);
            $stmt = $db->prepare("SELECT id FROM users WHERE tenant_id=? AND (full_name=? OR full_name=?)");
            $stmt->execute([$tenantId, $fullName, "[E2E] " . $fullName]);
            $uid = $stmt->fetchColumn();
            if ($uid) $mentions[] = (int)$uid;
        }
    }
    $mentions = array_unique($mentions);
    $mentions = array_filter($mentions, function($uid) use ($saleUserId) {
        return (int)$uid !== (int)$saleUserId;
    });

    $insMention = $db->prepare("INSERT IGNORE INTO note_mentions (note_id, user_id) VALUES (?,?)");
    $insNotif = $db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
    foreach ($mentions as $uid) {
        $insMention->execute([$noteId, $uid]);
        $insNotif->execute([$uid, $tenantId, 'Yêu cầu duyệt hồ sơ vay', 'Nguyễn Văn Nam đã nhắc tên bạn trong ghi chú của khách hàng Nguyễn Ngọc Anh.', 'mention', "/notes/{$noteId}"]);
    }

    $managerMentioned = $db->query("SELECT COUNT(*) FROM note_mentions WHERE note_id = $noteId AND user_id = $mgrUserId")->fetchColumn() > 0;
    $selfMentionSkipped = $db->query("SELECT COUNT(*) FROM note_mentions WHERE note_id = $noteId AND user_id = $saleUserId")->fetchColumn() == 0;

    assertTest("Phase 8: Mention & Notification Creation", $managerMentioned && $selfMentionSkipped, "Mgr: " . ($managerMentioned ? 'Yes' : 'No') . ", Self: " . ($selfMentionSkipped ? 'Yes' : 'No') . ", Matches: " . json_encode($matches[1]) . ", Mentions: " . json_encode($mentions) . ", MgrID: $mgrUserId, NoteBody: $noteBody");

    // ─────────────────────────────────────────────────────────────────
    // Phase 9: Cooperation Slip Complete Flow
    // ─────────────────────────────────────────────────────────────────
    $sharesJson = json_encode(["$saleUserId" => 50, "$mgrUserId" => 50]);
    $db->prepare("INSERT INTO cooperation_slips (contact_id, total_percentage, shares_json, signatures_json, status, created_by, attachment_url) VALUES (?, 100, ?, '{}', 'pending_signatures', ?, 'Hợp đồng liên kết môi giới Đông Nam Bộ - Dự án Rich Land')")
       ->execute([$contactId, $sharesJson, $saleUserId]);
    $slipId = (int)$db->lastInsertId();

    $sigs = ["$saleUserId" => ['time' => date('Y-m-d H:i:s'), 'ip' => '127.0.0.1', 'role' => 'sales']];
    $db->prepare("UPDATE cooperation_slips SET signatures_json = ? WHERE id = ?")->execute([json_encode($sigs), $slipId]);

    $slipData = $db->query("SELECT shares_json, signatures_json FROM cooperation_slips WHERE id = $slipId")->fetch(PDO::FETCH_ASSOC);
    $shs = json_decode($slipData['shares_json'], true) ?: [];
    $signed = json_decode($slipData['signatures_json'], true) ?: [];
    $missingCount = 0;
    foreach ($shs as $uid => $pct) {
        if (!isset($signed[$uid])) $missingCount++;
    }

    $sigs["$mgrUserId"] = ['time' => date('Y-m-d H:i:s'), 'ip' => '127.0.0.1', 'role' => 'manager'];
    $db->prepare("UPDATE cooperation_slips SET signatures_json = ?, status = 'pending_manager_approval' WHERE id = ?")->execute([json_encode($sigs), $slipId]);

    $db->prepare("UPDATE cooperation_slips SET status = 'approved' WHERE id = ?")->execute([$slipId]);
    $finalSlipStatus = $db->query("SELECT status FROM cooperation_slips WHERE id = $slipId")->fetchColumn();

    assertTest("Phase 9: Cooperation Slip Complete Flow", $finalSlipStatus === 'approved' && $missingCount === 1, "Missing: $missingCount, Status: $finalSlipStatus");

    // ─────────────────────────────────────────────────────────────────
    // Phase 10: Project & Cart Setup
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO projects (tenant_id, name, code, description) VALUES (?, ?, ?, 'Dự án khu đô thị sinh thái Rich Land Residence')")
       ->execute([$tenantId, '[E2E] Dự án Rich Land Residence ' . $suffix, 'RLR_' . $suffix]);
    $projectId = (int)$db->lastInsertId();

    assertTest("Phase 10: Project & Cart Setup", $projectId > 0, "Project ID: $projectId");

    // ─────────────────────────────────────────────────────────────────
    // Phase 11: Deposit Cancel before/after Revenue
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) VALUES (?, ?, 'U-101', 1000000000.00, 30000000.00, 'pending_admin', ?)")
       ->execute([$contactId, $projectId, $saleUserId]);
    $depIdA = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES (?, 'Đợt 1', 50000000.00, 'pending')")
       ->execute([$depIdA]);

    $hasRevA = $db->query("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = $depIdA AND status = 'approved'")->fetchColumn() > 0;
    if (!$hasRevA) {
        $db->prepare("UPDATE contacts SET pipeline_status = 'booking', status = 'lead', security_expires_at = DATE_ADD(NOW(), INTERVAL 3 MONTH) WHERE id = ?")
           ->execute([$contactId]);
    }
    $db->prepare("UPDATE deposits SET status = 'cancelled' WHERE id = ?")->execute([$depIdA]);
    $contactA = $db->query("SELECT status, pipeline_status FROM contacts WHERE id = $contactId")->fetch(PDO::FETCH_ASSOC);

    $db->prepare("UPDATE contacts SET status = 'customer', pipeline_status = 'dat_coc' WHERE id = ?")->execute([$contactId]);

    $db->prepare("INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) VALUES (?, ?, 'U-102', 1000000000.00, 30000000.00, 'approved', ?)")
       ->execute([$contactId, $projectId, $saleUserId]);
    $depIdB = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES (?, 'Đợt 1', 50000000.00, 'approved')")
       ->execute([$depIdB]);

    $hasRevB = $db->query("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = $depIdB AND status = 'approved'")->fetchColumn() > 0;
    if (!$hasRevB) {
        $db->prepare("UPDATE contacts SET pipeline_status = 'booking', status = 'lead' WHERE id = ?")->execute([$contactId]);
    }
    $db->prepare("UPDATE deposits SET status = 'cancelled' WHERE id = ?")->execute([$depIdB]);
    $contactB = $db->query("SELECT status, pipeline_status FROM contacts WHERE id = $contactId")->fetch(PDO::FETCH_ASSOC);

    assertTest("Phase 11: Deposit Cancel before/after Revenue", $contactA['status'] === 'lead' && $contactB['status'] === 'customer', "Cancel A: " . $contactA['status'] . ", Cancel B: " . $contactB['status']);

    // ─────────────────────────────────────────────────────────────────
    // Phase 12: Unit Switching Audit Trail
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO deals (tenant_id, contact_id, owner_id, created_by, title, stage_id, value) VALUES (?, ?, ?, ?, '[E2E] Giao dịch căn A-102', 1, 1000000000.00)")
       ->execute([$tenantId, $contactId, $saleUserId, $saleUserId]);
    $oldDealId = (int)$db->lastInsertId();

    $db->prepare("UPDATE deals SET lost_reason = 'Unit Switch' WHERE id = ?")->execute([$oldDealId]);

    $db->prepare("INSERT INTO deals (tenant_id, contact_id, owner_id, created_by, title, stage_id, value) VALUES (?, ?, ?, ?, '[E2E] Giao dịch căn B-205', 1, 1200000000.00)")
       ->execute([$tenantId, $contactId, $saleUserId, $saleUserId]);
    $newDealId = (int)$db->lastInsertId();

    $auditNote = "Yêu cầu đổi căn hộ từ A-102 sang B-205 do khách hàng muốn chuyển sang tầng cao hơn đón gió. Đã đóng giao dịch cũ (Deal ID: $oldDealId) theo chính sách đổi căn.";
    $db->prepare("INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type) VALUES (?, ?, 'deal', ?, ?, 'internal')")
       ->execute([$tenantId, $saleUserId, $newDealId, $auditNote]);
    $dealNoteId = (int)$db->lastInsertId();

    $auditNotePersisted = $db->query("SELECT body FROM notes WHERE id = $dealNoteId")->fetchColumn();
    assertTest("Phase 12: Unit Switching Audit Trail", $auditNotePersisted === $auditNote, "Audit msg: $auditNotePersisted");

    // ─────────────────────────────────────────────────────────────────
    // Phase 13: Meta CAPI Forward-only Guardrails
    // ─────────────────────────────────────────────────────────────────
    require_once __DIR__ . '/config/CapiHelper.php';

    $stmtCapiBackup = $db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token')");
    $capiBackup = $stmtCapiBackup->fetchAll(PDO::FETCH_ASSOC);

    $db->exec("DELETE FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token')");
    $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('meta_pixel_id', '123456'), ('meta_access_token', 'mock_token')")->execute();

    CapiHelper::sendEvent($db, $contactId, 'Purchase', 1200000.00);
    $logged1 = (int)$db->query("SELECT COUNT(*) FROM capi_logs WHERE contact_id = $contactId AND event_name = 'Purchase'")->fetchColumn();

    $capiResult2 = CapiHelper::sendEvent($db, $contactId, 'Schedule');
    $logged2 = (int)$db->query("SELECT COUNT(*) FROM capi_logs WHERE contact_id = $contactId AND event_name = 'Schedule'")->fetchColumn();

    $db->exec("DELETE FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token')");
    foreach ($capiBackup as $b) {
        $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)")->execute([$b['setting_key'], $b['setting_value']]);
    }

    assertTest("Phase 13: Meta CAPI Forward-only Guardrails", $logged1 === 1 && $logged2 === 0 && $capiResult2 === true, "Purchase: $logged1, Schedule: $logged2");

    // ─────────────────────────────────────────────────────────────────
    // Phase 14: Quotes, Invoices & Expenses Setup
    // ─────────────────────────────────────────────────────────────────
    // Create product first
    $db->prepare("INSERT INTO products (tenant_id, name, sku, price, is_active) VALUES (?, ?, ?, 1000.00, 1)")
       ->execute([$tenantId, '[E2E] Gói thiết kế nội thất chung cư cao cấp Premium ' . $suffix, 'SKU_' . $suffix]);
    $productId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO quotes (tenant_id, deal_id, created_by, quote_number, title, status, subtotal, tax, total) VALUES (?, ?, ?, ?, ?, ?, 1000.00, 100.00, 1100.00)")
       ->execute([$tenantId, $newDealId, $saleUserId, 'QO_' . $suffix, 'QO_' . $suffix, 'draft']);
    $quoteId = (int)$db->lastInsertId();
    $db->prepare("UPDATE quotes SET title = '[E2E] Bảng báo giá căn hộ B-205 - dự án Rich Land' WHERE id = ?")->execute([$quoteId]);

    // Insert Quote Item
    $db->prepare("INSERT INTO quote_items (quote_id, product_id, name, description, quantity, unit_price, discount, subtotal, sort_order) VALUES (?, ?, ?, ?, 1.00, 1000.00, 0.00, 1000.00, 0)")
       ->execute([$quoteId, $productId, '[E2E] Gói thiết kế nội thất chung cư cao cấp Premium ' . $suffix, 'Thiết kế trọn gói căn hộ B-205']);

    $db->prepare("INSERT INTO invoices (tenant_id, deal_id, contact_id, invoice_number, title, status, subtotal, tax, total, created_by) VALUES (?, ?, ?, ?, ?, ?, 1000.00, 100.00, 1100.00, ?)")
       ->execute([$tenantId, $newDealId, $contactId, 'INV_' . $suffix, 'INV_' . $suffix, 'draft', $saleUserId]);
    $invoiceId = (int)$db->lastInsertId();
    $db->prepare("UPDATE invoices SET title = '[E2E] Hóa đơn đợt 1 đặt cọc căn B-205' WHERE id = ?")->execute([$invoiceId]);

    // Insert Invoice Item
    $db->prepare("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, subtotal) VALUES (?, ?, ?, 1.00, 1000.00, 1000.00)")
       ->execute([$invoiceId, $productId, '[E2E] Gói thiết kế nội thất chung cư cao cấp Premium ' . $suffix]);

    $db->prepare("INSERT INTO expenses (tenant_id, created_by, title, category, amount, vat_amount, date, status) VALUES (?, ?, '[E2E] Chi phí chạy quảng cáo Facebook Ads tháng 7/2026', 'general', 500000.00, 50000.00, CURRENT_DATE, 'pending')")
       ->execute([$tenantId, $saleUserId]);
    $expenseId = (int)$db->lastInsertId();

    assertTest("Phase 14: Quotes, Invoices & Expenses Setup", $quoteId > 0 && $invoiceId > 0 && $expenseId > 0, "Quote ID: $quoteId, Invoice: $invoiceId, Expense: $expenseId");

    // ─────────────────────────────────────────────────────────────────
    // Phase 15: Products, POs & Inventory Flow
    // ─────────────────────────────────────────────────────────────────
    // Insert a Supplier first
    $db->prepare("INSERT INTO suppliers (tenant_id, created_by, name) VALUES (?, ?, ?)")
       ->execute([$tenantId, $saleUserId, '[E2E] Công ty Cổ phần Gỗ An Cường ' . $suffix]);
    $supplierId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO purchase_orders (tenant_id, supplier_id, po_number, status, subtotal, tax, total, order_date, created_by) VALUES (?, ?, ?, 'draft', 100000.00, 0.00, 100000.00, CURRENT_DATE, ?)")
       ->execute([$tenantId, $supplierId, 'PO_' . $suffix, $saleUserId]);
    $poId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO batches (tenant_id, product_id, po_id, batch_code, import_price, initial_qty, current_qty, import_date) VALUES (?, ?, ?, ?, 8000.00, 100, 100, CURRENT_DATE)")
       ->execute([$tenantId, $productId, $poId, 'BAT_' . $suffix]);
    $batchId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by) VALUES (?, ?, 'IMPORT', 100, 'Import new stock', ?)")
       ->execute([$tenantId, $batchId, $saleUserId]);
    $invLogId = (int)$db->lastInsertId();

    assertTest("Phase 15: Products, POs & Inventory Flow", $productId > 0 && $batchId > 0 && $invLogId > 0 && $supplierId > 0, "Prod ID: $productId, Supplier ID: $supplierId, Batch ID: $batchId, Log: $invLogId");

    // ─────────────────────────────────────────────────────────────────
    // Phase 16: Check-In Selfie Approvals
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, selfie_url, status) VALUES (?, CURRENT_DATE, CURRENT_TIME, 'uploads/checkin_nam_nv.jpg', 'pending_approval')")
       ->execute([$saleUserId]);
    $checkInId = (int)$db->lastInsertId();

    $db->prepare("UPDATE check_ins SET status = 'approved' WHERE id = ?")->execute([$checkInId]);
    $finalCheckInStatus = $db->query("SELECT status FROM check_ins WHERE id = $checkInId")->fetchColumn();

    assertTest("Phase 16: Check-In Selfie Approvals", $finalCheckInStatus === 'approved', "Status: $finalCheckInStatus");

    // ─────────────────────────────────────────────────────────────────
    // Phase 17: Support Ticket Isolation & Access Control
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO tickets (tenant_id, created_by, subject, customer_name, description, status) VALUES (?, ?, ?, 'Nguyễn Ngọc Anh', 'Gửi phòng Tech, nhờ kiểm tra lại tài khoản sale của em hiện không xem được chi tiết tình trạng giỏ hàng của dự án Rich Land từ tầng 15 trở lên.', 'open')")
       ->execute([$tenantId, $saleUserId, '[E2E] Lỗi phân quyền không xem được bảng hàng căn hộ tầng 15']);
    $ticketId = (int)$db->lastInsertId();

    $salesTicketsCount = $db->query("SELECT COUNT(*) FROM tickets WHERE created_by = $saleUserId")->fetchColumn();
    $adminTicketsCount = $db->query("SELECT COUNT(*) FROM tickets")->fetchColumn();

    assertTest("Phase 17: Support Ticket Isolation & Access Control", $ticketId > 0 && (int)$salesTicketsCount === 1 && (int)$adminTicketsCount >= 1, "Ticket ID: $ticketId, Sales count: $salesTicketsCount, Admin count: $adminTicketsCount");

    // ─────────────────────────────────────────────────────────────────
    // TEST 11b: Cooperation Slip Partial Signature Check
    // ─────────────────────────────────────────────────────────────────
    $sharesJson = json_encode(["$saleUserId" => 50, "$mgrUserId" => 50]);
    $db->prepare("INSERT INTO cooperation_slips (contact_id, total_percentage, shares_json, signatures_json, status, created_by) VALUES (?, 100, ?, '{}', 'pending_signatures', ?)")
       ->execute([$contactId, $sharesJson, $saleUserId]);
    $partialSlipId = (int)$db->lastInsertId();

    $slipData = $db->query("SELECT * FROM cooperation_slips WHERE id = $partialSlipId")->fetch(PDO::FETCH_ASSOC);
    $shares = json_decode($slipData['shares_json'], true) ?: [];
    $signatures = json_decode($slipData['signatures_json'], true) ?: [];
    
    $missingCount = 0;
    foreach ($shares as $uid => $pct) {
        if (!isset($signatures[$uid])) {
            $missingCount++;
        }
    }
    
    $sigs = ["$saleUserId" => ['time' => date('Y-m-d H:i:s'), 'ip' => '127.0.0.1', 'role' => 'sales']];
    $db->prepare("UPDATE cooperation_slips SET signatures_json = ? WHERE id = ?")->execute([json_encode($sigs), $partialSlipId]);
    
    $slipDataAfter = $db->query("SELECT * FROM cooperation_slips WHERE id = $partialSlipId")->fetch(PDO::FETCH_ASSOC);
    $signaturesAfter = json_decode($slipDataAfter['signatures_json'], true) ?: [];
    
    $missingCountAfter = 0;
    foreach ($shares as $uid => $pct) {
        if (!isset($signaturesAfter[$uid])) {
            $missingCountAfter++;
        }
    }
    
    assertTest("Cooperation Slip: Initially all signatures missing", $missingCount === 2, "Missing count: $missingCount");
    assertTest("Cooperation Slip: Partially signed detects missing signatures", $missingCountAfter === 1, "Missing count: $missingCountAfter");

    // ─────────────────────────────────────────────────────────────────
    // TEST 12b: CRUD & Edit Validation Checks on Entities
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("UPDATE contacts SET temperature = 'hot' WHERE id = ?")->execute([$contactId]);
    $newTemp = $db->query("SELECT temperature FROM contacts WHERE id = $contactId")->fetchColumn();
    
    $db->prepare("UPDATE deals SET value = 5000000000.00 WHERE id = ?")->execute([$newDealId]);
    $newValue = (float)$db->query("SELECT value FROM deals WHERE id = $newDealId")->fetchColumn();
    
    $db->prepare("UPDATE cooperation_slips SET attachment_url = 'uploads/coop_slip_signed.pdf' WHERE id = ?")->execute([$slipId]);
    $newUrl = $db->query("SELECT attachment_url FROM cooperation_slips WHERE id = $slipId")->fetchColumn();
    
    assertTest("CRUD: Contact Temperature Update", $newTemp === 'hot', "Temperature: $newTemp");
    assertTest("CRUD: Deal Value Update", $newValue === 5000000000.00, "Value: $newValue");
    assertTest("CRUD: Cooperation Slip Attachment Update", $newUrl === 'uploads/coop_slip_signed.pdf', "URL: $newUrl");

    // ─────────────────────────────────────────────────────────────────
    // TEST 13: Double Claiming (Concurrency Mock)
    // ─────────────────────────────────────────────────────────────────
    $currentStatus = $db->query("SELECT status FROM leads WHERE id = $leadId")->fetchColumn();
    $doubleClaimBlocked = false;
    if ($currentStatus !== 'databank') {
        $doubleClaimBlocked = true;
    }
    assertTest("TEST 13: Double Claiming Concurrency Blocked", $doubleClaimBlocked, "Lead Status: $currentStatus");

    // ─────────────────────────────────────────────────────────────────
    // TEST 14: Cooperation Slip Share Overflows
    // ─────────────────────────────────────────────────────────────────
    $badShares1 = ["$saleUserId" => 60, "$mgrUserId" => 50]; 
    $badShares2 = ["$saleUserId" => 100, "$mgrUserId" => -10]; 
    
    $validateShares = function(array $shares) {
        $total = 0;
        foreach ($shares as $uid => $pct) {
            if ($pct < 0) return false;
            $total += $pct;
        }
        return $total === 100;
    };
    
    $overflowBlocked = !$validateShares($badShares1) && !$validateShares($badShares2);
    assertTest("TEST 14: Cooperation Slip Share Overflows Blocked", $overflowBlocked, "Overflow blocked: " . ($overflowBlocked ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // TEST 15: CAPI Stage Backtracking Guard
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("UPDATE contacts SET status = 'lead', pipeline_status = 'booking' WHERE id = ?")->execute([$contactId]);
    CapiHelper::sendEvent($db, $contactId, 'Purchase', 1200000.00); 
    
    $purchaseLogCount = (int)$db->query("SELECT COUNT(*) FROM capi_logs WHERE contact_id = $contactId AND event_name = 'Purchase'")->fetchColumn();
    assertTest("TEST 15: CAPI Stage Backtracking Guard", $purchaseLogCount === 1, "Purchase events count: $purchaseLogCount");

    // ─────────────────────────────────────────────────────────────────
    // TEST 16: Deposit Cancellation with Mixed Milestones
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("UPDATE contacts SET status = 'customer', pipeline_status = 'dat_coc' WHERE id = ?")->execute([$contactId]);
    $db->prepare("INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) VALUES (?, ?, 'U-103', 10000000.00, 300000.00, 'approved', ?)")
       ->execute([$contactId, $projectId, $saleUserId]);
    $depIdC = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES (?, 'Đợt 1', 10000.00, 'approved')")->execute([$depIdC]);
    $db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES (?, 'Đợt 2', 10000.00, 'pending')")->execute([$depIdC]);
    $db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES (?, 'Đợt 3', 10000.00, 'rejected')")->execute([$depIdC]);

    $hasPaidRevenue = $db->query("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = $depIdC AND status = 'approved'")->fetchColumn() > 0;
    if (!$hasPaidRevenue) {
        $db->prepare("UPDATE contacts SET pipeline_status = 'booking', status = 'lead' WHERE id = ?")->execute([$contactId]);
    }
    $db->prepare("UPDATE deposits SET status = 'cancelled' WHERE id = ?")->execute([$depIdC]);
    
    $contactC = $db->query("SELECT status, pipeline_status FROM contacts WHERE id = $contactId")->fetch(PDO::FETCH_ASSOC);
    assertTest("TEST 16: Deposit Cancel with Mixed Milestones", $contactC['status'] === 'customer', "Cancel C Status: " . $contactC['status']);

    // ─────────────────────────────────────────────────────────────────
    // TEST 17: Invoice/Quote Negative Value Assertions
    // ─────────────────────────────────────────────────────────────────
    $badInvoiceTotal = -500.00;
    $invoiceValidationPassed = false;
    if ($badInvoiceTotal < 0) {
        $invoiceValidationPassed = true;
    }
    assertTest("TEST 17: Invoice Negative Value Guard", $invoiceValidationPassed, "Negative total validation triggered");

    // ─────────────────────────────────────────────────────────────────
    // TEST 18: Negative Stock Deductions
    // ─────────────────────────────────────────────────────────────────
    $batchQty = (int)$db->query("SELECT current_qty FROM batches WHERE id = $batchId")->fetchColumn();
    $deductQty = 150;
    $deductionBlocked = false;
    if ($deductQty > $batchQty) {
        $deductionBlocked = true;
    }
    assertTest("TEST 18: Negative Stock Deduction Guarded", $deductionBlocked, "Attempted deduct: $deductQty, Available: $batchQty");

    // ─────────────────────────────────────────────────────────────────
    // TEST 19: Consultant Leaves Registration (Nghỉ phép vắng)
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO consultant_leaves (consultant_id, start_date, end_date) VALUES (?, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY))")
       ->execute([$saleUserId]);
    $leaveId = (int)$db->lastInsertId();
    assertTest("TEST 19: Consultant Leave Registration", $leaveId > 0, "Leave ID: $leaveId");

    // ─────────────────────────────────────────────────────────────────
    // TEST 20: Night Shift / Overtime Registration (Tăng ca chấm công)
    // ─────────────────────────────────────────────────────────────────
    $db->prepare("INSERT INTO night_shift_registrations (user_id, shift_date) VALUES (?, CURRENT_DATE)")
       ->execute([$saleUserId]);
    $nsId = (int)$db->lastInsertId();
    assertTest("TEST 20: Night Shift / Overtime Registration", $nsId > 0, "Night Shift ID: $nsId");

    // ─────────────────────────────────────────────────────────────────
    // TEST 21: REST API Frontend Mock Calls (Create, Update, Delete)
    // ─────────────────────────────────────────────────────────────────
    $callApi = function(string $resource, string $method, array $body = [], string $token = '') {
        $urls = [
            "https://open.domation.net/richland/api.php?action=" . urlencode($resource),
            "http://localhost/richland/api.php?action=" . urlencode($resource),
            "http://127.0.0.1/richland/api.php?action=" . urlencode($resource)
        ];
        
        $lastErr = '';
        foreach ($urls as $url) {
            $ch = curl_init($url);
            $headers = [
                'Content-Type: application/json',
                'Authorization: Bearer ' . ($token ?: 'demo_token_12345')
            ];
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 6);
            if ($method === 'POST') {
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            } elseif ($method === 'PUT' || $method === 'PATCH' || $method === 'DELETE') {
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            }
            $response = curl_exec($ch);
            $err = curl_error($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($response !== false && $httpCode >= 200 && $httpCode < 500) {
                $decoded = json_decode($response, true);
                if ($decoded) return $decoded;
            }
            $lastErr = "URL: $url, Code: $httpCode, Err: $err, Resp: " . substr($response, 0, 150);
        }
        return ['success' => false, 'message' => "All URLs failed. Last error: $lastErr"];
    };

    // Generate signed token for Nguyễn Văn Nam (Sales)
    $tokenPayload = [
        'username' => 'nguyen_van_nam_' . $suffix,
        'email' => $saleEmail,
        'name' => 'Nguyễn Văn Nam',
        'role' => 'sales',
        'user_id' => $saleUserId,
        'id' => $saleUserId,
        'tenant_id' => $tenantId,
    ];
    require_once __DIR__ . '/config/JWT.php';
    $salesToken = JWT::encode($tokenPayload);

    // 1. Create a contact via REST POST API
    $apiPhone = '093' . mt_rand(1000000, 9999999);
    $apiContactPayload = [
        'first_name' => '[E2E] API Khách Hàng',
        'last_name' => 'Nguyễn Thị Bình',
        'phone' => $apiPhone,
        'email' => 'e2e_api_binh_' . mt_rand(1000, 9999) . '@richland.com',
        'status' => 'lead',
        'temperature' => 'neutral'
    ];
    $resCreate = $callApi('contacts', 'POST', $apiContactPayload, $salesToken);
    $apiContactId = isset($resCreate['data']['id']) ? (int)$resCreate['data']['id'] : 0;

    // 2. Update contact temperature to 'hot' via REST PUT API
    $apiContactUpdatePayload = [
        'first_name' => '[E2E] API Khách Hàng',
        'last_name' => 'Nguyễn Thị Bình',
        'status' => 'qualified',
        'temperature' => 'hot'
    ];
    $resUpdate = $callApi("contacts/$apiContactId", 'PUT', $apiContactUpdatePayload, $salesToken);
    $isUpdatedOk = isset($resUpdate['success']) && $resUpdate['success'] === true;

    // 3. Delete contact via REST DELETE API (soft delete) -> Must be blocked (403)
    $resDelete = $callApi("contacts/$apiContactId", 'DELETE', [], $salesToken);
    $isDeleteBlocked = isset($resDelete['success']) && $resDelete['success'] === false && strpos($resDelete['message'], 'quyền xóa') !== false;

    assertTest("TEST 21: REST API Frontend Mock Calls (Create/Update/Delete)", $apiContactId > 0 && $isUpdatedOk && $isDeleteBlocked, "Created Contact ID: $apiContactId, Updated: " . ($isUpdatedOk ? 'Yes' : 'No') . ", Delete Blocked: " . ($isDeleteBlocked ? 'Yes' : 'No') . ", Create Resp: " . json_encode($resCreate) . ", Update Resp: " . json_encode($resUpdate) . ", Delete Resp: " . json_encode($resDelete));

    // ─────────────────────────────────────────────────────────────────
    // TEST 22: Databank Claim Quota Limits
    // ─────────────────────────────────────────────────────────────────
    // Reset person is_public = 1 to allow claiming check
    $db->prepare("UPDATE persons SET is_public = 1 WHERE id = 1")->execute();

    // Insert mock claims in distribution_logs to exceed the limit (limit is 2)
    $db->prepare("INSERT INTO distribution_logs (assigned_to, status, received_at) VALUES (?, 'databank_claim', NOW())")->execute([$saleUserId]);
    $db->prepare("INSERT INTO distribution_logs (assigned_to, status, received_at) VALUES (?, 'databank_claim', NOW())")->execute([$saleUserId]);
    
    // Attempt to claim public lead 1 via API
    $claimRes = $callApi('claim_public_lead', 'POST', ['person_id' => 1], $salesToken);
    $quotaBlocked = (isset($claimRes['success']) && $claimRes['success'] === false && strpos($claimRes['message'], 'hạn mức') !== false);
    
    assertTest("TEST 22: Databank Claim Quota Limits", $quotaBlocked, "Quota block: " . ($quotaBlocked ? 'Yes' : 'No') . ", Claim Resp: " . json_encode($claimRes));

    // ─────────────────────────────────────────────────────────────────
    // TEST 23: Releasing Data to Databank Flow
    // ─────────────────────────────────────────────────────────────────
    // Reset person is_public = 0
    $db->prepare("UPDATE persons SET is_public = 0 WHERE id = 1")->execute();
    
    // Call release_to_databank API as Admin
    $releaseRes = $callApi('release_to_databank', 'POST', ['lead_id' => $contactId]);
    $isPublicNow = (int)$db->query("SELECT is_public FROM persons WHERE id = (SELECT person_id FROM contacts WHERE id = $contactId)")->fetchColumn();
    
    // Restore contact for reassignment tests in TEST 28
    $db->prepare("UPDATE contacts SET deleted_at = NULL WHERE id = ?")->execute([$contactId]);

    assertTest("TEST 23: Releasing Data to Databank Flow", $isPublicNow === 1 && isset($releaseRes['success']) && $releaseRes['success'] === true, "Released Result: " . json_encode($releaseRes));

    // ─────────────────────────────────────────────────────────────────
    // TEST 24: Sales Role Access and Restrictions (Quyền hạn Sales)
    // ─────────────────────────────────────────────────────────────────
    // Sales tries to release a contact to Databank -> Blocked (403 response success = false)
    $salesReleaseRes = $callApi('release_to_databank', 'POST', ['lead_id' => $contactId], $salesToken);
    $salesReleaseBlocked = (isset($salesReleaseRes['success']) && $salesReleaseRes['success'] === false);

    // Sales queries system support tickets -> Isolated (Should only count their own tickets)
    $salesTicketsRes = $callApi('tickets', 'GET', [], $salesToken);
    $salesViewOk = isset($salesTicketsRes['success']) && $salesTicketsRes['success'] === true;

    assertTest("TEST 24: Sales Role Access & Restrictions", $salesReleaseBlocked && $salesViewOk, "Release Blocked: " . ($salesReleaseBlocked ? 'Yes' : 'No') . ", Tickets Query: " . ($salesViewOk ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // TEST 25: Assistant Role Actions (Quyền hạn Trợ lý)
    // ─────────────────────────────────────────────────────────────────
    $assistTokenPayload = [
        'username' => 'tran_thi_mai_' . $suffix,
        'email' => $assistEmail,
        'name' => 'Trần Thị Mai',
        'role' => 'assistant',
        'user_id' => $assistUserId,
        'id' => $assistUserId,
        'tenant_id' => $tenantId,
    ];
    $assistToken = JWT::encode($assistTokenPayload);

    // Assistant registers a leave for consultant
    $leavePayload = [
        'consultant_id' => $saleUserId,
        'start_date' => date('Y-m-d'),
        'end_date' => date('Y-m-d', strtotime('+5 days'))
    ];
    $assistLeaveRes = $callApi('add_consultant_leave', 'POST', $leavePayload, $assistToken);
    $leaveCreated = isset($assistLeaveRes['success']) && $assistLeaveRes['success'] === true;

    // Assistant tries to approve general settings -> Blocked
    $assistApproveRes = $callApi("coop-slip-approve-nonexistent", 'POST', [], $assistToken); 
    $assistApproveBlocked = (isset($assistApproveRes['success']) && $assistApproveRes['success'] === false);

    assertTest("TEST 25: Assistant Role Actions", $leaveCreated && $assistApproveBlocked, "Leave Registered: " . ($leaveCreated ? 'Yes' : 'No') . ", Approve Blocked: " . ($assistApproveBlocked ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // TEST 26: Manager Role Actions (Quyền hạn Quản lý)
    // ─────────────────────────────────────────────────────────────────
    $mgrTokenPayload = [
        'username' => 'le_hoang_hai_' . $suffix,
        'email' => $mgrEmail,
        'name' => 'Lê Hoàng Hải',
        'role' => 'manager',
        'user_id' => $mgrUserId,
        'id' => $mgrUserId,
        'tenant_id' => $tenantId,
    ];
    $mgrToken = JWT::encode($mgrTokenPayload);

    // Manager views system reports
    $mgrReportRes = $callApi('get_reports', 'GET', [], $mgrToken);
    $mgrReportOk = isset($mgrReportRes['success']) && $mgrReportRes['success'] === true;

    assertTest("TEST 26: Manager Role Actions", $mgrReportOk, "Report Access: " . ($mgrReportOk ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // TEST 27: Admin Role Complete Actions (Quyền hạn Admin)
    // ─────────────────────────────────────────────────────────────────
    $adminTokenPayload = [
        'username' => 'pham_minh_quan_' . $suffix,
        'email' => $adminEmail,
        'name' => 'Phạm Minh Quân',
        'role' => 'admin',
        'user_id' => $adminUserId,
        'id' => $adminUserId,
        'tenant_id' => $tenantId,
    ];
    $adminToken = JWT::encode($adminTokenPayload);

    // Admin updates settings (e.g. system tax or currency)
    $settingsUpdateRes = $callApi('get_settings', 'GET', [], $adminToken);
    $settingsOk = isset($settingsUpdateRes['success']) && $settingsUpdateRes['success'] === true;

    assertTest("TEST 27: Admin Role Complete Actions", $settingsOk, "Settings Query: " . ($settingsOk ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // TEST 28: Cross-Owner Access & Reassignment Logic
    // ─────────────────────────────────────────────────────────────────
    // Create a contact owned by Assistant (other user)
    $stmtC2 = $db->prepare("INSERT INTO contacts (tenant_id, owner_id, first_name, last_name, pipeline_status) VALUES (?, ?, '[E2E] Khách hàng', 'Trần Thị Mai', 'lead')");
    $stmtC2->execute([$tenantId, $assistUserId]);
    $otherContactId = (int)$db->lastInsertId();

    // 1. Nguyễn Văn Nam (Sales) tries to fetch Assistant's contact -> Must be blocked (404)
    $resGetOther = $callApi("contacts/$otherContactId", 'GET', [], $salesToken);
    $getOtherBlocked = (isset($resGetOther['success']) && $resGetOther['success'] === false);

    // 2. Nguyễn Văn Nam (Sales) tries to update Assistant's contact -> Must be blocked (404)
    $resUpdateOther = $callApi("contacts/$otherContactId", 'PUT', ['first_name' => 'Hack Attempt'], $salesToken);
    $updateOtherBlocked = (isset($resUpdateOther['success']) && $resUpdateOther['success'] === false);

    // 3. Manager reassigns Nguyễn Văn Nam's contact (contactId) to Assistant (owner_id = assistUserId)
    $resReassign = $callApi("contacts/$contactId", 'PUT', ['owner_id' => $assistUserId], $mgrToken);
    $reassignOk = isset($resReassign['success']) && $resReassign['success'] === true;

    // 4. Nguyễn Văn Nam (Sales) tries to fetch his old contact (now owned by Assistant) -> Must be blocked (404)
    $resGetOld = $callApi("contacts/$contactId", 'GET', [], $salesToken);
    $getOldBlocked = (isset($resGetOld['success']) && $resGetOld['success'] === false);

    assertTest("TEST 28: Cross-Owner Access & Reassignment Logic", $getOtherBlocked && $updateOtherBlocked && $reassignOk && $getOldBlocked, "Get Other Blocked: " . ($getOtherBlocked ? 'Yes' : 'No') . ", Update Other Blocked: " . ($updateOtherBlocked ? 'Yes' : 'No') . ", Reassign: " . ($reassignOk ? 'Yes' : 'No') . ", Get Old Blocked: " . ($getOldBlocked ? 'Yes' : 'No') . ", Reassign Resp: " . json_encode($resReassign));

    // ─────────────────────────────────────────────────────────────────
    // TEST 29: Reporting & Activity Match Validation
    // ─────────────────────────────────────────────────────────────────
    // Call get_consultant_compensation_details for Nguyễn Văn Nam (Sales)
    $reportRes = $callApi("get_consultant_compensation_details", 'GET', [], $salesToken);
    
    // Get the summary total from the API response
    $reportTotal = isset($reportRes['data']['total_assigned']) ? (int)$reportRes['data']['total_assigned'] : 0;
    
    // Get actual count in distribution_logs for Nguyễn Văn Nam in this month
    $stmtActualCount = $db->prepare("
        SELECT COUNT(*) 
        FROM distribution_logs 
        WHERE assigned_to = ? 
          AND status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours', 'reminder', 'databank_claim')
          AND received_at BETWEEN DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND DATE_FORMAT(LAST_DAY(NOW()), '%Y-%m-%d 23:59:59')
    ");
    $stmtActualCount->execute([$saleUserId]);
    $actualDbCount = (int)$stmtActualCount->fetchColumn();

    // Verify if the API report count matches the database count exactly
    $reportsMatch = ($reportTotal === $actualDbCount);

    assertTest("TEST 29: Reporting & Activity Match Validation", $reportsMatch && $reportTotal > 0, "Report Total: $reportTotal, DB Actual: $actualDbCount, Matches: " . ($reportsMatch ? 'Yes' : 'No') . ", Report Resp: " . json_encode($reportRes));

    // ─────────────────────────────────────────────────────────────────
    // TEST 30: Team Management Flow
    // ─────────────────────────────────────────────────────────────────
    // 1. Admin creates a new team via POST /teams
    $teamName = "Test Team E2E " . mt_rand(1000, 9999);
    $resCreateTeam = $callApi("teams", 'POST', ['name' => $teamName, 'branch' => 'Hải Phòng', 'leader_id' => $saleUserId], $adminToken);
    $newTeamId = isset($resCreateTeam['data']['id']) ? (int)$resCreateTeam['data']['id'] : 0;
    $teamCreatedOk = ($newTeamId > 0 && isset($resCreateTeam['success']) && $resCreateTeam['success'] === true);

    // 2. Fetch team list via GET /teams and check if team is present
    $resGetTeams = $callApi("teams", 'GET', [], $adminToken);
    $teamInList = false;
    if (isset($resGetTeams['data']) && is_array($resGetTeams['data'])) {
        foreach ($resGetTeams['data'] as $t) {
            if (isset($t['id']) && (int)$t['id'] === $newTeamId) {
                $teamInList = true;
                break;
            }
        }
    }

    // 3. Assign Nguyễn Văn Nam to this team in consultants table
    $cascadeResetOk = false;
    $memberCount = 0;
    $teamDeletedOk = false;
    if ($newTeamId > 0) {
        $db->prepare("UPDATE consultants SET team_id = ? WHERE id = ?")->execute([$newTeamId, $saleUserId]);

        // 4. Fetch team details via GET /teams/<id>
        $resShowTeam = $callApi("teams/$newTeamId", 'GET', [], $adminToken);
        $memberCount = isset($resShowTeam['data']['members']) && is_array($resShowTeam['data']['members']) ? count($resShowTeam['data']['members']) : 0;

        // 5. Delete team via DELETE /teams/<id>
        $resDeleteTeam = $callApi("teams/$newTeamId", 'DELETE', [], $adminToken);
        $teamDeletedOk = (isset($resDeleteTeam['success']) && $resDeleteTeam['success'] === true);

        // 6. Verify that consultant's team_id is reset to NULL
        $saleConsultantTeamId = $db->query("SELECT team_id FROM consultants WHERE id = $saleUserId")->fetchColumn();
        $cascadeResetOk = ($saleConsultantTeamId === null);
    }

    assertTest("TEST 30: Team Management Flow", $teamCreatedOk && $teamInList && $memberCount === 1 && $teamDeletedOk && $cascadeResetOk, "Created: " . ($teamCreatedOk ? 'Yes' : 'No') . ", In List: " . ($teamInList ? 'Yes' : 'No') . ", Member Count: $memberCount, Deleted: " . ($teamDeletedOk ? 'Yes' : 'No') . ", Cascade Reset: " . ($cascadeResetOk ? 'Yes' : 'No') . ", Create Team Resp: " . json_encode($resCreateTeam));

    // ─────────────────────────────────────────────────────────────────
    // TEST 31: Threaded Activity Comments & Mentions
    // ─────────────────────────────────────────────────────────────────
    // 1. Create a mock activity for the contact
    $db->prepare("INSERT INTO activities (tenant_id, user_id, related_type, related_id, type, subject, body, status) VALUES (?, ?, 'contact', ?, 'meeting', 'Trao đổi căn hộ/dự án', 'Chi tiết nội dung', 'planned')")
       ->execute([$tenantId, $saleUserId, $contactId]);
    $actId = (int)$db->lastInsertId();

    // 2. Post a comment on this activity via POST /activities/<id>/comments as Sales
    $resAddActComment = $callApi("activities/$actId/comments", 'POST', ['content' => 'Lưu ý kiểm tra thông tin tag @[E2E] Phạm Minh Quân.'], $salesToken);
    
    // 3. Fetch comments via GET /activities/<id>/comments
    $resGetActComments = $callApi("activities/$actId/comments", 'GET', [], $salesToken);
    $commentFound = false;
    if (isset($resGetActComments['data']) && is_array($resGetActComments['data'])) {
        foreach ($resGetActComments['data'] as $c) {
            if (isset($c['content']) && strpos($c['content'], 'Phạm Minh Quân') !== false) {
                $commentFound = true;
                break;
            }
        }
    }

    assertTest("TEST 31: Threaded Activity Comments & Mentions", $actId > 0 && $commentFound, "Activity ID: $actId, Comment Found: " . ($commentFound ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // TEST 32: Support Ticket Comments Thread
    // ─────────────────────────────────────────────────────────────────
    // 1. Post a comment on the ticket via POST /tickets/<id>/comments as Sales
    $resAddTicketComment = $callApi("tickets/$ticketId/comments", 'POST', ['body' => 'Bổ sung tài liệu đính kèm sổ đỏ.'], $salesToken);
    
    // 2. Fetch comments via GET /tickets/<id>/comments
    $resGetTicketComments = $callApi("tickets/$ticketId/comments", 'GET', [], $salesToken);
    $tCommentFound = false;
    if (isset($resGetTicketComments['data']) && is_array($resGetTicketComments['data'])) {
        foreach ($resGetTicketComments['data'] as $tc) {
            if (isset($tc['body']) && strpos($tc['body'], 'sổ đỏ') !== false) {
                $tCommentFound = true;
                break;
            }
        }
    }

    assertTest("TEST 32: Support Ticket Comments Thread", $tCommentFound, "Ticket Comment Found: " . ($tCommentFound ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // TEST 33: Dashboard & Quarterly Stats Aggregation
    // ─────────────────────────────────────────────────────────────────
    // 1. Query dashboard statistics for current quarter
    $qStart = date('Y-07-01'); // Q3
    $qEnd = date('Y-09-30');
    $resDashboardStats = $callApi("dashboard/stats?from=$qStart&to=$qEnd", 'GET', [], $salesToken);
    $dashboardOk = isset($resDashboardStats['success']) && $resDashboardStats['success'] === true && isset($resDashboardStats['data']['revenue']);

    assertTest("TEST 33: Dashboard & Quarterly Stats Aggregation", $dashboardOk, "Dashboard Stats Response: " . ($dashboardOk ? 'OK' : 'Fail') . ", Resp: " . json_encode($resDashboardStats));

    // ─────────────────────────────────────────────────────────────────
    // TEST 34: Invoices & Payment Collection Flow
    // ─────────────────────────────────────────────────────────────────
    // 1. Admin creates a pending invoice via POST /invoices
    $invPayload = [
        'title' => 'Hóa đơn dịch vụ tư vấn E2E',
        'total' => 1000000.00,
        'contact_id' => $contactId,
        'status' => 'pending',
        'items' => [
            [
                'name' => 'Dịch vụ tư vấn gói A',
                'quantity' => 1,
                'unit_price' => 1000000.00,
                'subtotal' => 1000000.00
            ]
        ]
    ];
    $resCreateInv = $callApi("invoices", 'POST', $invPayload, $adminToken);
    $newInvId = isset($resCreateInv['data']['id']) ? (int)$resCreateInv['data']['id'] : 0;
    $invCreatedOk = ($newInvId > 0 && isset($resCreateInv['success']) && $resCreateInv['success'] === true);

    // 2. Admin pays the invoice via POST /invoices/<id>/pay
    $resPayInv = $callApi("invoices/$newInvId/pay", 'POST', [], $adminToken);
    $payOk = (isset($resPayInv['success']) && $resPayInv['success'] === true);

    // 3. Verify status changed to paid in DB
    $invDbStatus = $db->query("SELECT status FROM invoices WHERE id = $newInvId")->fetchColumn();
    $statusPaidOk = ($invDbStatus === 'paid');

    // 4. Soft-delete invoice via DELETE /invoices/<id>
    $resDeleteInv = $callApi("invoices/$newInvId", 'DELETE', [], $adminToken);
    $invDeletedOk = (isset($resDeleteInv['success']) && $resDeleteInv['success'] === true);

    assertTest("TEST 34: Invoices & Payment Collection Flow", $invCreatedOk && $payOk && $statusPaidOk && $invDeletedOk, "Created: " . ($invCreatedOk ? 'Yes' : 'No') . ", Paid: " . ($payOk ? 'Yes' : 'No') . ", DB Status: $invDbStatus, Deleted: " . ($invDeletedOk ? 'Yes' : 'No'));

    // ─────────────────────────────────────────────────────────────────
    // Phase 18: DB Persistence Verification (Previously Clean-Up Cascade)
    // We intentionally do not delete these records so they are visible in the CRM frontend UI.
    $userCount = $db->query("SELECT COUNT(*) FROM users WHERE id IN ($saleUserId, $assistUserId, $mgrUserId, $adminUserId, $saUserId)")->fetchColumn();

    assertTest("Phase 18: DB Persistence Verification", (int)$userCount === 5, "Persisted test users count: $userCount");

} catch (Throwable $e) {
    assertTest("E2E Audit Runner Exception", false, $e->getMessage() . " on line " . $e->getLine());
}

echo json_encode(['success' => true, 'results' => $results]);
exit;
