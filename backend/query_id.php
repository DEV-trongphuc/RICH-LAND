<?php
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/db_connect.php';

$id = 14093;

echo "=== KIỂM TRA BẢNG LEADS BẰNG ID = $id ===\n";
$stmt = $conn->prepare("SELECT id, name, assigned_to FROM leads WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
if ($row) {
    echo "TÌM THẤY TRONG LEADS:\n";
    print_r($row);
} else {
    echo "KHÔNG TÌM THẤY TRONG LEADS\n";
}

echo "\n=== KIỂM TRA BẢNG DISTRIBUTION_LOGS BẰNG ID = $id ===\n";
$stmt = $conn->prepare("SELECT id, lead_id, assigned_to, status, message, received_at FROM distribution_logs WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
if ($row) {
    echo "TÌM THẤY TRONG DISTRIBUTION_LOGS:\n";
    print_r($row);
    
    // Query actual lead detail using the lead_id from the log
    $leadId = $row['lead_id'];
    echo "\n=> Lead tương ứng (ID = $leadId):\n";
    $stmtLead = $conn->prepare("SELECT id, name, assigned_to, zalo_notify_status, email_notify_status FROM leads WHERE id = ?");
    $stmtLead->bind_param("i", $leadId);
    $stmtLead->execute();
    $leadRow = $stmtLead->get_result()->fetch_assoc();
    $stmtLead->close();
    print_r($leadRow);
} else {
    echo "KHÔNG TÌM THẤY TRONG DISTRIBUTION_LOGS\n";
}
?>
