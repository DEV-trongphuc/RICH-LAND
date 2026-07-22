<?php
// backend/audit_pending_work_hours_issue.php
// Diagnostic audit for pending_work_hours lead assignment issue

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 AUDIT KIEM TRA DU LIEU LEADS 'CHO GIO LAM' (21:36)\n";
echo "====================================================\n\n";

// 1. Query the 5 recent leads
$res = $conn->query("
    SELECT l.id, l.name, l.phone, l.assigned_to, l.status, l.created_at, l.last_interaction_date, c.name as consultant_name
    FROM leads l
    LEFT JOIN consultants c ON l.assigned_to = c.id
    ORDER BY l.id DESC LIMIT 5
");

echo "--- 1. DANH SACH 5 LEADS MOI NHAT TRONG CSDL ---\n";
while ($row = $res->fetch_assoc()) {
    echo "ID: {$row['id']} | Name: {$row['name']} | Status: {$row['status']} | AssignedTo: {$row['assigned_to']} ({$row['consultant_name']}) | Created: {$row['created_at']}\n";
}

// 2. Query distribution_logs for these leads
echo "\n--- 2. DISTRIBUTION LOGS CHO CAC LEADS NAY ---\n";
$dlRes = $conn->query("
    SELECT dl.id, dl.lead_id, dl.assigned_to, dl.round_id, dl.status, dl.message, dl.received_at, c.name as consultant_name
    FROM distribution_logs dl
    LEFT JOIN consultants c ON dl.assigned_to = c.id
    ORDER BY dl.id DESC LIMIT 10
");

while ($row = $dlRes->fetch_assoc()) {
    echo "LogID: {$row['id']} | LeadID: {$row['lead_id']} | AssignedTo: {$row['assigned_to']} ({$row['consultant_name']}) | Status: {$row['status']} | Msg: {$row['message']} | Time: {$row['received_at']}\n";
}
