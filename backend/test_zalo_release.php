<?php
// backend/test_zalo_release.php
// Script to test Zalo release grouping logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/cron_sync.php';
require_once __DIR__ . '/zalo_bot.php';

header("Content-Type: text/plain; charset=utf-8");

echo "=== STARTING ZALO RELEASE GROUPING TEST ===\n";

// 1. Create a test consultant
$consultantName = "Test Consultant " . rand(100, 999);
$consultantEmail = "test_sale_" . rand(100, 999) . "@example.com";
$zaloChatId = "123456789"; // Replace with real zalo_chat_id if testing actual Zalo API responses

$sqlConsultant = "INSERT INTO consultants (name, email, status, work_start_time, work_end_time, zalo_chat_id) 
                  VALUES (?, ?, 'active', '00:00', '23:59', ?)";
$stmt = $conn->prepare($sqlConsultant);
$stmt->bind_param("sss", $consultantName, $consultantEmail, $zaloChatId);
$stmt->execute();
$consultantId = $stmt->insert_id;
$stmt->close();

echo "1. Created Test Consultant: $consultantName (ID: $consultantId, Email: $consultantEmail)\n";

// 2. Create 3 test leads
$leads = [
    ['name' => 'Nguyễn Văn A', 'phone' => '0912345678', 'email' => 'a@example.com', 'source' => 'Facebook Ads', 'note' => 'Cần tư vấn khóa học'],
    ['name' => 'Trần Thị B', 'phone' => '0987654321', 'email' => 'b@example.com', 'source' => 'Google Ads', 'note' => 'Đăng ký học thử'],
    ['name' => 'Lê Văn C', 'phone' => '0933334444', 'email' => 'c@example.com', 'source' => 'Tiktok Ads', 'note' => 'Yêu cầu gọi lại']
];

$leadIds = [];
$logIds = [];

foreach ($leads as $i => $l) {
    // Insert lead
    $sqlLead = "INSERT INTO leads (name, phone, email, source, note, assigned_to) VALUES (?, ?, ?, ?, ?, ?)";
    $stmtLead = $conn->prepare($sqlLead);
    $stmtLead->bind_param("sssssi", $l['name'], $l['phone'], $l['email'], $l['source'], $l['note'], $consultantId);
    $stmtLead->execute();
    $leadId = $stmtLead->insert_id;
    $leadIds[] = $leadId;
    $stmtLead->close();
    
    // Insert distribution_log with status 'pending_work_hours'
    // Simulate leads coming in at different times last night
    $hoursAgo = 6 - $i; 
    $receivedAt = date('Y-m-d H:i:s', strtotime("-$hoursAgo hours"));
    
    $sqlLog = "INSERT INTO distribution_logs (lead_id, assigned_to, status, message, received_at) VALUES (?, ?, 'pending_work_hours', 'Chờ ngoài giờ làm việc', ?)";
    $stmtLog = $conn->prepare($sqlLog);
    $stmtLog->bind_param("iis", $leadId, $consultantId, $receivedAt);
    $stmtLog->execute();
    $logId = $stmtLog->insert_id;
    $logIds[] = $logId;
    $stmtLog->close();
    
    echo "   - Created Lead #".($i+1).": {$l['name']} (ID: $leadId, Log ID: $logId, Log time: $receivedAt)\n";
}

echo "2. Inserted 3 test leads & pending distribution logs.\n";
echo "3. Executing releasePendingWorkHoursLeads()...\n";

// Capture output
ob_start();
releasePendingWorkHoursLeads($conn);
$output = ob_get_clean();

echo "--- CRON OUTPUT START ---\n";
echo $output;
echo "--- CRON OUTPUT END ---\n";

// 4. Verification Check
$checkLogs = $conn->query("SELECT id, status, message FROM distribution_logs WHERE id IN (" . implode(',', $logIds) . ")");
$successCount = 0;
if ($checkLogs) {
    while ($row = $checkLogs->fetch_assoc()) {
        echo "Log ID {$row['id']} status after release: {$row['status']}\n";
        if ($row['status'] === 'assigned') {
            $successCount++;
        }
    }
}

if ($successCount === 3) {
    echo "SUCCESS: All 3 leads successfully transitioned to 'assigned' status.\n";
} else {
    echo "WARNING: Only $successCount/3 leads transitioned correctly.\n";
}

// 5. Cleanup
echo "4. Cleaning up test database records...\n";
$conn->query("DELETE FROM distribution_logs WHERE id IN (" . implode(',', $logIds) . ")");
$conn->query("DELETE FROM leads WHERE id IN (" . implode(',', $leadIds) . ")");
$conn->query("DELETE FROM consultants WHERE id = $consultantId");
echo "5. Cleanup complete. Test completed successfully.\n";
?>
