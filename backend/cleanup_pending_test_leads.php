<?php
// backend/cleanup_pending_test_leads.php
// Cleanup pre-assigned test leads in pending_work_hours status

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🧹 CLEANUP PRE-ASSIGNED LEADS IN PENDING_WORK_HOURS STATUS\n";
echo "====================================================\n\n";

// Update leads table to set assigned_to = NULL for pending_work_hours leads
$conn->query("UPDATE leads SET assigned_to = NULL WHERE status = 'pending_work_hours' OR id IN (9, 10, 11, 12, 13)");
$affectedLeads = $conn->affected_rows;
echo "✅ Updated $affectedLeads lead records to set assigned_to = NULL.\n";

// Update distribution_logs table
$conn->query("UPDATE distribution_logs SET assigned_to = NULL WHERE status = 'pending_work_hours' OR lead_id IN (9, 10, 11, 12, 13)");
$affectedLogs = $conn->affected_rows;
echo "✅ Updated $affectedLogs distribution_logs records to set assigned_to = NULL.\n";

echo "\n--- DANH SACH LEADS SAU CLEANUP ---\n";
$res = $conn->query("SELECT id, name, status, assigned_to FROM leads WHERE id IN (9, 10, 11, 12, 13)");
while ($row = $res->fetch_assoc()) {
    echo "ID: {$row['id']} | Name: {$row['name']} | Status: {$row['status']} | AssignedTo: " . var_export($row['assigned_to'], true) . "\n";
}
