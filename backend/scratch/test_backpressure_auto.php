<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../webhook_logic.php';
require_once __DIR__ . '/../cron_sync.php';

header('Content-Type: text/plain; charset=utf-8');

$userId = 1000; // Nguyễn Hải Đăng

echo "--- STARTING END-TO-END AUTO DISTRIBUTION & PENDING TEST ---\n";

try {
    // 1. Get or create a round for user 1000
    // Check if user 1000 has a consultant profile
    $cRes = $conn->query("SELECT id FROM consultants WHERE email = 'dom.marketing.vn@gmail.com' LIMIT 1");
    $cRow = $cRes->fetch_assoc();
    if (!$cRow) {
        throw new Exception("Consultant profile for dom.marketing.vn@gmail.com not found.");
    }
    $consultantId = (int)$cRow['id'];
    echo "Found consultant ID: $consultantId for user ID: $userId\n";

    // Get or create a round
    $roundRes = $conn->query("SELECT id FROM distribution_rounds WHERE is_active = 1 LIMIT 1");
    $roundRow = $roundRes->fetch_assoc();
    if (!$roundRow) {
        $conn->query("INSERT INTO distribution_rounds (round_name, is_active) VALUES ('Mock Test Round', 1)");
        $roundId = $conn->insert_id;
    } else {
        $roundId = (int)$roundRow['id'];
    }
    echo "Using distribution round ID: $roundId\n";

    // Ensure our consultant is assigned to this round and is active
    $conn->query("
        INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, is_active) 
        VALUES ($roundId, $consultantId, 1, 1) 
        ON DUPLICATE KEY UPDATE is_active = 1, receive_ratio = 1
    ");

    // Enable vacation mode = 0 and status = active for the user
    $conn->query("UPDATE users SET vacation_mode = 0, status = 'active' WHERE id = $userId");
    // Ensure there is an approved check-in today to pass Gate 2
    $todayStr = date('Y-m-d');
    $conn->query("
        INSERT INTO check_ins (user_id, check_in_date, status) 
        VALUES ($userId, '$todayStr', 'approved') 
        ON DUPLICATE KEY UPDATE status = 'approved'
    ");

    // Clean up old contacts to start clean
    $conn->query("DELETE FROM contacts WHERE owner_id = $userId");
    echo "Cleaned up old contacts for user.\n";

    // 2. Set backpressure limit to 3
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('backpressure_limit', '3') ON DUPLICATE KEY UPDATE setting_value = '3'");
    echo "Set backpressure_limit to 3.\n";

    // 3. Create 3 mock uncontacted contacts under user 1000
    for ($i = 1; $i <= 3; $i++) {
        $conn->query("
            INSERT INTO contacts (tenant_id, owner_id, first_name, last_name, phone, email, status, pipeline_status) 
            VALUES (1, $userId, 'Mock', 'Auto Contact $i', '093333333$i', 'mockauto$i@test.com', 'lead', 'chua_xac_dinh')
        ");
    }
    echo "Inserted 3 uncontacted contacts for user.\n";

    // 4. Try to get next consultant in round for a new lead
    $leadData = ['name' => 'Auto Test Lead', 'phone' => '0977777777', 'email' => 'autotest@lead.com'];
    echo "Calling getNextConsultantInRound...\n";
    $assignResult = getNextConsultantInRound($conn, $roundId, $leadData);
    
    if ($assignResult === null) {
        echo "SUCCESS: getNextConsultantInRound returned null (All consultants blocked by backpressure limit).\n";
    } else {
        echo "FAILURE: getNextConsultantInRound returned ID: " . $assignResult['id'] . " (Should have been blocked).\n";
    }

    // 5. Insert the lead into the database with assigned_to = NULL and log status = 'pending'
    $conn->query("
        INSERT INTO leads (id, name, phone, email, assigned_to, is_accepted, status)
        VALUES (88888, 'Auto Test Lead', '0977777777', 'autotest@lead.com', NULL, 0, 'active')
        ON DUPLICATE KEY UPDATE assigned_to = NULL, is_accepted = 0
    ");
    $conn->query("
        INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message, received_at)
        VALUES (88888, NULL, $roundId, 'pending', 'Không có Sale hoạt động khác trong vòng hoặc Admin fallback. Lead chuyển về Chờ xử lý.', NOW())
    ");
    echo "Inserted mock pending lead (ID 88888) and logged distribution as 'pending'.\n";

    // 6. Now reduce the uncontacted contacts for user 1000 so they are no longer blocked (e.g. delete 2 contacts)
    $conn->query("DELETE FROM contacts WHERE owner_id = $userId LIMIT 2");
    echo "Removed 2 contacts. Consultant uncontacted count is now below the limit.\n";

    // 7. Run releasePendingWorkHoursLeads cron worker to redistribute
    echo "Calling releasePendingWorkHoursLeads...\n";
    releasePendingWorkHoursLeads($conn);

    // 8. Verify that the lead 88888 has been successfully assigned to user 1000
    $leadRes = $conn->query("SELECT assigned_to FROM leads WHERE id = 88888");
    $leadRow = $leadRes->fetch_assoc();
    if ($leadRow && (int)$leadRow['assigned_to'] === $consultantId) {
        echo "SUCCESS: Lead has been successfully reallocated to consultant $consultantId!\n";
    } else {
        echo "FAILURE: Lead assigned_to is: " . ($leadRow['assigned_to'] ?? 'NULL') . " (Expected $consultantId).\n";
    }

    // 9. Verify that the log status changed to 'assigned' / 'compensation'
    $logRes = $conn->query("SELECT status, message FROM distribution_logs WHERE lead_id = 88888 ORDER BY id DESC LIMIT 1");
    $logRow = $logRes->fetch_assoc();
    if ($logRow) {
        echo "Latest log status: " . $logRow['status'] . "\n";
        echo "Latest log message: " . $logRow['message'] . "\n";
    }

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
} finally {
    // 10. CLEAN UP
    $conn->query("DELETE FROM contacts WHERE owner_id = $userId");
    $conn->query("DELETE FROM leads WHERE id = 88888");
    $conn->query("DELETE FROM distribution_logs WHERE lead_id = 88888");
    $conn->query("UPDATE system_settings SET setting_value = '5' WHERE setting_key = 'backpressure_limit'");
    echo "Cleaned up test environment.\n";
}
