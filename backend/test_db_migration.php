<?php
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/db_connect.php';

echo "=== KIỂM TRA PHIÊN BẢN DATABASE ===\n";
$res = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
if ($res && $res->num_rows > 0) {
    echo "db_version: " . $res->fetch_assoc()['setting_value'] . "\n";
} else {
    echo "db_version: NOT FOUND\n";
}

echo "\n=== KIỂM TRA CỘT TRONG BẢNG LEADS ===\n";
$resCols = $conn->query("SHOW COLUMNS FROM leads");
while ($col = $resCols->fetch_assoc()) {
    if (in_array($col['Field'], ['id', 'name', 'zalo_notify_status', 'email_notify_status', 'assigned_to'])) {
        echo "Cột: {$col['Field']} | Kiểu: {$col['Type']} | Nullable: {$col['Null']} | Mặc định: " . ($col['Default'] ?? 'NULL') . "\n";
    }
}

echo "\n=== KIỂM TRA CỘT TRONG BẢNG MAIL_QUEUE ===\n";
$resCols = $conn->query("SHOW COLUMNS FROM mail_queue");
while ($col = $resCols->fetch_assoc()) {
    if (in_array($col['Field'], ['id', 'lead_id'])) {
        echo "Cột: {$col['Field']} | Kiểu: {$col['Type']}\n";
    }
}

echo "\n=== KIỂM TRA CỘT TRONG BẢNG ZALO_QUEUE ===\n";
$resCols = $conn->query("SHOW COLUMNS FROM zalo_queue");
while ($col = $resCols->fetch_assoc()) {
    if (in_array($col['Field'], ['id', 'lead_id'])) {
        echo "Cột: {$col['Field']} | Kiểu: {$col['Type']}\n";
    }
}

echo "\n=== KIỂM TRA TRẠNG THÁI CỦA 10 LEAD MỚI NHẤT ===\n";
$resLeads = $conn->query("SELECT id, name, assigned_to, zalo_notify_status, email_notify_status FROM leads ORDER BY id DESC LIMIT 10");
if ($resLeads) {
    while ($row = $resLeads->fetch_assoc()) {
        echo "Lead ID: #{$row['id']} | Tên: {$row['name']} | Sale: " . ($row['assigned_to'] ?? 'Chưa chia') . " | Zalo Status: {$row['zalo_notify_status']} | Email Status: {$row['email_notify_status']}\n";
    }
}
?>
