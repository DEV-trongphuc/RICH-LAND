<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== CHECKING LEADS WITH UNKNOWN/EMPTY SOURCE ===\n\n";

// Query all leads in database where source is NULL or empty, showing their logs if they were distributed
$sql = "SELECT 
            l.id as lead_id, 
            l.name as lead_name, 
            l.phone as lead_phone, 
            l.email as lead_email, 
            l.created_at as lead_created_at,
            l.connection_id,
            sc.sheet_name as connection_name,
            dl.id as log_id,
            dl.received_at as distributed_at,
            dl.status as distribution_status,
            l.note
        FROM leads l
        LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
        LEFT JOIN distribution_logs dl ON l.id = dl.lead_id
        WHERE l.source IS NULL OR TRIM(l.source) = ''
        ORDER BY l.created_at DESC LIMIT 50";

$res = $conn->query($sql);

if ($res && $res->num_rows > 0) {
    $count = 0;
    while ($row = $res->fetch_assoc()) {
        $count++;
        echo "Lead #{$count}:\n";
        echo "  - Lead ID: {$row['lead_id']}\n";
        echo "  - Name: {$row['lead_name']}\n";
        echo "  - Phone: {$row['lead_phone']}\n";
        echo "  - Email: {$row['lead_email']}\n";
        echo "  - Created At: {$row['lead_created_at']}\n";
        
        if ($row['connection_id']) {
            echo "  - Google Sheet connection: ID {$row['connection_id']} ('{$row['connection_name']}')\n";
            echo "    (Tip: Check if the column mapping for 'Source' in this connection settings is empty or maps to an empty column on the sheet!)\n";
        } else {
            echo "  - Connection: Nhập tay (Manual input) or API webhook (no connection_id)\n";
        }
        
        if ($row['log_id']) {
            echo "  - Distributed via Log ID: {$row['log_id']} at {$row['distributed_at']} (Status: {$row['distribution_status']})\n";
        } else {
            echo "  - Distributed: Not distributed yet (no distribution log found)\n";
        }
        
        echo "  - Note: " . str_replace("\n", " | ", $row['note']) . "\n";
        echo "---------------------------------------------------------\n\n";
    }
} else {
    echo "No leads found with unknown/empty source in the database!\n";
}

?>
