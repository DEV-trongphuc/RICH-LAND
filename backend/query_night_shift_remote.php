<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain");
echo "Current PHP Date/Time: " . date('Y-m-d H:i:s') . "\n";

// 1. Find user Nguyễn Hải Đăng
$userRes = $conn->query("SELECT id, full_name, email, role FROM users WHERE full_name LIKE '%Hải Đăng%' OR role = 'sale' LIMIT 10");
echo "\n--- Users matching search ---\n";
while ($u = $userRes->fetch_assoc()) {
    echo "ID: {$u['id']}, Name: {$u['full_name']}, Email: {$u['email']}, Role: {$u['role']}\n";
}

// 2. Dump all night shift registrations
$regRes = $conn->query("SELECT r.*, u.full_name FROM night_shift_registrations r JOIN users u ON r.user_id = u.id ORDER BY r.id DESC LIMIT 10");
echo "\n--- Recent Night Shift Registrations ---\n";
if ($regRes) {
    while ($r = $regRes->fetch_assoc()) {
        echo "ID: {$r['id']}, User ID: {$r['user_id']} ({$r['full_name']}), Date: {$r['shift_date']}, Approved: {$r['approved']}, Created At: {$r['created_at']}\n";
    }
} else {
    echo "Query registrations failed: " . $conn->error . "\n";
}
