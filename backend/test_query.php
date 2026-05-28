<?php
// backend/test_query.php
if (php_sapi_name() !== 'cli') {
    die("This script can only be run via CLI.\n");
}

require_once __DIR__ . '/db_connect.php';

// Clean up any old test leads
$conn->query("DELETE FROM leads WHERE phone = '0999999999'");

echo "1. Inserting mock lead (newly created, waiting for AI)...\n";
$stmt = $conn->prepare("INSERT INTO leads (name, phone, email, source, status, ai_screener_status, created_at) VALUES ('Test AI Pending', '0999999999', 'test_pending@example.com', 'Test Sync', 'pending_approval', 'pending', NOW())");
$stmt->execute();
$leadId = $stmt->insert_id;
$stmt->close();
echo "Inserted lead ID: $leadId\n";

// Query counts using countsSql logic
function printCounts($conn) {
    $countsSql = "
        SELECT 
            SUM(CASE WHEN l.status = 'pending_approval' AND NOT ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ) THEN 1 ELSE 0 END) as queue_cnt,
            SUM(CASE WHEN l.status = 'pending_approval' AND ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ) THEN 1 ELSE 0 END) as ai_pending_cnt
        FROM leads l
    ";
    $res = $conn->query($countsSql);
    $row = $res->fetch_assoc();
    echo "Counts -> Queue: " . $row['queue_cnt'] . " | AI Pending: " . $row['ai_pending_cnt'] . "\n";
}

printCounts($conn);

echo "\n2. Updating mock lead to be created 6 minutes ago (timeout)...\n";
$conn->query("UPDATE leads SET created_at = DATE_SUB(NOW(), INTERVAL 6 MINUTE) WHERE id = $leadId");

printCounts($conn);

echo "\n3. Cleaning up mock lead...\n";
$conn->query("DELETE FROM leads WHERE id = $leadId");
echo "Done!\n";
?>
