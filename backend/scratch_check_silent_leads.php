<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== CHECKING SILENT LEADS AND THEIR ASSIGNED_TO IN LEADS TABLE ===\n";

// Query leads that have silent sync entries in distribution_logs
$sql = "SELECT dl.lead_id, dl.assigned_to as log_assigned_to, dl.message, l.assigned_to as lead_assigned_to, l.name, l.phone, l.email, l.created_at
        FROM distribution_logs dl
        JOIN leads l ON dl.lead_id = l.id
        WHERE dl.status = 'silent'
        ORDER BY dl.id DESC
        LIMIT 20";

$res = $conn->query($sql);
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo "Lead ID: #{$row['lead_id']} | Created At: {$row['created_at']}\n";
        echo "  - Log Assigned To (Sale): {$row['log_assigned_to']}\n";
        echo "  - Lead Table Assigned To: " . ($row['lead_assigned_to'] ?? 'NULL') . "\n";
        echo "  - Message: {$row['message']}\n";
        echo "----------------------------------------\n";
    }
} else {
    echo "No silent leads found.\n";
}
?>
