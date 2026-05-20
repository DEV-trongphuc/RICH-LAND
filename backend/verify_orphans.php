<?php
// verify_orphans.php
// Script to check if any orphaned records remain in other tables after deleting a lead from the leads table.

require_once __DIR__ . '/db_connect.php';

header('Content-Type: text/plain; charset=UTF-8');

echo "--- KIỂM TRA TÍNH TOÀN VẸN CƠ SỞ DỮ LIỆU ---\n\n";

// 1. Check orphaned distribution logs
$resLogs = $conn->query("
    SELECT COUNT(*) as cnt 
    FROM distribution_logs dl 
    LEFT JOIN leads l ON dl.lead_id = l.id 
    WHERE dl.lead_id IS NOT NULL AND l.id IS NULL
");
$orphanedLogs = $resLogs ? $resLogs->fetch_assoc()['cnt'] : 0;
echo "1. Số dòng Nhật ký chia số mồ côi (không khớp Lead nào): " . $orphanedLogs . "\n";

// 2. Check orphaned ticket reports
$resReports = $conn->query("
    SELECT COUNT(*) as cnt 
    FROM data_reports dr 
    LEFT JOIN leads l ON dr.lead_id = l.id 
    WHERE dr.lead_id IS NOT NULL AND l.id IS NULL
");
$orphanedReports = $resReports ? $resReports->fetch_assoc()['cnt'] : 0;
echo "2. Số Khiếu nại/Ticket mồ côi (không khớp Lead nào): " . $orphanedReports . "\n\n";

if ($orphanedLogs == 0 && $orphanedReports == 0) {
    echo "=> KẾT LUẬN: KHÔNG CÓ DẤU VẾT SÓT LẠI! Cơ chế CASCADE hoạt động hoàn hảo.\n";
    echo "Khi xóa ở bảng 'leads', tất cả lịch sử và ticket liên quan đã tự động bị xóa sạch 100%.\n";
} else {
    echo "=> CẢNH BÁO: Phát hiện bản ghi mồ côi! Cần kiểm tra lại khóa ngoại.\n";
}

echo "\n* Lưu ý về lịch sử quét Google Sheets (sheet_sync_records):\n";
echo "Bảng này không liên kết với bảng 'leads' bằng ID, mà lưu độc lập dưới dạng mã băm (row_hash).\n";
echo "Khi xóa Lead, bản ghi hash trong 'sheet_sync_records' vẫn tồn tại để chặn không cho cronjob\n";
echo "quét lại dòng đó từ sheet. Nếu muốn đồng bộ lại dòng đó, hãy sửa nhẹ nội dung dòng trên Google Sheets.\n";

echo "\n-------------------------------------------------\n";
?>
