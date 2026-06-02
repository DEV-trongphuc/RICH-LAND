<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$phone = '0937242408';
$email = 'nguyenlengoclan08@gmail.com';

$res = $conn->query("SELECT * FROM leads WHERE phone = '$phone' OR email = '$email'");
$leads = [];
while ($row = $res->fetch_assoc()) {
    $leadId = $row['id'];
    
    // Get distribution logs
    $distRes = $conn->query("SELECT dl.*, c.name as consultant_name FROM distribution_logs dl LEFT JOIN consultants c ON dl.assigned_to = c.id WHERE dl.lead_id = $leadId ORDER BY dl.id DESC");
    $distLogs = [];
    while ($dRow = $distRes->fetch_assoc()) {
        $distLogs[] = $dRow;
    }
    
    // Get communication logs
    $commRes = $conn->query("SELECT * FROM communication_logs WHERE lead_id = $leadId ORDER BY id DESC");
    $commLogs = [];
    while ($cRow = $commRes->fetch_assoc()) {
        $commLogs[] = $cRow;
    }

    $row['distribution_logs'] = $distLogs;
    $row['communication_logs'] = $commLogs;
    $leads[] = $row;
}

echo json_encode($leads, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
