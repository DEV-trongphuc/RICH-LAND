<?php
// backend/scratch_check_production_leads.php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$ids = [30163, 30162, 4893, 4895, 4918];
echo "=== TARGET LEADS SOURCE & SYNC STATUS ===\n\n";

foreach ($ids as $id) {
    // 1. Fetch lead details
    $stmt = $conn->prepare("
        SELECT l.id, l.name, l.phone, l.email, l.source, l.connection_id, l.assigned_to, l.last_interaction_date,
               sc.sheet_name, sc.two_way_sync, sc.google_script_url, sc.is_active as connection_active
        FROM leads l
        LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
        WHERE l.id = ?
    ");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        echo "Lead ID: #{$row['id']}\n";
        echo "  - Name: {$row['name']}\n";
        echo "  - Phone: {$row['phone']}\n";
        echo "  - Source in DB: '{$row['source']}'\n";
        echo "  - Connection ID: {$row['connection_id']} (" . ($row['sheet_name'] ?? 'None') . ")\n";
        echo "  - Connection Active: " . ($row['connection_active'] ?? 'N/A') . "\n";
        echo "  - Two-Way Sync Enabled: " . ($row['two_way_sync'] ?? 'N/A') . "\n";
        echo "  - Google Script URL: " . ($row['google_script_url'] ? 'Yes (configured)' : 'No') . "\n";
        echo "  - Last Interaction Date: {$row['last_interaction_date']}\n";
        
        // 2. Check if this lead is in the sync queue
        $qStmt = $conn->prepare("SELECT status, attempts, next_retry_at, last_error FROM sync_queue WHERE lead_id = ?");
        $qStmt->bind_param("i", $id);
        $qStmt->execute();
        $qRes = $qStmt->get_result();
        if ($qRes && $qRes->num_rows > 0) {
            $qRow = $qRes->fetch_assoc();
            echo "  - Sync Queue Status: '{$qRow['status']}' | Attempts: {$qRow['attempts']} | Next Retry: {$qRow['next_retry_at']}\n";
            if ($qRow['last_error']) {
                echo "    Error: {$qRow['last_error']}\n";
            }
        } else {
            echo "  - Sync Queue Status: NOT IN QUEUE\n";
        }
        $qStmt->close();
        
    } else {
        echo "Lead ID: #$id | NOT FOUND IN DATABASE\n";
    }
    echo "----------------------------------------\n";
    $stmt->close();
}

$conn->close();
?>
