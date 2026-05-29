<?php
// query_lead_debug.php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

header('Content-Type: application/json; charset=utf-8');

$phone = '0933628393';
$email = 'duongpngocquyen@gmail.com';

$data = [];

// Sử dụng Transaction và Rollback để chạy giả lập an toàn không ảnh hưởng tới DB thật
$conn->begin_transaction();
try {
    // 1. Phục hồi tạm thời lead 19519 về trạng thái gốc trước ngày 29/05
    // Gán lại cho Lê Đinh Ý Nhi (1003) và mốc tương tác cuối là 25/05
    $conn->query("UPDATE leads SET assigned_to = 1003, last_interaction_date = '2026-05-25 08:47:55' WHERE id = 19519");

    // 2. Chạy hàm check trùng lặp trên trạng thái giả lập này
    $data['simulated_crm_check'] = checkCRMInteraction($conn, $phone, $email);

    // 3. Lấy thông tin bản ghi lead và consultant sau khi join trong hàm check trùng
    $res = $conn->query("SELECT l.id, l.assigned_to, l.last_interaction_date, 
                                c.name as consultant_name, c.status as consultant_status, 
                                c.leave_start, c.leave_end 
                         FROM leads l 
                         LEFT JOIN consultants c ON l.assigned_to = c.id 
                         WHERE l.id = 19519");
    $data['simulated_raw_db_row'] = $res->fetch_assoc();

    // 4. Lấy cấu hình hệ thống
    $reassignIfOwnerInactive = get_system_setting($conn, 'reassign_if_owner_inactive');
    if ($reassignIfOwnerInactive === '') {
        $reassignIfOwnerInactive = '1';
    }
    $data['reassign_setting'] = $reassignIfOwnerInactive;

} catch (Exception $e) {
    $data['error'] = $e->getMessage();
} finally {
    // Hoàn tác mọi thay đổi giả lập ở trên, giữ DB sạch
    $conn->rollback();
}

echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
