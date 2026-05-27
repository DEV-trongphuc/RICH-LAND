<?php
require_once __DIR__ . '/db_connect.php';

echo "<pre>";
echo "--- ALL LEADS IN ROUND 2 (BBA) ---\n";
$sql = "SELECT dl.lead_id, l.name, l.phone, l.source, c.name as consultant, c.status as consultant_status, dl.status, dl.received_at
        FROM distribution_logs dl
        JOIN leads l ON dl.lead_id = l.id
        JOIN consultants c ON dl.assigned_to = c.id
        WHERE dl.round_id = 2 AND dl.status != 'silent'
        ORDER BY dl.received_at DESC";
$res = $conn->query($sql);
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "No leads found in Round 2.\n";
}
echo "</pre>";
