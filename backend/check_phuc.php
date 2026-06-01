<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$leadId = 4606;

echo "=== LEAD DETAILS ===\n";
$stmt = $conn->prepare("SELECT id, name, phone, email, assigned_to, status, last_interaction_date, created_at, connection_id FROM leads WHERE id = ?");
$stmt->bind_param("i", $leadId);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
$stmt->close();

echo "\n=== CONNECTION 1 DETAILS ===\n";
$res = $conn->query("SELECT * FROM sheet_connections WHERE id = 1");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "\n=== ADMIN LOGS FOR LEAD ===\n";
$stmt = $conn->prepare("SELECT * FROM admin_logs WHERE details LIKE ? ORDER BY id DESC");
$likePattern = "%" . $leadId . "%";
$stmt->bind_param("s", $likePattern);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
$stmt->close();

echo "\n=== DISTRIBUTION LOGS ===\n";
$stmt = $conn->prepare("SELECT dl.*, c.name as consultant_name FROM distribution_logs dl LEFT JOIN consultants c ON dl.assigned_to = c.id WHERE dl.lead_id = ? ORDER BY dl.id DESC");
$stmt->bind_param("i", $leadId);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
$stmt->close();
?>


