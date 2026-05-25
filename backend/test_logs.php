<?php
header("Content-Type: application/json; charset=utf-8");
require_once __DIR__ . '/db_connect.php';

$res = $conn->query("
    SELECT 
        dl.id, 
        l.name as lead_name, 
        l.phone, 
        l.email, 
        l.source, 
        l.type,
        l.note,
        dl.status, 
        c.name as assigned_to_name, 
        c.avatar as assigned_to_avatar, 
        dr.round_name, 
        dl.received_at as created_at,
        (SELECT MAX(received_at) FROM distribution_logs WHERE lead_id = dl.lead_id AND id < dl.id) as last_activity_at
    FROM distribution_logs dl
    LEFT JOIN leads l ON dl.lead_id = l.id
    LEFT JOIN consultants c ON dl.assigned_to = c.id
    LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
    WHERE dl.id = 30151
");

$row = $res ? $res->fetch_assoc() : null;

echo json_encode([
    'success' => true,
    'row' => $row
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
