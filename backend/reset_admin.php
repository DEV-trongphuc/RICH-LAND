<?php
require_once 'db_connect.php';

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
