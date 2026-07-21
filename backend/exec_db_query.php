<?php
// backend/exec_db_query.php
// File truy vấn database toàn quyền cho agent và admin đối soát

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$secretKey = $_REQUEST['key'] ?? '';
// Secret key bảo mật: key=richland2026
if ($secretKey !== 'richland2026') {
    http_response_code(403);
    echo json_encode(["error" => "Unauthorized. Invalid secret key."]);
    exit;
}

$sql = trim($_REQUEST['sql'] ?? '');
if (empty($sql)) {
    echo json_encode(["error" => "No SQL query provided. Pass 'sql' parameter."]);
    exit;
}

try {
    $stmt = $conn->query($sql);
    if ($stmt === true) {
        echo json_encode(["status" => "success", "affected_rows" => $conn->affected_rows]);
    } else if ($stmt instanceof mysqli_result) {
        $rows = [];
        while ($row = $stmt->fetch_assoc()) {
            $rows[] = $row;
        }
        echo json_encode([
            "status" => "success",
            "count" => count($rows),
            "data" => $rows
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(["status" => "success"]);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
