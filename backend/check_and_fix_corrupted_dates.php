<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$datePrefix = '2026-05-25';
$confirm = isset($_GET['confirm']) && $_GET['confirm'] === '1';

echo "=== ĐỐI SOÁT VÀ SỬA LỖI NGÀY TƯƠNG TÁC GỐC ===\n";
echo "Mục tiêu: Tìm các lead bị silent sync ghi đè ngày tương tác trong ngày '$datePrefix' và khôi phục lại từ lịch sử phân bổ.\n\n";

// 1. Tìm danh sách các lead có ngày tương tác rơi vào ngày 2026-05-25
$stmt = $conn->prepare("SELECT id, name, phone, last_interaction_date, created_at FROM leads WHERE last_interaction_date LIKE ?");
$datePattern = $datePrefix . '%';
$stmt->bind_param("s", $datePattern);
$stmt->execute();
$leads = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$total = count($leads);
echo "Tìm thấy: $total lead đang có ngày tương tác rơi vào ngày '$datePrefix'.\n\n";

if ($total === 0) {
    echo "Không tìm thấy lead nào có ngày tương tác rơi vào ngày '$datePrefix'.\n";
    exit;
}

$fixedCount = 0;
$noChangeCount = 0;
$noLogCount = 0;

foreach ($leads as $lead) {
    $leadId = $lead['id'];
    
    // Tìm tương tác thực tế gần nhất của lead này trong distribution_logs (trừ trạng thái silent)
    $logStmt = $conn->prepare("
        SELECT received_at, status, message 
        FROM distribution_logs 
        WHERE lead_id = ? AND status != 'silent' 
        ORDER BY id DESC LIMIT 1
    ");
    $logStmt->bind_param("i", $leadId);
    $logStmt->execute();
    $logRes = $logStmt->get_result()->fetch_assoc();
    
    $actualDate = null;
    $logStatus = 'none';
    if ($logRes) {
        $actualDate = $logRes['received_at'];
        $logStatus = $logRes['status'];
    } else {
        // Nếu không có log phân bổ thực tế nào, ngày tương tác gốc chính là ngày tạo lead (created_at)
        $actualDate = $lead['created_at'];
        $logStatus = 'created_at';
    }
    
    if ($actualDate && $actualDate !== $lead['last_interaction_date']) {
        echo "Lead ID: $leadId | Tên: {$lead['name']} | SĐT: {$lead['phone']}\n";
        echo "  - Ngày hiện tại (bị ghi đè): {$lead['last_interaction_date']}\n";
        echo "  - Ngày thực tế khôi phục: $actualDate (Dựa trên: $logStatus)\n";
        
        if ($confirm) {
            $updateStmt = $conn->prepare("UPDATE leads SET last_interaction_date = ? WHERE id = ?");
            $updateStmt->bind_param("si", $actualDate, $leadId);
            $updateStmt->execute();
            $updateStmt->close();
            echo "  [OK] Đã khôi phục thành công ngày thực tế.\n";
            $fixedCount++;
        } else {
            echo "  [CHỜ] Sẽ khôi phục ngày thực tế này.\n";
            $fixedCount++;
        }
    } else {
        $noChangeCount++;
    }
    $logStmt->close();
}

echo "\n=== KẾT QUẢ ĐỐI SOÁT ===\n";
if ($confirm) {
    echo "Đã khôi phục thành công: $fixedCount / $total lead.\n";
    echo "Số lead có ngày khớp đúng sẵn (không cần sửa): $noChangeCount lead.\n";
} else {
    echo "Chế độ: ĐANG XEM TRƯỚC (Dry Run) - Chưa có thay đổi nào được ghi vào DB.\n";
    echo "Dự kiến sẽ khôi phục: $fixedCount / $total lead.\n";
    echo "Số lead có ngày khớp đúng sẵn (không cần sửa): $noChangeCount lead.\n";
    echo "Để thực hiện lưu thay đổi thực tế vào DB, vui lòng thêm tham số '?confirm=1' vào URL.\n";
    echo "Ví dụ: https://open.domation.net/sale_data/check_and_fix_corrupted_dates.php?confirm=1\n";
}
?>
