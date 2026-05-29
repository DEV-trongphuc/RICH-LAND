<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== SYSTEM TIMING INFO ===\n";
echo "PHP Timezone: " . date_default_timezone_get() . "\n";
echo "PHP Current Time: " . date("Y-m-d H:i:s") . "\n";

$dbTzQuery = $conn->query("SELECT @@session.time_zone as sess_tz, @@global.time_zone as glob_tz, NOW() as db_now");
if ($dbTzQuery) {
    $dbTz = $dbTzQuery->fetch_assoc();
    echo "DB Session Timezone: " . $dbTz['sess_tz'] . "\n";
    echo "DB Global Timezone: " . $dbTz['glob_tz'] . "\n";
    echo "DB NOW(): " . $dbTz['db_now'] . "\n";
}
echo "\n";

$phone = '0374457611';
$email = 'manle14dtp03@gmail.com';

echo "=== SYSTEM SETTINGS ===\n";
$settings = ['reassign_if_owner_inactive', 'duplicate_check_months'];
foreach ($settings as $key) {
    $val = get_system_setting($conn, $key);
    echo "$key: " . ($val === '' ? '(empty string - defaults used)' : $val) . "\n";
}
echo "\n";

echo "=== CONSULTANT 1002 (Nguyễn Thị Linh Đan) ===\n";
$stmtC1 = $conn->prepare("SELECT * FROM consultants WHERE id = 1002");
$stmtC1->execute();
$c1 = $stmtC1->get_result()->fetch_assoc();
if ($c1) {
    print_r($c1);
} else {
    echo "Consultant 1002 not found.\n";
}
$stmtC1->close();
echo "\n";

echo "=== CONSULTANT 1004 (Nguyễn Phương Uyên) ===\n";
$stmtC2 = $conn->prepare("SELECT * FROM consultants WHERE id = 1004");
$stmtC2->execute();
$c2 = $stmtC2->get_result()->fetch_assoc();
if ($c2) {
    print_r($c2);
} else {
    echo "Consultant 1004 not found.\n";
}
$stmtC2->close();
echo "\n";

echo "=== ALL LEADS WITH SAME PHONE OR EMAIL ===\n";
$stmtL = $conn->prepare("SELECT id, name, phone, email, status, assigned_to, connection_id, created_at, last_interaction_date, ai_screener_status, ai_evaluation, target_round_id, zalo_notify_status, email_notify_status FROM leads WHERE phone = ? OR email = ?");
$stmtL->bind_param("ss", $phone, $email);
$stmtL->execute();
$resL = $stmtL->get_result();
while ($row = $resL->fetch_assoc()) {
    echo "ID: #{$row['id']}\n";
    echo "Name: {$row['name']}\n";
    echo "Phone: {$row['phone']}\n";
    echo "Email: {$row['email']}\n";
    echo "Status: {$row['status']}\n";
    echo "Assigned To (ID): " . ($row['assigned_to'] ?? 'NULL') . "\n";
    echo "Connection ID: " . ($row['connection_id'] ?? 'NULL') . "\n";
    echo "Created At: {$row['created_at']}\n";
    echo "Last Interaction Date: {$row['last_interaction_date']}\n";
    echo "AI Screener Status: {$row['ai_screener_status']}\n";
    echo "AI Evaluation: {$row['ai_evaluation']}\n";
    echo "Target Round ID: " . ($row['target_round_id'] ?? 'NULL') . "\n";
    echo "Zalo Notify Status: {$row['zalo_notify_status']}\n";
    echo "Email Notify Status: {$row['email_notify_status']}\n";
    echo "----------------------------------------\n";
}
$stmtL->close();
echo "\n";

echo "=== CRM INTERACTION CHECK RESULT ===\n";
$crmCheck = checkCRMInteraction($conn, $phone, $email);
print_r($crmCheck);
echo "\n";

echo "=== DISTRIBUTION LOGS FOR LEAD #4648 ===\n";
$stmtLogs = $conn->prepare("SELECT dl.id, dl.assigned_to, c.name as sale_name, r.round_name, dl.status, dl.message, dl.received_at FROM distribution_logs dl LEFT JOIN consultants c ON dl.assigned_to = c.id LEFT JOIN distribution_rounds r ON dl.round_id = r.id WHERE dl.lead_id = 4648 ORDER BY dl.id ASC");
$stmtLogs->execute();
$resLogs = $stmtLogs->get_result();
while ($log = $resLogs->fetch_assoc()) {
    echo "Log ID: #{$log['id']}\n";
    echo "Received At: {$log['received_at']}\n";
    echo "Status: {$log['status']}\n";
    echo "Round: {$log['round_name']}\n";
    echo "Assigned Sale: " . ($log['sale_name'] ?? 'NULL') . " (ID: " . ($log['assigned_to'] ?? 'NULL') . ")\n";
    echo "Message: {$log['message']}\n";
    echo "========================================\n";
}
$stmtLogs->close();
?>
