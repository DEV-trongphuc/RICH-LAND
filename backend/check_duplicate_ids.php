<?php
// backend/check_duplicate_ids.php
// Script kiểm tra các ID / Email / Zalo Chat ID trùng lặp trong hệ thống

header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=======================================================\n";
echo "    BÁO CÁO KIỂM TRA TRÙNG LẶP DỮ LIỆU HỆ THỐNG        \n";
echo "    Thời gian: " . date('Y-m-d H:i:s') . "\n";
echo "=======================================================\n\n";

// 1. Kiểm tra ID trùng trong bảng users (Khóa chính - Primary Key)
$res = $conn->query("SELECT id, COUNT(*) as cnt FROM users GROUP BY id HAVING cnt > 1");
echo "[1] Kiểm tra ID trùng lặp trong bảng `users`:\n";
if ($res && $res->num_rows > 0) {
    while ($r = $res->fetch_assoc()) {
        echo "  ❌ CẢNH BÁO: ID {$r['id']} bị trùng {$r['cnt']} lần!\n";
    }
} else {
    echo "  ✅ Không có ID nào bị trùng trong bảng `users`.\n";
}
echo "\n";

// 2. Kiểm tra Zalo Chat ID bị trùng giữa các tài khoản khác nhau
$resZalo = $conn->query("
    SELECT zalo_chat_id, COUNT(*) as cnt, GROUP_CONCAT(CONCAT(id, ':', full_name, ' (', role, ')') SEPARATOR ' | ') as accounts
    FROM users 
    WHERE zalo_chat_id IS NOT NULL AND zalo_chat_id != '' 
    GROUP BY zalo_chat_id 
    HAVING cnt > 1
");
echo "[2] Kiểm tra Zalo Chat ID bị liên kết trùng giữa các tài khoản:\n";
if ($resZalo && $resZalo->num_rows > 0) {
    while ($r = $resZalo->fetch_assoc()) {
        echo "  ⚠️ CẢNH BÁO: Zalo Chat ID `{$r['zalo_chat_id']}` đang gán cho {$r['cnt']} tài khoản:\n";
        echo "     --> " . $r['accounts'] . "\n";
    }
} else {
    echo "  ✅ Không có Zalo Chat ID nào bị trùng lặp.\n";
}
echo "\n";

// 3. Kiểm tra Email trùng lặp trong bảng users
$resEmail = $conn->query("
    SELECT LOWER(TRIM(email)) as clean_email, COUNT(*) as cnt, GROUP_CONCAT(CONCAT(id, ':', full_name, ' (', role, ')') SEPARATOR ' | ') as accounts
    FROM users 
    WHERE email IS NOT NULL AND TRIM(email) != '' 
    GROUP BY clean_email 
    HAVING cnt > 1
");
echo "[3] Kiểm tra Email trùng lặp trong bảng `users`:\n";
if ($resEmail && $resEmail->num_rows > 0) {
    while ($r = $resEmail->fetch_assoc()) {
        echo "  ⚠️ CẢNH BÁO: Email `{$r['clean_email']}` bị trùng {$r['cnt']} tài khoản:\n";
        echo "     --> " . $r['accounts'] . "\n";
    }
} else {
    echo "  ✅ Không có Email nào bị trùng lặp.\n";
}
echo "\n";

// 4. Kiểm tra ID trùng trong bảng leads
$resLeads = $conn->query("SELECT id, COUNT(*) as cnt FROM leads GROUP BY id HAVING cnt > 1");
echo "[4] Kiểm tra ID trùng lặp trong bảng `leads`:\n";
if ($resLeads && $resLeads->num_rows > 0) {
    while ($r = $resLeads->fetch_assoc()) {
        echo "  ❌ CẢNH BÁO: Lead ID {$r['id']} bị trùng {$r['cnt']} lần!\n";
    }
} else {
    echo "  ✅ Không có Lead ID nào bị trùng lặp.\n";
}
echo "\n";

// 5. Thống kê tổng quan ID nổi bật
echo "[5] Thống kê thông tin tài khoản ID 1000 & 999:\n";
$res1000 = $conn->query("SELECT id, full_name, email, role, zalo_chat_id FROM users WHERE id IN (999, 1000)");
if ($res1000) {
    while ($r = $res1000->fetch_assoc()) {
        echo "  • ID {$r['id']}: {$r['full_name']} | Email: {$r['email']} | Role: {$r['role']} | Zalo Chat ID: " . ($r['zalo_chat_id'] ?: 'Chưa liên kết') . "\n";
    }
}
echo "\n=======================================================\n";
