<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== SCREENER STATS DEBUG ===\n\n";

// 1. Check Date Range
$dateCondition = "l.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND l.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
echo "Date condition: $dateCondition\n\n";

// 2. Query AI Pre-screener stats (Passed vs Failed)
$aiPassedCount = 0;
$aiFailedCount = 0;
$aiScreenerSql = "SELECT ai_screener_status, COUNT(*) as cnt FROM leads l WHERE $dateCondition AND ai_screener_status IN ('passed', 'failed') GROUP BY ai_screener_status";
$res = $conn->query($aiScreenerSql);
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "ai_screener_status: {$row['ai_screener_status']} => {$row['cnt']}\n";
        if ($row['ai_screener_status'] === 'passed') {
            $aiPassedCount = (int) $row['cnt'];
        } else if ($row['ai_screener_status'] === 'failed') {
            $aiFailedCount = (int) $row['cnt'];
        }
    }
}
echo "Total from leads query: passed = $aiPassedCount, failed = $aiFailedCount\n\n";

// 3. Query all leads having ai_screener_status = 'failed' in this month
echo "=== LEADS WITH ai_screener_status = 'failed' IN THIS MONTH ===\n";
$sqlFailed = "SELECT id, name, status, ai_screener_status, created_at FROM leads l WHERE $dateCondition AND ai_screener_status = 'failed' ORDER BY id ASC";
$resFailed = $conn->query($sqlFailed);
if ($resFailed) {
    while ($row = $resFailed->fetch_assoc()) {
        echo "ID: #{$row['id']} | Name: {$row['name']} | Status: {$row['status']} | Created: {$row['created_at']}\n";
    }
}
echo "\n";

// 4. Query tab counts logic from get_held_leads
$countsSql = "
    SELECT 
        SUM(CASE WHEN l.status = 'pending_approval' AND NOT ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ) THEN 1 ELSE 0 END) as queue_cnt,
        SUM(CASE WHEN l.status = 'pending_approval' AND ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ) THEN 1 ELSE 0 END) as ai_pending_cnt,
        SUM(CASE WHEN l.status IN ('rejected', 'blacklisted') THEN 1 ELSE 0 END) as substandard_cnt,
        SUM(CASE WHEN l.status = 'active' AND (l.ai_screener_status IN ('failed', 'error') OR l.note LIKE '%[Duyệt %') THEN 1 ELSE 0 END) as assigned_cnt
    FROM leads l
    WHERE $dateCondition
";
$resCounts = $conn->query($countsSql);
if ($resCounts) {
    $c = $resCounts->fetch_assoc();
    echo "=== TAB COUNTS FROM get_held_leads IN THIS MONTH ===\n";
    echo "Hàng chờ duyệt (queue_cnt): {$c['queue_cnt']}\n";
    echo "Chờ AI đánh giá (ai_pending_cnt): {$c['ai_pending_cnt']}\n";
    echo "Dưới chuẩn (substandard_cnt): {$c['substandard_cnt']}\n";
    echo "Giao lead (assigned_cnt): {$c['assigned_cnt']}\n";
}
echo "\n";

// 5. Query leads categorized as status IN ('rejected', 'blacklisted') in this month
echo "=== LEADS IN 'DƯỚI CHUẨN' TAB IN THIS MONTH ===\n";
$sqlSub = "SELECT id, name, status, ai_screener_status, created_at FROM leads l WHERE $dateCondition AND l.status IN ('rejected', 'blacklisted') ORDER BY id ASC";
$resSub = $conn->query($sqlSub);
if ($resSub) {
    while ($row = $resSub->fetch_assoc()) {
        echo "ID: #{$row['id']} | Name: {$row['name']} | Status: {$row['status']} | AI Screener Status: {$row['ai_screener_status']} | Created: {$row['created_at']}\n";
    }
}
echo "\n";

// 6. Query leads in 'Hàng chờ duyệt' tab in this month
echo "=== LEADS IN 'HÀNG CHỜ DUYỆT' TAB IN THIS MONTH ===\n";
$sqlQueue = "SELECT id, name, status, ai_screener_status, created_at FROM leads l WHERE $dateCondition AND l.status = 'pending_approval' AND NOT ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ) ORDER BY id ASC";
$resQueue = $conn->query($sqlQueue);
if ($resQueue) {
    while ($row = $resQueue->fetch_assoc()) {
        echo "ID: #{$row['id']} | Name: {$row['name']} | Status: {$row['status']} | AI Screener Status: {$row['ai_screener_status']} | Created: {$row['created_at']}\n";
    }
}
?>
