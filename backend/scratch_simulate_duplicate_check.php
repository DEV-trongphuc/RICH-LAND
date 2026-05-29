<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== SIMULATING PRE-SYNC STATE ===\n";

$conn->begin_transaction();
try {
    // 1. Temporarily restore lead 4648 state
    $stmt = $conn->prepare("UPDATE leads SET assigned_to = 1002, last_interaction_date = '2026-05-25 08:47:44' WHERE id = 4648");
    $stmt->execute();
    $stmt->close();
    
    echo "Lead 4648 temporarily set to assigned_to = 1002, last_interaction_date = '2026-05-25 08:47:44'\n";
    
    // 2. Run checkCRMInteraction
    $phone = '0374457611';
    $email = 'manle14dtp03@gmail.com';
    $crmCheck = checkCRMInteraction($conn, $phone, $email);
    
    echo "checkCRMInteraction result:\n";
    print_r($crmCheck);
    
    // 3. Rollback changes
    $conn->rollback();
    echo "Transaction rolled back successfully.\n";
} catch (Exception $e) {
    $conn->rollback();
    echo "Error during simulation: " . $e->getMessage() . "\n";
}
?>
