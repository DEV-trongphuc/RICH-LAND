<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

$leadId = 2478;

// 1. Fetch current lead state
$stmt = $conn->prepare("SELECT name, phone, email, last_interaction_date, assigned_to FROM leads WHERE id = ?");
$stmt->bind_param("i", $leadId);
$stmt->execute();
$leadBefore = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$leadBefore) {
    die("Lead $leadId not found.\n");
}

echo "=== BEFORE SILENT UPDATE ===\n";
print_r($leadBefore);

// We run this test inside a transaction so we don't commit anything to database
$conn->begin_transaction();

try {
    // 2. Call updateLead simulating silent sync:
    // we pass $preserveInteractionDate = true (12th parameter)
    $newId = updateLead(
        $conn,
        $leadBefore['phone'],
        $leadBefore['email'],
        $leadBefore['assigned_to'],
        'Facebook Ads - Form',
        'Lead Đặt giờ - EMBA',
        "Note updated at " . date('Y-m-d H:i:s'),
        2, // connectionId
        null, // customDate
        $leadBefore['name'],
        false, // onlyUpdateDate
        true // preserveInteractionDate
    );

    // 3. Fetch lead state after update
    $stmt = $conn->prepare("SELECT name, phone, email, last_interaction_date, assigned_to, note FROM leads WHERE id = ?");
    $stmt->bind_param("i", $leadId);
    $stmt->execute();
    $leadAfter = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    echo "\n=== AFTER SILENT UPDATE ===\n";
    print_r($leadAfter);

    if ($leadBefore['last_interaction_date'] === $leadAfter['last_interaction_date']) {
        echo "\nSUCCESS: last_interaction_date is successfully preserved!\n";
    } else {
        echo "\nFAILURE: last_interaction_date was modified from {$leadBefore['last_interaction_date']} to {$leadAfter['last_interaction_date']}\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
} finally {
    // Rollback changes to keep production database clean
    $conn->rollback();
    echo "\nTransaction rolled back successfully.\n";
}
