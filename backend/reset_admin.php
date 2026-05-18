<?php
require_once 'db_connect.php';

// Only allow local or CLI access for security
if (php_sapi_name() !== 'cli' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '::1') {
    http_response_code(403);
    die("Forbidden: This script can only be run locally or via CLI.");
}

// Tạo mã băm chuẩn xác cho mật khẩu '123456' trên server của bạn
$hash = password_hash('123456', PASSWORD_DEFAULT);

// Xóa account cũ nếu có và chèn mới
$conn->query("DELETE FROM accounts WHERE username = 'admin'");

$stmt = $conn->prepare("INSERT INTO accounts (username, password_hash, role, name) VALUES ('admin', ?, 'admin', 'Super Admin')");
$stmt->bind_param("s", $hash);
if ($stmt->execute()) {
    echo "Thành công! Tài khoản admin đã được khởi tạo/reset về: 123456. Bạn có thể đăng nhập.";
} else {
    echo "Lỗi: Không thể cập nhật mật khẩu.";
}
$conn->close();
