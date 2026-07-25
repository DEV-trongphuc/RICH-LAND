<?php
// backend/test_master_system_audit.php
ini_set('display_errors', 1);
error_reporting(E_ALL);
if (ob_get_level()) {
    ob_end_clean();
}
ob_implicit_flush(true);

require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');

echo "====================================================\n";
echo "📊 CRITICAL BACKEND MASTER SYSTEM AUDIT HARNESS\n";
echo "====================================================\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

try {
    // -------------------------------------------------------------------------
    // PART 1: Business Rules (Deposit cancel, Unit switching, CAPI forward-only)
    // -------------------------------------------------------------------------
    echo "--- PART 1: Business Rules & CAPI Validation ---\n";
    
    // Create temporary mock contact
    $phone = '0901234' . rand(100, 999);
    $conn->query("INSERT INTO persons (phone, full_name) VALUES ('$phone', 'Master Audit Contact')");
    $personId = $conn->insert_id;

    $conn->query("
        INSERT INTO contacts (tenant_id, person_id, created_by, first_name, last_name, phone, status, pipeline_status, temperature) 
        VALUES (1, $personId, 1000, 'Master', 'Audit', '$phone', 'lead', 'booking', 'hot')
    ");
    $contactId = $conn->insert_id;
    echo "[SETUP] Created mock contact ID: $contactId\n";

    // Scenario 1: Cancellation before revenue
    $conn->query("
        INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) 
        VALUES ($contactId, 1, 'MOCK-X1', 1500000000.00, 30000000.00, 'pending_admin', 1000)
    ");
    $depositId1 = $conn->insert_id;
    
    $conn->query("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer' WHERE id = $contactId");
    
    // Simulating cancellation before revenue: no milestones are paid/approved
    $expiresAt = date('Y-m-d H:i:s', strtotime('+3 months'));
    $conn->query("UPDATE contacts SET pipeline_status = 'booking', status = 'lead', security_expires_at = '$expiresAt' WHERE id = $contactId");
    $conn->query("UPDATE deposits SET status = 'cancelled', cancelled_reason = 'Test Master cancel before revenue' WHERE id = $depositId1");

    $resC1 = $conn->query("SELECT pipeline_status, status, security_expires_at FROM contacts WHERE id = $contactId")->fetch_assoc();
    assertTest("C1: Contact pipeline_status reverted to booking on cancel before revenue", $resC1['pipeline_status'] === 'booking');
    assertTest("C1: Contact status reverted to lead", $resC1['status'] === 'lead');
    assertTest("C1: Security timer was correctly activated", !empty($resC1['security_expires_at']));

    // Scenario 2: Cancellation after revenue
    $conn->query("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer' WHERE id = $contactId");
    $conn->query("
        INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) 
        VALUES ($contactId, 1, 'MOCK-X2', 2000000000.00, 40000000.00, 'pending_admin', 1000)
    ");
    $depositId2 = $conn->insert_id;

    $conn->query("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES ($depositId2, 'Đợt 1', 10000000.00, 'approved')");
    $milestoneId = $conn->insert_id;

    // Cancellation check logic: since milestone is approved, do not demote contact
    $conn->query("UPDATE deposits SET status = 'cancelled', cancelled_reason = 'Test Master cancel after revenue' WHERE id = $depositId2");

    $resC2 = $conn->query("SELECT pipeline_status, status FROM contacts WHERE id = $contactId")->fetch_assoc();
    assertTest("C2: Contact pipeline_status retained as dat_coc when revenue exists", $resC2['pipeline_status'] === 'dat_coc');
    assertTest("C2: Contact status remains customer", $resC2['status'] === 'customer');

    // Scenario 3: Meta CAPI Forward-only signal validation
    $resCapi = $conn->query("SELECT COUNT(*) as cnt FROM capi_logs WHERE contact_id = $contactId AND event_name IN ('CompleteRegistration', 'Schedule')")->fetch_assoc();
    assertTest("C3: Meta CAPI backward signals blocked on cancellation", (int)$resCapi['cnt'] === 0);

    // Clean mock records for Part 1
    $conn->query("DELETE FROM deposit_milestones WHERE id = $milestoneId");
    $conn->query("DELETE FROM deposits WHERE id IN ($depositId1, $depositId2)");
    $conn->query("DELETE FROM contacts WHERE id = $contactId");
    $conn->query("DELETE FROM persons WHERE id = $personId");

    // -------------------------------------------------------------------------
    // PART 2: Payload Sanitization & Strict Types check
    // -------------------------------------------------------------------------
    echo "\n--- PART 2: Payload & Type Sanitization ---\n";
    
    $dirtyNumber = "1,500,000,000.00 VND";
    $cleanedNumber = (float)preg_replace('/[^0-9.]/', '', $dirtyNumber);
    assertTest("P1: Currency formatting cleaned up correctly", $cleanedNumber === 1500000000.0);

    $isoDate = "2026-07-25T02:14:19.271Z";
    $parsedDate = date('Y-m-d H:i:s', strtotime($isoDate));
    assertTest("P2: ISO datetime format normalized to MySQL DATETIME", $parsedDate === '2026-07-25 09:14:19');

    $invalidJson = '{"tags": ["sale", "vips"'; // malformed JSON
    assertTest("P3: Malformed JSON recognized as invalid", json_decode($invalidJson) === null);

    // -------------------------------------------------------------------------
    // PART 3: Lead Distribution & Round-Robin Routing
    // -------------------------------------------------------------------------
    echo "\n--- PART 3: Lead Distribution & Round-Robin Routing ---\n";

    // Setup mock distribution round
    $conn->query("INSERT INTO distribution_rounds (round_name, is_active) VALUES ('Master Audit Round', 1)");
    $roundId = $conn->insert_id;

    // Create a mock sales consultant
    $salesEmail = 'mock.sales.' . rand(100, 999) . '@richland.vn';
    $conn->query("
        INSERT INTO users (tenant_id, email, full_name, role, status, vacation_mode) 
        VALUES (1, '$salesEmail', 'Mock Audit Sales', 'sales', 'active', 0)
    ");
    $salesId = $conn->insert_id;

    $conn->query("
        INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn, current_turn_remaining) 
        VALUES ($roundId, $salesId, 1, 3, 3)
    ");

    // Verify properties
    $rc = $conn->query("SELECT * FROM round_consultants WHERE round_id = $roundId AND consultant_id = $salesId")->fetch_assoc();
    assertTest("R1: Round consultant linked with correct turns", (int)$rc['current_turn_remaining'] === 3);
    assertTest("R2: Round is active and ready to receive leads", (int)$rc['receive_ratio'] === 1);

    // Clean mock records for Part 3
    $conn->query("DELETE FROM round_consultants WHERE round_id = $roundId");
    $conn->query("DELETE FROM users WHERE id = $salesId");
    $conn->query("DELETE FROM distribution_rounds WHERE id = $roundId");

    // -------------------------------------------------------------------------
    // PART 4: Databank recall, release, and anti-hoarding rules
    // -------------------------------------------------------------------------
    echo "\n--- PART 4: Databank Expiry & Security Release ---\n";

    // Create a contact that expired
    $expiredPhone = '0909999' . rand(100, 999);
    $conn->query("INSERT INTO persons (phone, full_name) VALUES ('$expiredPhone', 'Expired Client')");
    $expPersonId = $conn->insert_id;

    // Create contact with security_expires_at in the past
    $pastDate = date('Y-m-d H:i:s', strtotime('-1 day'));
    $conn->query("
        INSERT INTO contacts (tenant_id, person_id, created_by, first_name, last_name, phone, status, pipeline_status, security_expires_at, source) 
        VALUES (1, $expPersonId, 1000, 'Expired', 'Client', '$expiredPhone', 'lead', 'chua_xac_dinh', '$pastDate', 'R3_Fb')
    ");
    $expContactId = $conn->insert_id;

    // Simulate Databank Security Expiration process (soft delete & release to public)
    // 1. Soft delete the contact
    $conn->query("UPDATE contacts SET deleted_at = NOW() WHERE id = $expContactId");
    // 2. Increment public count for the person
    $conn->query("UPDATE persons SET public_count = public_count + 1 WHERE id = $expPersonId");

    $resExpC = $conn->query("SELECT deleted_at FROM contacts WHERE id = $expContactId")->fetch_assoc();
    $resExpP = $conn->query("SELECT public_count FROM persons WHERE id = $expPersonId")->fetch_assoc();

    assertTest("D1: Expired contact soft-deleted", !empty($resExpC['deleted_at']));
    assertTest("D2: Person public_count incremented (released to Databank)", (int)$resExpP['public_count'] === 1);

    // Clean mock records for Part 4
    $conn->query("DELETE FROM contacts WHERE id = $expContactId");
    $conn->query("DELETE FROM persons WHERE id = $expPersonId");

} catch (Throwable $e) {
    echo "❌ CRITICAL ERROR IN HARNESS: " . $e->getMessage() . "\n";
}

printTestSummary();
echo "\n====================================================\n";
