<?php
require_once __DIR__ . '/../backend/db_connect.php';

echo "=== DIAGNOSE RECENT LEADS & DISTRIBUTION LOGS ===\n";

// 1. Find the lead matching the screenshot
$res = $conn->query("
    SELECT l.id, l.name, l.phone, l.email, l.status, l.assigned_to, l.is_accepted, 
           l.target_round_id, l.last_interaction_date, l.created_at, l.source,
           c.name as assigned_name, dr.round_name, dr.round_type
    FROM leads l
    LEFT JOIN consultants c ON l.assigned_to = c.id
    LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
    WHERE l.last_interaction_date >= '2026-10-15 08:00:00'
    ORDER BY l.last_interaction_date DESC
    LIMIT 5
");

if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "LEAD ID: " . $row['id'] . " | Name: " . $row['name'] . " | Phone: " . $row['phone'] . " | Status: " . $row['status'] . " | is_accepted: " . $row['is_accepted'] . " | assigned_to: " . $row['assigned_to'] . " (" . $row['assigned_name'] . ") | Round: " . $row['target_round_id'] . " (" . $row['round_name'] . " - " . $row['round_type'] . ") | Last Interaction: " . $row['last_interaction_date'] . "\n";
        
        $leadId = $row['id'];
        echo "--- Distribution Logs for Lead $leadId ---\n";
        $logRes = $conn->query("
            SELECT dl.id, dl.assigned_to, c.name as sale_name, dl.status, dl.message, dl.received_at
            FROM distribution_logs dl
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            WHERE dl.lead_id = $leadId
            ORDER BY dl.id DESC
            LIMIT 10
        ");
        if ($logRes) {
            while ($lr = $logRes->fetch_assoc()) {
                echo "  Log #{$lr['id']} | Sale: {$lr['sale_name']} ({$lr['assigned_to']}) | Status: {$lr['status']} | Time: {$lr['received_at']} | Msg: " . str_replace("\n", " ", $lr['message']) . "\n";
            }
        }
    }
} else {
    echo "Query failed: " . $conn->error . "\n";
}
