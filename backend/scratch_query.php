<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== ALL ACTIVE/LEAVE CONSULTANTS ===\n";
$res = $conn->query("SELECT id, name, status FROM consultants");
while ($row = $res->fetch_assoc()) {
    echo "ID: {$row['id']} | Name: {$row['name']} | Status: {$row['status']}\n";
}

echo "\n=== BLACKLIST LOGS FOR NHI (ID: 1003) ===\n";
$resB = $conn->query("SELECT al.id, al.created_at, al.details, a.name as admin_name 
                      FROM admin_logs al 
                      JOIN accounts a ON al.account_id = a.id
                      WHERE al.action = 'BLOCK_LEAD_BLACKLIST'");
while ($row = $resB->fetch_assoc()) {
    echo "Log ID: {$row['id']} | Created: {$row['created_at']} | Admin: {$row['admin_name']} | Details: {$row['details']}\n";
}

echo "\n=== ACTIVE COMPENSATION LOGS ===\n";
$resAc = $conn->query("SELECT acl.id, acl.consultant_id, acl.reason, acl.amount, acl.created_at, a.name as admin_name 
                       FROM active_compensation_logs acl
                       JOIN accounts a ON acl.admin_id = a.id");
while ($row = $resAc->fetch_assoc()) {
    echo "Log ID: {$row['id']} | Consultant: {$row['consultant_id']} | Reason: {$row['reason']} | Amount: {$row['amount']} | Created: {$row['created_at']} | Admin: {$row['admin_name']}\n";
}

echo "\n=== COMPENSATION LEADS ASSIGNED ===\n";
$resComp = $conn->query("SELECT dl.id, dl.lead_id, dl.assigned_to, dl.received_at, l.name as lead_name 
                         FROM distribution_logs dl 
                         LEFT JOIN leads l ON dl.lead_id = l.id
                         WHERE dl.status = 'compensation' 
                         ORDER BY dl.received_at DESC LIMIT 20");
while ($row = $resComp->fetch_assoc()) {
    echo "Log ID: {$row['id']} | Lead: {$row['lead_name']} (ID: {$row['lead_id']}) | Assigned To: {$row['assigned_to']} | Received At: {$row['received_at']}\n";
}
?>
