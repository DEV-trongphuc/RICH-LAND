<?php
require_once __DIR__ . '/db_connect.php';
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

$phone = '0907474739';
$leadId = 30218;

echo "=== LEAD INFO (from phone: $phone or ID: $leadId) ===\n";
$stmt = $conn->prepare("SELECT id, name, phone, email, status, assigned_to, connection_id, created_at, last_interaction_date, ai_screener_status, ai_evaluation, target_round_id FROM leads WHERE id = ? OR phone = ?");
$stmt->bind_param("is", $leadId, $phone);
$stmt->execute();
$res = $stmt->get_result();

$realLeadId = null;
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        $realLeadId = $row['id'];
        echo "ID: #{$row['id']}\n";
        echo "Name: {$row['name']}\n";
        echo "Phone: {$row['phone']}\n";
        echo "Email: {$row['email']}\n";
        echo "Status: {$row['status']}\n";
        echo "Assigned To (ID): " . ($row['assigned_to'] ?? 'NULL') . "\n";
        echo "Connection ID: " . ($row['connection_id'] ?? 'NULL') . "\n";
        echo "Created At (GMT+7 DB): {$row['created_at']}\n";
        echo "Last Interaction Date: {$row['last_interaction_date']}\n";
        echo "AI Screener Status: {$row['ai_screener_status']}\n";
        echo "AI Evaluation: {$row['ai_evaluation']}\n";
        echo "Target Round ID: " . ($row['target_round_id'] ?? 'NULL') . "\n";
        echo "----------------------------------------\n";
    }
} else {
    echo "Lead not found in database.\n";
}
$stmt->close();

if ($realLeadId) {
    echo "\n=== DISTRIBUTION LOGS FOR LEAD #$realLeadId ===\n";
    $stmtLogs = $conn->prepare("SELECT dl.id, dl.assigned_to, c.name as sale_name, r.round_name, dl.status, dl.message, dl.received_at FROM distribution_logs dl LEFT JOIN consultants c ON dl.assigned_to = c.id LEFT JOIN distribution_rounds r ON dl.round_id = r.id WHERE dl.lead_id = ? ORDER BY dl.id ASC");
    $stmtLogs->bind_param("i", $realLeadId);
    $stmtLogs->execute();
    $resLogs = $stmtLogs->get_result();
    if ($resLogs && $resLogs->num_rows > 0) {
        while ($log = $resLogs->fetch_assoc()) {
            echo "Log ID: #{$log['id']}\n";
            echo "Received At (GMT+7 DB): {$log['received_at']}\n";
            echo "Status: {$log['status']}\n";
            echo "Round: {$log['round_name']}\n";
            echo "Assigned Sale: " . ($log['sale_name'] ?? 'NULL') . " (ID: " . ($log['assigned_to'] ?? 'NULL') . ")\n";
            echo "Message:\n" . $log['message'] . "\n";
            echo "========================================\n";
        }
    } else {
        echo "No distribution logs found for this lead.\n";
    }
    $stmtLogs->close();

    echo "\n=== MAIL QUEUE FOR LEAD EMAIL ===\n";
    // Look up email logs from mail_queue
    $stmtMail = $conn->prepare("SELECT id, to_email, subject, status, created_at, sent_at, attempts, last_error FROM mail_queue WHERE body_html LIKE ? ORDER BY id ASC");
    $searchPattern = "%" . $realLeadId . "%";
    $stmtMail->bind_param("s", $searchPattern);
    $stmtMail->execute();
    $resMail = $stmtMail->get_result();
    if ($resMail && $resMail->num_rows > 0) {
        while ($mail = $resMail->fetch_assoc()) {
            echo "Mail ID: #{$mail['id']}\n";
            echo "To: {$mail['to_email']}\n";
            echo "Subject: {$mail['subject']}\n";
            echo "Status: {$mail['status']}\n";
            echo "Created At (GMT+7 DB): {$mail['created_at']}\n";
            echo "Sent At (GMT+7 DB): " . ($mail['sent_at'] ?? 'NULL') . "\n";
            echo "Attempts: {$mail['attempts']}\n";
            echo "Last Error: " . ($mail['last_error'] ?? 'None') . "\n";
            echo "========================================\n";
        }
    } else {
        echo "No mail queue records found referring to lead ID #$realLeadId.\n";
    }
    $stmtMail->close();
}
?>
