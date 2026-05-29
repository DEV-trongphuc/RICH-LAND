<?php
// test_performance.php
// Security check to prevent unauthorized execution
if (($_GET['sec'] ?? '') !== 'ideas_admin_2026') {
    http_response_code(403);
    die("Access Denied.");
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/cron_sync.php';

header('Content-Type: application/json; charset=utf-8');

$results = [];

// ==========================================
// 1. TEST CASE: LOG PRUNING
// ==========================================
$results['log_pruning'] = [];
try {
    // Save current count
    $res = $conn->query("SELECT COUNT(*) as cnt FROM admin_logs");
    $beforeAdminLogs = (int)($res->fetch_assoc()['cnt'] ?? 0);
    
    $res = $conn->query("SELECT COUNT(*) as cnt FROM communication_logs");
    $beforeCommLogs = (int)($res->fetch_assoc()['cnt'] ?? 0);

    // Insert dummy records older than 90 days (e.g., 95 days ago)
    $oldDate = date('Y-m-d H:i:s', strtotime('-95 days'));
    $currentDate = date('Y-m-d H:i:s');

    // Create a dummy account if none exists, or use account 1 (or 0 for system)
    $accStmt = $conn->query("SELECT id FROM accounts LIMIT 1");
    $accountId = (int)($accStmt->fetch_assoc()['id'] ?? 0);
    
    // We insert via raw SQL because of timestamp manipulation
    $conn->query("INSERT INTO admin_logs (account_id, action, details, ip_address, created_at) VALUES ($accountId, 'TEST_PRUNE_OLD', 'Test Details Old', '127.0.0.1', '$oldDate')");
    $oldAdminLogId = $conn->insert_id;
    
    $conn->query("INSERT INTO admin_logs (account_id, action, details, ip_address, created_at) VALUES ($accountId, 'TEST_PRUNE_NEW', 'Test Details New', '127.0.0.1', '$currentDate')");
    $newAdminLogId = $conn->insert_id;

    // Same for communication logs
    // We need a dummy lead or null
    $leadStmt = $conn->query("SELECT id FROM leads LIMIT 1");
    $leadIdVal = $leadStmt->fetch_assoc()['id'] ?? null;
    $leadIdSql = $leadIdVal ? $leadIdVal : "NULL";

    $conn->query("INSERT INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at) VALUES ($leadIdSql, 'email', 'test_old@example.com', 'sent', NULL, '$oldDate')");
    $oldCommLogId = $conn->insert_id;

    $conn->query("INSERT INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at) VALUES ($leadIdSql, 'email', 'test_new@example.com', 'sent', NULL, '$currentDate')");
    $newCommLogId = $conn->insert_id;

    // Run pruning
    pruneAdminLogs($conn);

    // Verify
    $oldAdminCheck = $conn->query("SELECT COUNT(*) as cnt FROM admin_logs WHERE id = $oldAdminLogId")->fetch_assoc()['cnt'] ?? 0;
    $newAdminCheck = $conn->query("SELECT COUNT(*) as cnt FROM admin_logs WHERE id = $newAdminLogId")->fetch_assoc()['cnt'] ?? 0;
    
    $oldCommCheck = $conn->query("SELECT COUNT(*) as cnt FROM communication_logs WHERE id = $oldCommLogId")->fetch_assoc()['cnt'] ?? 0;
    $newCommCheck = $conn->query("SELECT COUNT(*) as cnt FROM communication_logs WHERE id = $newCommLogId")->fetch_assoc()['cnt'] ?? 0;

    // Kì vọng logs CŨ không bị xóa vì cơ chế đã tắt
    $pruningIsDisabled = ($oldAdminCheck == 1 && $oldCommCheck == 1);

    $results['log_pruning'] = [
        'success' => $pruningIsDisabled,
        'message' => 'Cơ chế tự động dọn dẹp log đã tắt thành công theo yêu cầu của Admin. Dữ liệu lịch sử được giữ nguyên vẹn.',
        'old_admin_kept' => $oldAdminCheck == 1,
        'new_admin_preserved' => $newAdminCheck == 1,
        'old_comm_kept' => $oldCommCheck == 1,
        'new_comm_preserved' => $newCommCheck == 1
    ];

    // Cleanup all created logs (both old and new test cases)
    $conn->query("DELETE FROM admin_logs WHERE id IN ($oldAdminLogId, $newAdminLogId)");
    $conn->query("DELETE FROM communication_logs WHERE id IN ($oldCommLogId, $newCommLogId)");

} catch (Exception $e) {
    $results['log_pruning'] = [
        'success' => false,
        'error' => $e->getMessage()
    ];
}

// ==========================================
// 2. TEST CASE: SHEET CONNECTION DE-ESCALATION (SELF-HEALING)
// ==========================================
$results['deescalation'] = [];
try {
    // Insert dummy sheet connection that has been failing for > 24 hours
    $oldDate24 = date('Y-m-d H:i:s', strtotime('-25 hours'));
    $dummyToken = 'test_token_' . uniqid();
    
    $conn->query("INSERT INTO sheet_connections (sheet_name, spreadsheet_id, connection_type, webhook_token, is_active, sync_status, sync_interval, last_sync_at, last_error, created_at)
                  VALUES ('Test Sheet Deescalate', 'test_spreadsheet_id_123', 'sheets', '$dummyToken', 1, 'error', 5, '$oldDate24', 'Lỗi đồng bộ giả lập', '$oldDate24')");
    $dummyConnId = $conn->insert_id;

    if (!$dummyConnId) {
        throw new Exception("Cannot insert dummy connection: " . $conn->error);
    }

    // Run de-escalation
    deescalateFailedConnections($conn);

    // Fetch and check state
    $chkRes = $conn->query("SELECT is_active, sync_status, last_error FROM sheet_connections WHERE id = $dummyConnId");
    $connItem = $chkRes->fetch_assoc();

    $isDeactivated = ((int)($connItem['is_active'] ?? -1) === 0);
    $statusReset = (($connItem['sync_status'] ?? '') === 'idle');
    $errorAppended = (strpos($connItem['last_error'] ?? '', '[Tự động tắt do lỗi liên tục > 24h]') !== false);

    $results['deescalation'] = [
        'success' => ($isDeactivated && $statusReset && $errorAppended),
        'is_active_after' => (int)$connItem['is_active'],
        'sync_status_after' => $connItem['sync_status'],
        'last_error_after' => $connItem['last_error'],
        'details' => [
            'is_deactivated_correctly' => $isDeactivated,
            'status_reset_to_idle' => $statusReset,
            'error_appended_correctly' => $errorAppended
        ]
    ];

    // Cleanup dummy connection
    $conn->query("DELETE FROM sheet_connections WHERE id = $dummyConnId");

} catch (Exception $e) {
    $results['deescalation'] = [
        'success' => false,
        'error' => $e->getMessage()
    ];
}

echo json_encode([
    'success' => ($results['log_pruning']['success'] ?? false) && ($results['deescalation']['success'] ?? false),
    'timestamp' => date('Y-m-d H:i:s'),
    'results' => $results
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
