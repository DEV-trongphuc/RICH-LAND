<?php
// backend/audit_logs.php
// Chạy file này để kiểm tra lịch sử chỉnh sửa trạng thái của Nguyễn Thị Linh Đan và cấu hình hệ thống

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "=== CẤU HÌNH HỆ THỐNG ===\n";
$settingsRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('duplicate_check_months', 'reassign_if_owner_inactive')");
if ($settingsRes) {
    while ($row = $settingsRes->fetch_assoc()) {
        echo "{$row['setting_key']}: {$row['setting_value']}\n";
    }
}

echo "\n=== LỊCH SỬ THAY ĐỔI CỦA TVV (ID: 1002) TRONG ADMIN LOGS ===\n";
// Dò tìm các hành động sửa đổi liên quan đến Nguyễn Thị Linh Đan (ID 1002) hoặc tài khoản của cô ấy
$stmt = $conn->query("SELECT id, account_id, action, details, ip_address, created_at 
                      FROM admin_logs 
                      WHERE details LIKE '%1002%' OR details LIKE '%Linh Đan%' 
                      ORDER BY id DESC LIMIT 50");
if ($stmt) {
    while ($row = $stmt->fetch_assoc()) {
        print_r($row);
    }
}
