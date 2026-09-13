<?php
// backend/test_webhook_diag.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$token = $_GET['diag_token'] ?? '';
if ($token !== 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7') {
    http_response_code(403);
    echo "Forbidden";
    exit;
}

echo "=== DIAGNOSTIC REPORT ===\n";
echo "PHP Version: " . phpversion() . "\n";

try {
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_GET['token'] = 'tok_test_universal_2026';
    $_SERVER['CONTENT_TYPE'] = 'application/json';
    
    // Test including webhook_logic.php
    require_once __DIR__ . '/db_connect.php';
    require_once __DIR__ . '/webhook_logic.php';
    echo "db_connect & webhook_logic: OK\n";

    // Test query connection
    $stmt = $conn->prepare("SELECT id, sheet_name, default_source, default_type, require_both_contact, connection_type, is_silent, sync_saleperson, spreadsheet_id, notify_admin, auto_append_unmapped_note, webhook_token FROM sheet_connections WHERE webhook_token = ? AND is_active = 1");
    $tok = 'tok_test_universal_2026';
    $stmt->bind_param("s", $tok);
    $stmt->execute();
    $connRes = $stmt->get_result();
    $connData = $connRes->fetch_assoc();
    $stmt->close();
    echo "Connection fetch: OK (" . ($connData['sheet_name'] ?? 'none') . ")\n";

    // Test webhook_logs insert
    $connectionId = (int)$connData['id'];
    $ipAddr = '127.0.0.1';
    $reqMeth = 'POST';
    $contentType = 'application/json';
    $rawToLog = '{"name":"test","phone":"0912345678"}';
    $parsedJson = $rawToLog;
    $logStmt = $conn->prepare("INSERT INTO webhook_logs (connection_id, token, ip_address, request_method, content_type, raw_payload, parsed_data, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'processing')");
    $logStmt->bind_param("issssss", $connectionId, $tok, $ipAddr, $reqMeth, $contentType, $rawToLog, $parsedJson);
    $logStmt->execute();
    $webhookLogId = $logStmt->insert_id;
    $logStmt->close();
    echo "webhook_logs insert: OK (logId: $webhookLogId)\n";

    // Test evaluateRules
    $data = ['phone' => '0912345678', 'name' => 'Test'];
    $ruleResult = evaluateRules($conn, $data, 'Website', 'Nóng', $connectionId, 'webhook');
    echo "evaluateRules: OK (ruleResult: " . json_encode($ruleResult) . ")\n";

    // Test checkCrmDuplicate
    $crmCheck = checkCrmDuplicate($conn, '0912345678', '', $connectionId, 0);
    echo "checkCrmDuplicate: OK (dup: " . json_encode($crmCheck) . ")\n";

    echo "ALL DIAGNOSTIC CHECKS PASSED!\n";
} catch (Throwable $e) {
    echo "EXCEPTION: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " on line " . $e->getLine() . "\n";
    echo $e->getTraceAsString();
}
