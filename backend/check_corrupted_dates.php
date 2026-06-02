<?php
require_once __DIR__ . '/db_connect.php';

// Count how many leads have last_interaction_date = '2026-05-25 08:47:39'
$dateToCheck = '2026-05-25 08:47:39';
$stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM leads WHERE last_interaction_date = ?");
$stmt->bind_param("s", $dateToCheck);
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();
$count = $res['cnt'];
echo "Number of leads with corrupted date '$dateToCheck': $count\n\n";

if ($count > 0) {
    // Let's sample some of them to see if they have non-silent distribution logs
    $sampleStmt = $conn->prepare("SELECT id, name, phone, email, last_interaction_date FROM leads WHERE last_interaction_date = ? LIMIT 5");
    $sampleStmt->bind_param("s", $dateToCheck);
    $sampleStmt->execute();
    $sampleRes = $sampleStmt->get_result();
    while ($lead = $sampleRes->fetch_assoc()) {
        echo "Lead ID: {$lead['id']}, Name: {$lead['name']}, Phone: {$lead['phone']}\n";
        // Query last non-silent log
        $logStmt = $conn->prepare("SELECT received_at, status, message FROM distribution_logs WHERE lead_id = ? AND status != 'silent' ORDER BY id DESC LIMIT 1");
        $logStmt->bind_param("i", $lead['id']);
        $logStmt->execute();
        $logRes = $logStmt->get_result();
        if ($logRes && $logRow = $logRes->fetch_assoc()) {
            echo "  -> Found actual last log: received_at = {$logRow['received_at']}, status = {$logRow['status']}, message = {$logRow['message']}\n";
        } else {
            echo "  -> No non-silent log found.\n";
        }
        echo "\n";
    }
}
?>
