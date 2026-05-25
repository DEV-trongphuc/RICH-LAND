<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Content-Type: text/plain; charset=utf-8");

try {
    require_once __DIR__ . '/db_connect.php';
    echo "=== AUDIT ACTIVE COMPENSATION ===\n";

    // 1. Query accounts for Turniodev
    echo "\n--- Accounts ---\n";
    $accRes = $conn->query("SELECT id, username, name, email, role FROM accounts WHERE id = 3 OR username LIKE '%Turnio%' OR name LIKE '%Turnio%'");
    if ($accRes && $accRes->num_rows > 0) {
        while ($row = $accRes->fetch_assoc()) {
            print_r($row);
        }
    } else {
        echo "No accounts found for Turniodev / ID 3.\n";
    }

    // 2. Query consultants for Linh Dan
    echo "\n--- Consultants (Đan) ---\n";
    $conRes = $conn->query("SELECT id, name, email FROM consultants WHERE name LIKE '%Đan%'");
    if ($conRes && $conRes->num_rows > 0) {
        while ($row = $conRes->fetch_assoc()) {
            print_r($row);
        }
    } else {
        echo "No consultants found with name containing 'Đan'.\n";
    }

    // 3. Query active compensation logs
    echo "\n--- Active Compensation Logs ---\n";
    $aclRes = $conn->query("
        SELECT acl.*, c.name AS consultant_name, a.username AS admin_username 
        FROM active_compensation_logs acl 
        LEFT JOIN consultants c ON acl.consultant_id = c.id 
        LEFT JOIN accounts a ON acl.admin_id = a.id
    ");
    if ($aclRes && $aclRes->num_rows > 0) {
        while ($row = $aclRes->fetch_assoc()) {
            print_r($row);
        }
    } else {
        echo "No active compensation logs found.\n";
    }

    // 4. Query admin logs for admin 3 or Linh Dan details
    echo "\n--- Admin Logs for Admin 3 or Đan ---\n";
    $alRes = $conn->query("SELECT * FROM admin_logs WHERE account_id = 3 OR details LIKE '%Đan%' ORDER BY id DESC LIMIT 50");
    if ($alRes && $alRes->num_rows > 0) {
        while ($row = $alRes->fetch_assoc()) {
            print_r($row);
        }
    } else {
        echo "No admin logs found.\n";
    }

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "FILE: " . $e->getFile() . "\n";
    echo "LINE: " . $e->getLine() . "\n";
}
echo "\n=== AUDIT COMPLETED ===\n";
?>
