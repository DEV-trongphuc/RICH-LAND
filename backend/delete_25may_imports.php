<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$confirm = isset($_GET['confirm']) && $_GET['confirm'] === '1';
$datePrefix = '2026-05-25';

echo "=== DỌN DẸP DỮ LIỆU IMPORT NGÀY $datePrefix ===\n\n";

// 1. Đếm/Xóa distribution_logs
$logCountQuery = "SELECT COUNT(*) as cnt FROM distribution_logs WHERE received_at LIKE '$datePrefix%' AND status = 'silent'";
$resLogs = $conn->query($logCountQuery)->fetch_assoc();
$logsCount = $resLogs['cnt'];

// 2. Đếm/Xóa leads mới tạo từ Excel Import vào ngày đó
$leadCountQuery = "SELECT COUNT(*) as cnt FROM leads WHERE created_at LIKE '$datePrefix%' AND source = 'Excel Import'";
$resLeads = $conn->query($leadCountQuery)->fetch_assoc();
$leadsCount = $resLeads['cnt'];

echo "Dự kiến xóa:\n";
echo "- $logsCount bản ghi lịch sử phân bổ (distribution_logs) trạng thái 'silent' ngày $datePrefix\n";
echo "- $leadsCount khách hàng mới (leads) được tạo từ 'Excel Import' ngày $datePrefix\n\n";

if ($logsCount === 0 && $leadsCount === 0) {
    echo "Không tìm thấy dữ liệu nào của đợt import ngày $datePrefix để xóa.\n";
    exit;
}

if ($confirm) {
    // Thực thi xóa distribution_logs
    $delLogs = $conn->query("DELETE FROM distribution_logs WHERE received_at LIKE '$datePrefix%' AND status = 'silent'");
    if ($delLogs) {
        echo "[OK] Đã xóa thành công $logsCount bản ghi trong distribution_logs.\n";
    } else {
        echo "[LỖI] Không thể xóa distribution_logs.\n";
    }
    
    // Thực thi xóa leads
    $delLeads = $conn->query("DELETE FROM leads WHERE created_at LIKE '$datePrefix%' AND source = 'Excel Import'");
    if ($delLeads) {
        echo "[OK] Đã xóa thành công $leadsCount khách hàng mới trong leads.\n";
    } else {
        echo "[LỖI] Không thể xóa leads.\n";
    }
    
    echo "\n=== HOÀN TẤT DỌN DẸP ===\n";
} else {
    echo "Chế độ: XEM TRƯỚC (Dry Run) - Chưa xóa dữ liệu nào thực tế.\n";
    echo "Để thực hiện xóa thực tế, vui lòng truy cập đường dẫn thêm tham số '?confirm=1':\n";
    echo "Ví dụ: https://open.richland.test/sale_data/delete_25may_imports.php?confirm=1\n";
}
?>
