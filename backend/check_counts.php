<?php
// backend/check_counts.php
if (php_sapi_name() !== 'cli') {
    header('Content-Type: text/plain; charset=UTF-8');
}

require_once __DIR__ . '/db_connect.php';

// Tự động dọn dẹp các log 'pending_approval' bị thừa của các lead đã được duyệt hoặc từ chối trước đó
$conn->query("
    DELETE dl FROM distribution_logs dl
    INNER JOIN leads l ON dl.lead_id = l.id
    WHERE dl.status = 'pending_approval' AND l.status IN ('active', 'rejected', 'blacklisted')
");
$cleanedRows = $conn->affected_rows;
echo "--- CLEANUP: Da don dep $cleanedRows dong log 'pending_approval' thua ---\n\n";

$dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
$dateConditionLeads = "created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";

echo "=== DIAGNOSTIC DB COUNTS ===\n";

// 1. Total rows in leads table for this month
$res = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE $dateConditionLeads");
echo "1. Total unique leads in leads table (created this month): " . $res->fetch_assoc()['cnt'] . "\n";

// 2. Total rows in distribution_logs for this month
$res = $conn->query("SELECT COUNT(*) as cnt FROM distribution_logs WHERE $dateCondition");
echo "2. Total rows in distribution_logs (received this month): " . $res->fetch_assoc()['cnt'] . "\n";

// 3. Total rows in distribution_logs where status != 'silent'
$res = $conn->query("SELECT COUNT(*) as cnt FROM distribution_logs WHERE $dateCondition AND status != 'silent'");
echo "3. Total rows in distribution_logs (status != 'silent'): " . $res->fetch_assoc()['cnt'] . "\n";

// 4. Total unique lead_id in distribution_logs where status != 'silent'
$res = $conn->query("SELECT COUNT(DISTINCT lead_id) as cnt FROM distribution_logs WHERE $dateCondition AND status != 'silent'");
echo "4. Total unique leads in distribution_logs (status != 'silent'): " . $res->fetch_assoc()['cnt'] . "\n";

// 5. Total unique lead_id with latest log matching date condition and status != 'silent'
$res = $conn->query("
    SELECT COUNT(*) as cnt 
    FROM distribution_logs dl 
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    WHERE dl.received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') 
      AND dl.received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
      AND dl.status != 'silent'
");
echo "5. Total unique leads in data list (get_logs query equivalent): " . $res->fetch_assoc()['cnt'] . "\n";

// 5b. Total unique leads when subquery filters status != 'silent'
$res = $conn->query("
    SELECT COUNT(*) as cnt 
    FROM distribution_logs dl 
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE status != 'silent'
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    WHERE dl.received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') 
      AND dl.received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
");
echo "5b. Total unique leads when subquery filters status != 'silent': " . $res->fetch_assoc()['cnt'] . "\n";

// 6. Breakdown of distribution_logs by status (non-unique)
echo "\n=== status breakdown (all logs): ===\n";
$res = $conn->query("SELECT status, COUNT(*) as cnt FROM distribution_logs WHERE $dateCondition AND status != 'silent' GROUP BY status");
while ($row = $res->fetch_assoc()) {
    echo "  - " . $row['status'] . ": " . $row['cnt'] . "\n";
}

// 7. Breakdown of distribution_logs by latest status of each lead
echo "\n=== status breakdown (unique leads, latest log only): ===\n";
$res = $conn->query("
    SELECT dl.status, COUNT(*) as cnt 
    FROM distribution_logs dl
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    WHERE dl.received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') 
      AND dl.received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
      AND dl.status != 'silent'
    GROUP BY dl.status
");
while ($row = $res->fetch_assoc()) {
    echo "  - " . $row['status'] . ": " . $row['cnt'] . "\n";
}

?>
