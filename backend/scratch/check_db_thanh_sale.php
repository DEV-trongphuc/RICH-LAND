<?php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: text/plain; charset=utf-8');

echo "--- CHECKING USERS ---\n";
$resUser = $conn->query("SELECT id, username, role FROM users WHERE id = 2713 OR username LIKE '%Thanh%'");
while ($row = $resUser->fetch_assoc()) {
    print_r($row);
}

echo "\n--- CHECKING CONSULTANTS ---\n";
$resConsultant = $conn->query("SELECT id, name FROM consultants WHERE id = 2713 OR name LIKE '%Thanh%'");
while ($row = $resConsultant->fetch_assoc()) {
    print_r($row);
}

// Get the consultant ID of Thanh Sale
$resConsultantId = $conn->query("SELECT id FROM consultants WHERE id = 2713");
$cId = null;
if ($row = $resConsultantId->fetch_assoc()) {
    $cId = $row['id'];
}
echo "\nConsultant ID for Thanh Sale (id 2713): " . ($cId ?? 'NULL') . "\n";

if ($cId) {
    echo "\n--- CHECKING DISTRIBUTION LOGS FOR CONSULTANT $cId ---\n";
    $resLogs = $conn->query("
        SELECT dl.id as log_id, dl.received_at, dl.status, dl.lead_id, l.name, l.phone, l.is_accepted, l.accepted_at 
        FROM distribution_logs dl
        JOIN leads l ON dl.lead_id = l.id
        WHERE dl.assigned_to = $cId
        ORDER BY dl.received_at DESC
        LIMIT 10
    ");
    while ($row = $resLogs->fetch_assoc()) {
        print_r($row);
    }
}
