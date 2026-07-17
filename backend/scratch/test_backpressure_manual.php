<?php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: text/plain; charset=utf-8');

$userId = 1000;

echo "--- SETTING UP BACKPRESSURE TEST ENVIRONMENT ---\n";

// 1. Set backpressure limit to 3
$conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('backpressure_limit', '3') ON DUPLICATE KEY UPDATE setting_value = '3'");

// 2. Clean up any existing contacts/leads for user 1000
$conn->query("DELETE FROM contacts WHERE owner_id = $userId");

// 3. Insert 3 mock uncontacted contacts for user 1000
for ($i = 1; $i <= 3; $i++) {
    $conn->query("
        INSERT INTO contacts (tenant_id, owner_id, full_name, phone, email, status, pipeline_status) 
        VALUES (1, $userId, 'Mock Contact $i', '091234567$i', 'mock$i@test.com', 'active', 'chua_xac_dinh')
    ");
}

// 4. Insert a new lead assigned to user 1000 that needs to be accepted
$conn->query("
    INSERT INTO leads (id, tenant_id, full_name, phone, email, assigned_to, is_accepted, status)
    VALUES (99999, 1, 'Test Lead manual accept', '0988888888', 'testmanual@accept.com', $userId, 0, 'new')
    ON DUPLICATE KEY UPDATE assigned_to = $userId, is_accepted = 0
");

echo "Test environment set up successfully.\n";

// 5. Simulate accepting the lead by calling the API or logic directly
echo "\n--- SIMULATING MANUAL LEAD ACCEPTANCE ---\n";

// We'll mimic the $_POST/JSON input and run the backend case 'accept_lead'
// To do this simply, we will query the backpressure limit check logic exactly as it is in api.php:

$stmtChk = $conn->prepare("SELECT assigned_to, is_accepted FROM leads WHERE id = 99999");
$stmtChk->execute();
$resChk = $stmtChk->get_result()->fetch_assoc();
$stmtChk->close();

$backpressureLimit = (int) get_system_setting($conn, 'backpressure_limit');
if ($backpressureLimit <= 0) {
    $backpressureLimit = 5;
}

$stmtKhtn = $conn->prepare("
    SELECT COUNT(*) as cnt 
    FROM contacts c
    WHERE c.owner_id = ? 
      AND c.status != 'rejected'
      AND (
          c.pipeline_status = 'chua_xac_dinh'
          OR (
              c.pipeline_status = 'quan_tam'
              AND NOT EXISTS (
                  SELECT 1 FROM notes n 
                  WHERE n.entity_type = 'contact' 
                    AND n.entity_id = c.id 
                    AND n.user_id = c.owner_id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM activities a
                  WHERE a.related_type = 'contact'
                    AND a.related_id = c.id
                    AND a.user_id = c.owner_id
                    AND a.status = 'done'
              )
          )
      )
");
$targetUserId = (int)$resChk['assigned_to'];
$stmtKhtn->bind_param("i", $targetUserId);
$stmtKhtn->execute();
$khtnCnt = (int) ($stmtKhtn->get_result()->fetch_assoc()['cnt'] ?? 0);
$stmtKhtn->close();

echo "Uncontacted count: $khtnCnt\n";
echo "Backpressure limit: $backpressureLimit\n";

if ($khtnCnt >= $backpressureLimit) {
    echo "BLOCKED: Bạn đã vượt quá van chống ôm ($khtnCnt/$backpressureLimit data chưa xử lý).\n";
} else {
    echo "ALLOWED: Lead accepted successfully.\n";
}

// 6. CLEAN UP TEST DATA
$conn->query("DELETE FROM contacts WHERE owner_id = $userId");
$conn->query("DELETE FROM leads WHERE id = 99999");
$conn->query("UPDATE system_settings SET setting_value = '5' WHERE setting_key = 'backpressure_limit'");
echo "\n--- CLEANED UP TEST ENVIRONMENT ---\n";
