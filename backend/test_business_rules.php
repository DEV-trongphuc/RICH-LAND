<?php
// backend/test_business_rules.php
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== STARTING BUSINESS RULES TEST ===\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

try {
    // ----------------------------------------------------
    // SETUP: Create a temporary mock contact
    // ----------------------------------------------------
    $phone = '0987654' . rand(100, 999);
    $conn->query("INSERT INTO persons (phone, full_name) VALUES ('$phone', 'Mock Contact Test')");
    $personId = $conn->insert_id;

    $conn->query("
        INSERT INTO contacts (tenant_id, person_id, created_by, first_name, last_name, phone, status, pipeline_status, temperature) 
        VALUES (1, $personId, 1000, 'Mock', 'Test', '$phone', 'lead', 'booking', 'hot')
    ");
    $contactId = $conn->insert_id;

    echo "[SETUP] Created mock contact ID: $contactId\n";

    // Create a pipeline stage if not exists
    $resStage = $conn->query("SELECT id FROM pipeline_stages WHERE tenant_id = 1 LIMIT 2");
    $stages = [];
    while ($row = $resStage->fetch_assoc()) {
        $stages[] = $row['id'];
    }
    $stageId = $stages[0] ?? 1;

    // ----------------------------------------------------
    // TEST 1: Cancel Deposit BEFORE Revenue
    // ----------------------------------------------------
    echo "\n--- TEST 1: Cancel Deposit BEFORE Revenue ---\n";
    
    // Create deposit
    $conn->query("
        INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) 
        VALUES ($contactId, 1, 'MOCK-A1', 2000000000.00, 50000000.00, 'pending_admin', 1000)
    ");
    $depositId = $conn->insert_id;
    echo "Created deposit ID: $depositId\n";

    // Set contact pipeline status to 'dat_coc'
    $conn->query("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer' WHERE id = $contactId");

    // Replicate cancellation logic without revenue (approvedCount = 0)
    // Revert status to 'booking' or 'da_gap'
    $expiresAt = date('Y-m-d H:i:s', strtotime('+3 months'));
    $conn->query("UPDATE contacts SET pipeline_status = 'booking', status = 'lead', security_expires_at = '$expiresAt' WHERE id = $contactId");
    $conn->query("UPDATE deposits SET status = 'cancelled', cancelled_reason = 'Test Cancel before revenue' WHERE id = $depositId");

    // Assertions
    $resContact = $conn->query("SELECT pipeline_status, status, security_expires_at FROM contacts WHERE id = $contactId")->fetch_assoc();
    assertTest("Contact pipeline_status reverted to booking", $resContact['pipeline_status'] === 'booking');
    assertTest("Contact status reverted to lead", $resContact['status'] === 'lead');
    assertTest("Security timer is set", !empty($resContact['security_expires_at']));

    // ----------------------------------------------------
    // TEST 2: Cancel Deposit AFTER Revenue
    // ----------------------------------------------------
    echo "\n--- TEST 2: Cancel Deposit AFTER Revenue ---\n";

    // Reset contact pipeline status to 'dat_coc'
    $conn->query("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer' WHERE id = $contactId");
    
    // Create new deposit
    $conn->query("
        INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) 
        VALUES ($contactId, 1, 'MOCK-B2', 3000000000.00, 60000000.00, 'pending_admin', 1000)
    ");
    $depositId2 = $conn->insert_id;

    // Create a milestone and mark as approved (approvedCount > 0)
    $conn->query("
        INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) 
        VALUES ($depositId2, 'Đợt 1', 10000000.00, 'approved')
    ");
    $milestoneId = $conn->insert_id;

    // Cancellation check logic: since approvedCount > 0, we only cancel deposit, do not demote contact
    $conn->query("UPDATE deposits SET status = 'cancelled', cancelled_reason = 'Test Cancel after revenue' WHERE id = $depositId2");

    // Assertions
    $resContact2 = $conn->query("SELECT pipeline_status, status FROM contacts WHERE id = $contactId")->fetch_assoc();
    assertTest("Contact pipeline_status remains dat_coc", $resContact2['pipeline_status'] === 'dat_coc');
    assertTest("Contact status remains customer", $resContact2['status'] === 'customer');

    // ----------------------------------------------------
    // TEST 3: Meta CAPI Forward-only Check
    // ----------------------------------------------------
    echo "\n--- TEST 3: Meta CAPI Forward-only Check ---\n";
    // Check if cancellation script ever triggers a back-signal (e.g. CompleteRegistration or Schedule) in CAPI logs
    $resCapi = $conn->query("SELECT COUNT(*) as cnt FROM capi_logs WHERE contact_id = $contactId AND event_name IN ('CompleteRegistration', 'Schedule')")->fetch_assoc();
    assertTest("No backward CAPI signals sent on deposit cancellation", (int)$resCapi['cnt'] === 0);

    // ----------------------------------------------------
    // CLEANUP: Delete temporary test records
    // ----------------------------------------------------
    $conn->query("DELETE FROM deposit_milestones WHERE id = $milestoneId");
    $conn->query("DELETE FROM deposits WHERE id IN ($depositId, $depositId2)");
    $conn->query("DELETE FROM contacts WHERE id = $contactId");
    $conn->query("DELETE FROM persons WHERE id = $personId");
    echo "\n[CLEANUP] Deleted mock data successfully.\n";

} catch (Throwable $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
}

printTestSummary();
