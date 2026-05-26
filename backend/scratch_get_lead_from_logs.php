<?php
// backend/scratch_get_lead_from_logs.php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$logIds = [30167, 30163, 30162, 4893, 4895, 4918];
echo "=== MAPPING UI IDs (LOG IDs) TO LEAD IDs ===\n\n";

foreach ($logIds as $logId) {
    $stmt = $conn->prepare("
        SELECT dl.id as log_id, dl.lead_id, dl.status as log_status, dl.received_at,
               l.name as lead_name, l.phone as lead_phone, l.source as lead_source
        FROM distribution_logs dl
        LEFT JOIN leads l ON dl.lead_id = l.id
        WHERE dl.id = ?
    ");
    $stmt->bind_param("i", $logId);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        echo "UI ID (Log ID): #{$row['log_id']}\n";
        echo "  - Actual Lead ID: #{$row['lead_id']}\n";
        echo "  - Lead Name: {$row['lead_name']}\n";
        echo "  - Lead Phone: {$row['lead_phone']}\n";
        echo "  - Current Source in DB: '{$row['lead_source']}'\n";
        echo "  - Log Status: {$row['log_status']} | Received: {$row['received_at']}\n";
    } else {
        echo "UI ID (Log ID): #$logId | NOT FOUND IN distribution_logs TABLE\n";
    }
    echo "----------------------------------------\n";
    $stmt->close();
}

$conn->close();
?>
