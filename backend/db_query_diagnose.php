<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$logIds = [30304, 30306];
foreach ($logIds as $logId) {
    echo "=== LOG ID: $logId ===\n";
    // 1. Fetch distribution log
    $logRes = $conn->query("SELECT * FROM distribution_logs WHERE id = $logId");
    if ($logRes && $logRow = $logRes->fetch_assoc()) {
        echo "Found Distribution Log:\n";
        print_r($logRow);
        
        $leadId = $logRow['lead_id'];
        echo "Associated Lead ID: $leadId\n";
        
        // 2. Fetch Lead
        $leadRes = $conn->query("SELECT id, name, phone, email, status, assigned_to, last_interaction_date, created_at FROM leads WHERE id = $leadId");
        if ($leadRes && $leadRow = $leadRes->fetch_assoc()) {
            echo "Found Lead Details:\n";
            print_r($leadRow);
        } else {
            echo "Lead ID $leadId not found in leads table!\n";
        }
        
        // 3. Fetch all logs for this lead
        echo "All Distribution Logs for Lead ID $leadId:\n";
        $allLogs = $conn->query("SELECT id, status, received_at, assigned_to, message FROM distribution_logs WHERE lead_id = $leadId ORDER BY id ASC");
        if ($allLogs) {
            while ($l = $allLogs->fetch_assoc()) {
                echo "  Log ID: {$l['id']} | Status: {$l['status']} | Received: {$l['received_at']} | Assigned To: {$l['assigned_to']} | Msg: {$l['message']}\n";
            }
        }
    } else {
        echo "Log ID $logId not found in distribution_logs table!\n";
    }
    echo "\n--------------------------------------------------\n\n";
}
?>
