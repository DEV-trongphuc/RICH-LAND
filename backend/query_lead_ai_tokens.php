<?php
// e:/GIAO_DATA_GOOGLESHEETS/backend/query_lead_ai_tokens.php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: application/json; charset=UTF-8");

$phone = '0933628393';
$namePattern = '%Quyen Duong%';

try {
    // 1. Kiểm tra xem cột ai_screening_started_at đã tồn tại chưa
    $chkCol = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_screening_started_at'");
    $hasCol = ($chkCol && $chkCol->num_rows > 0);

    if ($hasCol) {
        // Cập nhật hồi tố cho các lead lịch sử bị NULL cột ai_screening_started_at
        $conn->query("UPDATE leads SET ai_screening_started_at = COALESCE(last_interaction_date, created_at) WHERE ai_screening_started_at IS NULL AND ai_total_tokens > 0");
    }

    // 2. Điền lại thông tin token chi tiết cho lead Quyen Duong
    if ($hasCol) {
        $updateSql = "
            UPDATE leads 
            SET ai_screener_status = 'passed',
                ai_evaluation = 'Khách hàng có bằng đại học và có thông tin về tiếng Anh.',
                ai_prompt_tokens = 364,
                ai_completion_tokens = 32,
                ai_total_tokens = 396,
                ai_screening_started_at = COALESCE(ai_screening_started_at, '2026-05-29 23:51:03')
            WHERE phone = ? OR name LIKE ?
        ";
    } else {
        $updateSql = "
            UPDATE leads 
            SET ai_screener_status = 'passed',
                ai_evaluation = 'Khách hàng có bằng đại học và có thông tin về tiếng Anh.',
                ai_prompt_tokens = 364,
                ai_completion_tokens = 32,
                ai_total_tokens = 396
            WHERE phone = ? OR name LIKE ?
        ";
    }

    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->bind_param("ss", $phone, $namePattern);
    $updateStmt->execute();
    $updateStmt->close();

    // 3. Truy xuất thông tin từ database để xuất ra màn hình
    if ($hasCol) {
        $selectSql = "SELECT id, name, phone, email, status, ai_screener_status, ai_evaluation, ai_prompt_tokens, ai_completion_tokens, ai_total_tokens, ai_screening_started_at, created_at FROM leads WHERE phone = ? OR name LIKE ?";
    } else {
        $selectSql = "SELECT id, name, phone, email, status, ai_screener_status, ai_evaluation, ai_prompt_tokens, ai_completion_tokens, ai_total_tokens, created_at FROM leads WHERE phone = ? OR name LIKE ?";
    }

    $stmt = $conn->prepare($selectSql);
    $stmt->bind_param("ss", $phone, $namePattern);
    $stmt->execute();
    $res = $stmt->get_result();

    $leads = [];
    while ($row = $res->fetch_assoc()) {
        $leads[] = $row;
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'Cập nhật và truy vấn thông tin tokens của Quyen Duong thành công.',
        'has_ai_screening_started_at_column' => $hasCol,
        'data' => $leads
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi SQL/PHP: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>
