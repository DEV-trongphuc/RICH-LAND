<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=== DIAGNOSTIC REPORT: SILENT SYNC & EXCEL IMPORT DATES ===\n\n";

// 1. Check distribution_logs with status = 'silent'
echo "1. Grouping distribution_logs (status = 'silent') by Date part of received_at:\n";
$q1 = "SELECT DATE(received_at) as log_date, COUNT(*) as cnt 
       FROM distribution_logs 
       WHERE status = 'silent' 
       GROUP BY DATE(received_at) 
       ORDER BY log_date ASC";
$res1 = $conn->query($q1);
if ($res1 && $res1->num_rows > 0) {
    while ($row = $res1->fetch_assoc()) {
        echo "   - Date: " . ($row['log_date'] ?? 'NULL') . " | Count: " . $row['cnt'] . " logs\n";
    }
} else {
    echo "   No silent logs found.\n";
}
echo "\n";

// 2. Check leads with source = 'Excel Import'
echo "2. Grouping leads (source = 'Excel Import') by Date part of created_at:\n";
$q2 = "SELECT DATE(created_at) as created_date, COUNT(*) as cnt 
       FROM leads 
       WHERE source = 'Excel Import' 
       GROUP BY DATE(created_at) 
       ORDER BY created_date ASC";
$res2 = $conn->query($q2);
if ($res2 && $res2->num_rows > 0) {
    while ($row = $res2->fetch_assoc()) {
        echo "   - Date: " . ($row['created_date'] ?? 'NULL') . " | Count: " . $row['cnt'] . " leads\n";
    }
} else {
    echo "   No leads with source = 'Excel Import' found.\n";
}
echo "\n";

// 3. Let's see some sample silent logs from 2026-05-25 to see their lead's last_interaction_date
echo "3. Sample of 10 silent logs from 2026-05-25 and their associated lead dates:\n";
$q3 = "SELECT dl.id as log_id, dl.received_at, dl.lead_id, l.name, l.phone, l.created_at as lead_created_at, l.last_interaction_date, l.source 
       FROM distribution_logs dl
       LEFT JOIN leads l ON dl.lead_id = l.id
       WHERE dl.status = 'silent' AND dl.received_at LIKE '2026-05-25%'
       LIMIT 15";
$res3 = $conn->query($q3);
if ($res3 && $res3->num_rows > 0) {
    echo sprintf("   %-10s | %-19s | %-8s | %-20s | %-19s | %-19s | %-15s\n", 
        "Log ID", "Log Received At", "Lead ID", "Lead Name", "Lead Created At", "Last Interaction", "Source"
    );
    echo str_repeat("-", 125) . "\n";
    while ($row = $res3->fetch_assoc()) {
        echo sprintf("   %-10d | %-19s | %-8d | %-20s | %-19s | %-19s | %-15s\n",
            $row['log_id'],
            $row['received_at'],
            $row['lead_id'],
            mb_substr($row['name'] ?? '', 0, 20),
            $row['lead_created_at'] ?? 'N/A',
            $row['last_interaction_date'] ?? 'N/A',
            $row['source'] ?? 'N/A'
        );
    }
} else {
    echo "   No silent logs found on 2026-05-25.\n";
}
echo "\n";

// 4. Summarize count of leads with last_interaction_date = '2026-05-25' or containing '2026-05-25'
echo "4. Distribution of last_interaction_date in leads table (top 15 dates):\n";
$q4 = "SELECT DATE(last_interaction_date) as inter_date, COUNT(*) as cnt 
       FROM leads 
       GROUP BY DATE(last_interaction_date) 
       ORDER BY cnt DESC 
       LIMIT 15";
$res4 = $conn->query($q4);
if ($res4 && $res4->num_rows > 0) {
    while ($row = $res4->fetch_assoc()) {
        echo "   - Date: " . ($row['inter_date'] ?? 'NULL') . " | Count: " . $row['cnt'] . " leads\n";
    }
}
echo "\n";
?>
