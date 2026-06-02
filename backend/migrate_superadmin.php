<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=== MIGRATION: ADD SUPERADMIN ROLE & SET ROLE FOR turniodev@gmail.com ===\n\n";

try {
    // 1. Alter table to support 'superadmin' enum option
    echo "1. Altering 'accounts' table column 'role'...\n";
    $alterSql = "ALTER TABLE accounts MODIFY COLUMN role ENUM('superadmin', 'admin', 'assistant', 'viewer') DEFAULT 'viewer'";
    if ($conn->query($alterSql)) {
        echo "[OK] 'role' column modified successfully to include 'superadmin'.\n";
    } else {
        throw new Exception("Failed to modify 'role' column: " . $conn->error);
    }

    // 2. Migrate email turniodev@gmail.com to superadmin
    echo "\n2. Migrating turniodev@gmail.com to superadmin...\n";
    $email = 'turniodev@gmail.com';
    $stmt = $conn->prepare("UPDATE accounts SET role = 'superadmin', is_confirmed = 1 WHERE email = ?");
    if ($stmt) {
        $stmt->bind_param("s", $email);
        if ($stmt->execute()) {
            $affected = $stmt->affected_rows;
            if ($affected > 0) {
                echo "[OK] Successfully updated $email to superadmin.\n";
            } else {
                echo "[LƯU Ý] Không có hàng nào được cập nhật. Email này đã là superadmin hoặc không tồn tại trong DB.\n";
            }
        } else {
            throw new Exception("Execute failed: " . $stmt->error);
        }
        $stmt->close();
    } else {
        throw new Exception("Prepare failed: " . $conn->error);
    }

    echo "\n=== MIGRATION COMPLETED SUCCESSFULLY ===\n";
    
    // Auto-delete the file for security
    @unlink(__FILE__);
    echo "[OK] Security notice: Migration script has been self-deleted.\n";
    
} catch (Exception $e) {
    echo "\n[LỖI] Migration thất bại: " . $e->getMessage() . "\n";
}
?>
