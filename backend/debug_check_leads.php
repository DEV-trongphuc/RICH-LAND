<?php
// backend/debug_check_leads.php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "--- MOST RECENT 15 LEADS ---\n";
$sql = "SELECT id, phone, email, name, status, assigned_to, connection_id, created_at, last_interaction_date, ai_screener_status, ai_evaluation 
        FROM leads 
        ORDER BY id DESC LIMIT 15";
$res = $conn->query($sql);
if ($res) {
    while ($row = $res->fetch_assoc()) {
        print_r($row);
        echo "\n--------------------------------------------\n";
    }
} else {
    echo "Query failed: " . $conn->error . "\n";
}

echo "\n--- DISTRIBUTION LOGS FOR RECENT LEADS ---\n";
$sql = "SELECT dl.id, dl.lead_id, dl.assigned_to, dl.round_id, dl.status, dl.message, dl.received_at 
        FROM distribution_logs dl 
        ORDER BY dl.id DESC LIMIT 15";
$res = $conn->query($sql);
if ($res) {
    while ($row = $res->fetch_assoc()) {
        print_r($row);
        echo "\n--------------------------------------------\n";
    }
}
?>
