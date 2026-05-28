<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== CONNECTION ID 2 DETAILS ===\n";
$stmt = $conn->prepare("SELECT id, sheet_name, connection_type, is_silent, sync_mode, is_initialized, created_at, lead_recall_minutes FROM sheet_connections WHERE id = 2");
$stmt->execute();
$res = $stmt->get_result();
if ($res && $res->num_rows > 0) {
    $row = $res->fetch_assoc();
    print_r($row);
} else {
    echo "Connection ID 2 not found.\n";
}
$stmt->close();

echo "\n=== ALL SHEET CONNECTIONS ===\n";
$resAll = $conn->query("SELECT id, sheet_name, connection_type, is_silent, is_active FROM sheet_connections");
if ($resAll) {
    while ($row = $resAll->fetch_assoc()) {
        echo "ID: {$row['id']} | Name: {$row['sheet_name']} | Type: {$row['connection_type']} | Silent: {$row['is_silent']} | Active: {$row['is_active']}\n";
    }
}

echo "\n=== DUPLICATE & SYSTEM SETTINGS ===\n";
$resSettings = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('duplicate_check_months', 'reassign_if_owner_inactive')");
if ($resSettings) {
    while ($row = $resSettings->fetch_assoc()) {
        echo "{$row['setting_key']}: {$row['setting_value']}\n";
    }
}
?>
