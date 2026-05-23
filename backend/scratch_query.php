<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=utf-8");

echo "=== SYSTEM SETTING ZALO BOT TOKEN ===\n";
$stmtToken = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
if ($stmtToken) {
    print_r($stmtToken->fetch_assoc());
}

echo "\n=== TICKET NOTIFY SETTINGS ===\n";
$resNotify = $conn->query("SELECT * FROM ticket_notify_settings");
if ($resNotify) {
    while ($row = $resNotify->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

echo "\n=== ACCOUNTS ===\n";
$resAccounts = $conn->query("SELECT id, username, name, email, zalo_chat_id FROM accounts");
if ($resAccounts) {
    while ($row = $resAccounts->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

echo "\n=== CONSULTANTS ===\n";
$resConsultants = $conn->query("SELECT id, name, email, zalo_chat_id, status FROM consultants");
if ($resConsultants) {
    while ($row = $resConsultants->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

echo "\n=== RECENT REPORTS ===\n";
$resReports = $conn->query("SELECT r.id, r.lead_id, r.consultant_id, r.round_id, r.reason, r.status, r.reject_reason, r.approval_reason, r.created_at, r.resolved_by FROM data_reports r ORDER BY r.id DESC LIMIT 10");
if ($resReports) {
    while ($row = $resReports->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

echo "\n=== PHP ERROR LOG LOCATION ===\n";
echo ini_get('error_log') . "\n";
?>
