<?php
// backend/test_full_system.php
// Full System Integration Test using test_bootstrap.php harness

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 BAT DAU KIEM THU TOAN DIEN HE THONG (FULL TEST)\n";
echo "====================================================\n\n";

// 1. Test Connections
assertTest("Ket noi MySQLi \$conn", isset($conn) && $conn instanceof mysqli);
assertTest("Ket noi PDO \$pdo", isset($pdo) && $pdo instanceof PDO);

// 2. Test Core Functions & Libraries
assertTest("Thu vien webhook_logic.php da nap", function_exists('normalizePhone'));
assertTest("Thu vien zalo_bot.php da nap", function_exists('sendZaloMessage'));
assertTest("Thu vien telegram_bot.php da nap", function_exists('sendTelegramMessage'));
assertTest("Thu vien mailer.php da nap", function_exists('sendEmailNotification'));
assertTest("Lop NotificationService da nap", class_exists('NotificationService'));

// 3. Test NotificationService helper getAllActiveUsers
if ($pdo instanceof PDO) {
    $activeUsers = NotificationService::getAllActiveUsers($pdo, 1);
    assertTest("Hieu nang NotificationService::getAllActiveUsers", is_array($activeUsers), "Tim thay " . count($activeUsers) . " active users");
}

// 4. Test User & Consultant Field Preservation
$userRow = $conn->query("SELECT id, full_name, zalo_chat_id FROM users LIMIT 1")->fetch_assoc();
if ($userRow) {
    $uId = (int)$userRow['id'];
    $zaloId = $userRow['zalo_chat_id'];
    assertDbField($conn, 'users', 'id', "id = {$uId}", $uId, "Truy van bang Users theo ID");
}

// 5. Test Extended CRM fields presence in Contacts
$contactRow = $conn->query("SELECT id, first_name, zalo_phone, preferred_location, budget FROM contacts LIMIT 1")->fetch_assoc();
if ($contactRow) {
    $cId = (int)$contactRow['id'];
    assertDbField($conn, 'contacts', 'id', "id = {$cId}", $cId, "Truy van bang Contacts theo ID");
}

// 6. Test Communication Logs structure
$commRes = $conn->query("SHOW COLUMNS FROM communication_logs LIKE 'type'");
assertTest("Bang communication_logs co cot type", $commRes && $commRes->num_rows > 0);

printTestSummary();
