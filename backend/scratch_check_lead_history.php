<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$leadId = 4648;
$phone = '0374457611';

echo "=== LEAD NOTE AND FULL DETAILS ===\n";
$stmt = $conn->prepare("SELECT * FROM leads WHERE id = ?");
$stmt->bind_param("i", $leadId);
$stmt->execute();
$lead = $stmt->get_result()->fetch_assoc();
print_r($lead);
$stmt->close();
echo "\n";

echo "=== ADMIN LOGS FOR LEAD OR PHONE ===\n";
$searchPattern1 = "%" . $leadId . "%";
$searchPattern2 = "%" . $phone . "%";
$stmtAdmin = $conn->prepare("SELECT al.id, al.action, al.details, al.created_at, acc.username 
                             FROM admin_logs al 
                             LEFT JOIN accounts acc ON al.account_id = acc.id 
                             WHERE al.details LIKE ? OR al.details LIKE ? 
                             ORDER BY al.id ASC");
$stmtAdmin->bind_param("ss", $searchPattern1, $searchPattern2);
$stmtAdmin->execute();
$resAdmin = $stmtAdmin->get_result();
if ($resAdmin->num_rows > 0) {
    while ($row = $resAdmin->fetch_assoc()) {
        echo "Log ID: #{$row['id']} | Action: {$row['action']} | User: {$row['username']} | Created At: {$row['created_at']}\n";
        echo "Details: {$row['details']}\n";
        echo "----------------------------------------\n";
    }
} else {
    echo "No admin logs found.\n";
}
$stmtAdmin->close();
echo "\n";

echo "=== CHECK DISTRIBUTION LOGS (RAW COLS) ===\n";
$stmtRawLogs = $conn->prepare("SELECT * FROM distribution_logs WHERE lead_id = ? ORDER BY id ASC");
$stmtRawLogs->bind_param("i", $leadId);
$stmtRawLogs->execute();
$resRaw = $stmtRawLogs->get_result();
while ($row = $resRaw->fetch_assoc()) {
    print_r($row);
    echo "----------------------------------------\n";
}
$stmtRawLogs->close();
?>
