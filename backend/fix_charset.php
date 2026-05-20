<?php
// Only allow local or CLI access for security
if (php_sapi_name() !== 'cli' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '::1') {
    http_response_code(403);
    die("Forbidden: This script can only be run locally or via CLI.");
}

require_once __DIR__ . '/db_connect.php';

// Script to fix character set encoding for all tables
header('Content-Type: application/json; charset=utf-8');

try {
    // Tự động tìm tất cả các bảng trong database
    $result = $conn->query("SHOW TABLES");
    $tables = [];
    while ($row = $result->fetch_array()) {
        $tables[] = $row[0];
    }

    // Lấy tên database từ config
    $result_db = $conn->query("SELECT DATABASE()");
    $row_db = $result_db->fetch_array();
    $dbname = $row_db[0];

    if ($dbname) {
        $conn->query("ALTER DATABASE `$dbname` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci");
    }

    // Convert mỗi bảng
    foreach ($tables as $table) {
        $conn->query("ALTER TABLE `$table` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $conn->query("ALTER TABLE `$table` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }

    echo json_encode([
        "success" => true, 
        "message" => "Đã fix thành công lỗi font tiếng Việt cho " . count($tables) . " bảng dữ liệu!"
    ]);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Lỗi: " . $e->getMessage()]);
}
?>
