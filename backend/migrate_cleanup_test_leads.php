<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$confirm = isset($_GET['confirm']) && $_GET['confirm'] === '1';

if ($confirm) {
    echo "=== RUNNING IN CONFIRM MODE: ACTUAL DELETION ===\n\n";
} else {
    echo "=== RUNNING IN PREVIEW MODE: DRY RUN (NO DELETIONS) ===\n";
    echo "To confirm and execute the deletion, please access this page with ?confirm=1\n\n";
}

// 1. Fetch all test leads except "Test nha bà con"
$query = "SELECT id, name, phone, email, source, type, note, created_at 
          FROM leads 
          WHERE (name LIKE '%test%' OR email LIKE '%test%' OR note LIKE '%test%')
            AND name NOT LIKE '%Test nha bà con%'
            AND note NOT LIKE '%Test nha bà con%'";

$res = $conn->query($query);
if (!$res) {
    die("Error fetching test leads: " . $conn->error . "\n");
}

$leadsToDelete = [];
while ($row = $res->fetch_assoc()) {
    $leadsToDelete[] = $row;
}

$totalLeads = count($leadsToDelete);
echo "Found {$totalLeads} test leads to process (excluding 'Test nha bà con').\n\n";

if ($totalLeads === 0) {
    echo "No test data found. Exiting.\n";
    exit();
}

$totalLogsFound = 0;
$totalReportsFound = 0;
$totalQueueFound = 0;

$logsToDelete = [];
$reportsToDelete = [];
$queuesToDelete = [];

foreach ($leadsToDelete as $lead) {
    $leadId = (int)$lead['id'];
    echo "----------------------------------------\n";
    echo "Lead ID #{$leadId}:\n";
    echo "  - Name: {$lead['name']}\n";
    echo "  - Phone: {$lead['phone']}\n";
    echo "  - Email: {$lead['email']}\n";
    echo "  - Note: " . str_replace("\n", " ", substr($lead['note'], 0, 100)) . "...\n";
    echo "  - Created At: {$lead['created_at']}\n";

    // Related distribution logs
    $resD = $conn->query("SELECT id, status, message, received_at FROM distribution_logs WHERE lead_id = {$leadId}");
    if ($resD && $resD->num_rows > 0) {
        echo "    * Related Distribution Logs:\n";
        while ($log = $resD->fetch_assoc()) {
            echo "      - Log ID {$log['id']}: Status: {$log['status']} | Message: {$log['message']} | Time: {$log['received_at']}\n";
            $totalLogsFound++;
        }
    }
    
    // Related data reports (tickets)
    $resR = $conn->query("SELECT id, status, reason, created_at FROM data_reports WHERE lead_id = {$leadId}");
    if ($resR && $resR->num_rows > 0) {
        echo "    * Related Tickets/Data Reports:\n";
        while ($rep = $resR->fetch_assoc()) {
            echo "      - Ticket ID {$rep['id']}: Status: {$rep['status']} | Reason: {$rep['reason']} | Time: {$rep['created_at']}\n";
            $totalReportsFound++;
        }
    }

    // Related sync queue items
    $resQ = $conn->query("SELECT id, status, attempts FROM sync_queue WHERE lead_id = {$leadId}");
    if ($resQ && $resQ->num_rows > 0) {
        echo "    * Related Sync Queue Items:\n";
        while ($q = $resQ->fetch_assoc()) {
            echo "      - Queue ID {$q['id']}: Status: {$q['status']} | Attempts: {$q['attempts']}\n";
            $totalQueueFound++;
        }
    }
}

echo "\n========================================\n";
echo "SUMMARY OF DATA TO BE DELETED:\n";
echo "  - Total Leads: {$totalLeads}\n";
echo "  - Total Distribution Logs: {$totalLogsFound}\n";
echo "  - Total Tickets/Data Reports: {$totalReportsFound}\n";
echo "  - Total Sync Queue Items: {$totalQueueFound}\n";
echo "========================================\n\n";

if ($confirm) {
    // Start database transaction for actual deletion
    $conn->begin_transaction();
    try {
        foreach ($leadsToDelete as $lead) {
            $leadId = (int)$lead['id'];
            
            // Delete child tables
            $conn->query("DELETE FROM distribution_logs WHERE lead_id = {$leadId}");
            $conn->query("DELETE FROM data_reports WHERE lead_id = {$leadId}");
            $conn->query("DELETE FROM sync_queue WHERE lead_id = {$leadId}");
            
            // Delete parent lead
            $conn->query("DELETE FROM leads WHERE id = {$leadId}");
        }

        $conn->commit();
        echo "DELETION COMPLETED SUCCESSFULLY! Database updated.\n";
    } catch (Exception $e) {
        $conn->rollback();
        echo "ERROR during deletion: " . $e->getMessage() . "\nDeletion rolled back.\n";
    }
} else {
    echo "PREVIEW COMPLETED. No database changes were made.\n";
    echo "To confirm, please call: https://open.domation.net/sale_data/migrate_cleanup_test_leads.php?confirm=1\n";
}
?>
