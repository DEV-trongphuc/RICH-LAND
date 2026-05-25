<?php
header("Content-Type: application/json; charset=utf-8");
require_once __DIR__ . '/db_connect.php';

$leadId = 30151;
$resLogs = $conn->query("SELECT * FROM distribution_logs WHERE lead_id = $leadId ORDER BY id DESC");
$logs = [];
while ($row = $resLogs->fetch_assoc()) {
    $logs[] = $row;
}

$resSub = $conn->query("SELECT dl.id, dl.received_at, 
                               (SELECT MAX(received_at) FROM distribution_logs WHERE lead_id = dl.lead_id AND id < dl.id) as last_activity_at
                        FROM distribution_logs dl 
                        WHERE dl.lead_id = $leadId 
                        ORDER BY dl.id DESC");
$subqueryResults = [];
while ($row = $resSub->fetch_assoc()) {
    $subqueryResults[] = $row;
}

echo json_encode([
    'success' => true,
    'logs' => $logs,
    'subquery' => $subqueryResults
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
