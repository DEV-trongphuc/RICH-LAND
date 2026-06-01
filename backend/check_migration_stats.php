<?php
// e:/GIAO_DATA_GOOGLESHEETS/backend/check_migration_stats.php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "========================================================================\n";
echo "       KIỂM TRA SỐ LIỆU MIGRATION LOG PHÂN BỔ & TICKET CŨ\n";
echo "========================================================================\n\n";

// 1. Kiểm tra log Phân bổ cũ (Rejected, Blacklisted)
echo "--- 1. KIỂM TRA LOG PHÂN BỔ (REJECTED & BLACKLISTED) ---\n";

// Tổng số logs
$totalLogsRes = $conn->query("SELECT status, COUNT(*) as cnt FROM distribution_logs WHERE status IN ('rejected', 'blacklisted') GROUP BY status");
$logsSummary = [];
$totalLogs = 0;
if ($totalLogsRes) {
    while ($row = $totalLogsRes->fetch_assoc()) {
        $logsSummary[$row['status']] = (int)$row['cnt'];
        $totalLogs += (int)$row['cnt'];
    }
}
echo "Tổng số log 'rejected' hiện tại trong hệ thống: " . ($logsSummary['rejected'] ?? 0) . "\n";
echo "Tổng số log 'blacklisted' hiện tại trong hệ thống: " . ($logsSummary['blacklisted'] ?? 0) . "\n";
echo "Tổng cộng: $totalLogs bản ghi.\n\n";

// Số lượng cần migrate (thời gian log nhận lệch với ngày tạo lead > 60 giây)
$migrateSql = "SELECT dl.status, COUNT(*) as cnt 
               FROM distribution_logs dl
               JOIN leads l ON dl.lead_id = l.id
               WHERE dl.status IN ('rejected', 'blacklisted') 
                 AND TIMESTAMPDIFF(SECOND, l.created_at, dl.received_at) > 60
               GROUP BY dl.status";

$migrateRes = $conn->query($migrateSql);
$migrateSummary = [];
$totalMigrate = 0;
if ($migrateRes) {
    while ($row = $migrateRes->fetch_assoc()) {
        $migrateSummary[$row['status']] = (int)$row['cnt'];
        $totalMigrate += (int)$row['cnt'];
    }
}

echo "Số lượng bản ghi CẦN MIGRATE (bị lệch ngày duyệt và ngày tạo Lead):\n";
echo "  - Số log 'rejected' cần đồng bộ ngày tạo Lead: " . ($migrateSummary['rejected'] ?? 0) . "\n";
echo "  - Số log 'blacklisted' cần đồng bộ ngày tạo Lead: " . ($migrateSummary['blacklisted'] ?? 0) . "\n";
echo "  - Tổng số bản ghi sẽ được cập nhật ngày: $totalMigrate\n\n";

// Danh sách xem trước 20 dòng sẽ migrate
if ($totalMigrate > 0) {
    echo "CHI TIẾT XEM TRƯỚC 20 BẢN GHI SẼ ĐƯỢC ĐỒNG BỘ:\n";
    echo str_pad("Log ID", 8) . " | " . str_pad("Lead ID", 8) . " | " . str_pad("Tên Lead", 20) . " | " . str_pad("SĐT (Ẩn)", 12) . " | " . str_pad("Nguồn", 15) . " | " . str_pad("Trạng thái", 12) . " | " . str_pad("Ngày tạo Lead", 20) . " | " . str_pad("Ngày duyệt (cũ)", 20) . " | Lệch (ngày)\n";
    echo str_repeat("-", 140) . "\n";
    
    $previewSql = "SELECT dl.id as log_id, dl.lead_id, dl.status, l.created_at as lead_created, dl.received_at as log_received,
                          l.name as lead_name, l.phone as lead_phone, l.source as lead_source,
                          DATEDIFF(dl.received_at, l.created_at) as diff_days
                   FROM distribution_logs dl
                   JOIN leads l ON dl.lead_id = l.id
                   WHERE dl.status IN ('rejected', 'blacklisted') 
                     AND TIMESTAMPDIFF(SECOND, l.created_at, dl.received_at) > 60
                   ORDER BY dl.received_at DESC
                   LIMIT 20";
    
    $previewRes = $conn->query($previewSql);
    if ($previewRes) {
        while ($row = $previewRes->fetch_assoc()) {
            $maskedPhone = !empty($row['lead_phone']) ? substr($row['lead_phone'], 0, 4) . '***' . substr($row['lead_phone'], -3) : 'N/A';
            $nameCut = mb_strimwidth($row['lead_name'] ?? 'N/A', 0, 20, '...');
            $sourceCut = mb_strimwidth($row['lead_source'] ?? 'N/A', 0, 15, '...');
            
            echo str_pad($row['log_id'], 8) . " | " . 
                 str_pad($row['lead_id'], 8) . " | " . 
                 str_pad($nameCut, 20) . " | " . 
                 str_pad($maskedPhone, 12) . " | " . 
                 str_pad($sourceCut, 15) . " | " . 
                 str_pad($row['status'], 12) . " | " . 
                 str_pad($row['lead_created'], 20) . " | " . 
                 str_pad($row['log_received'], 20) . " | " . 
                 $row['diff_days'] . " ngày\n";
        }
    }
} else {
    echo "Chúc mừng! Không có bản ghi log phân bổ nào bị lệch múi giờ cần migrate.\n";
}

echo "\n------------------------------------------------------------------------\n";
echo "--- 2. THỐNG KÊ TICKET PHẢN HỒI LỖI (DATA REPORTS) ---\n";
// Kiểm tra xem có bao nhiêu ticket lỗi được phê duyệt
$ticketRes = $conn->query("SELECT status, COUNT(*) as cnt FROM data_reports GROUP BY status");
echo "Tổng số Ticket báo cáo lỗi:\n";
if ($ticketRes) {
    while ($row = $ticketRes->fetch_assoc()) {
        echo "  - Trạng thái '" . $row['status'] . "': " . $row['cnt'] . " ticket\n";
    }
}

$diffTicketRes = $conn->query("SELECT COUNT(*) as cnt 
                               FROM data_reports dr
                               JOIN leads l ON dr.lead_id = l.id
                               WHERE dr.status IN ('approved', 'rejected') 
                                 AND (DATE(dr.created_at) != DATE(l.created_at) OR DATE(dr.resolved_at) != DATE(l.created_at))");
$diffTickets = $diffTicketRes ? $diffTicketRes->fetch_assoc()['cnt'] : 0;
echo "\nSố Ticket đã giải quyết (duyệt/từ chối) bị lệch ngày so với ngày tạo Lead gốc (Sheets): $diffTickets ticket\n";

if ($diffTickets > 0) {
    echo "\nCHI TIẾT CÁC TICKET BỊ LỆCH NGÀY SO VỚI LEAD GỐC:\n";
    echo str_pad("Ticket ID", 10) . " | " . str_pad("Tên Lead", 20) . " | " . str_pad("SĐT (Ẩn)", 12) . " | " . str_pad("Trạng thái", 12) . " | " . str_pad("Ngày tạo Lead (Sheets)", 22) . " | " . str_pad("Ngày gửi Ticket", 20) . " | " . str_pad("Ngày duyệt", 20) . "\n";
    echo str_repeat("-", 140) . "\n";
    
    $ticketDetailSql = "SELECT dr.id as ticket_id, dr.status as ticket_status, l.name as lead_name, l.phone as lead_phone,
                               l.created_at as lead_created, dr.created_at as ticket_created, dr.resolved_at as ticket_resolved
                        FROM data_reports dr
                        JOIN leads l ON dr.lead_id = l.id
                        WHERE dr.status IN ('approved', 'rejected') 
                          AND (DATE(dr.created_at) != DATE(l.created_at) OR DATE(dr.resolved_at) != DATE(l.created_at))
                        ORDER BY l.created_at DESC";
                        
    $ticketDetailRes = $conn->query($ticketDetailSql);
    if ($ticketDetailRes) {
        while ($row = $ticketDetailRes->fetch_assoc()) {
            $maskedPhone = !empty($row['lead_phone']) ? substr($row['lead_phone'], 0, 4) . '***' . substr($row['lead_phone'], -3) : 'N/A';
            $nameCut = mb_strimwidth($row['lead_name'] ?? 'N/A', 0, 20, '...');
            
            echo str_pad($row['ticket_id'], 10) . " | " . 
                 str_pad($nameCut, 20) . " | " . 
                 str_pad($maskedPhone, 12) . " | " . 
                 str_pad($row['ticket_status'], 12) . " | " . 
                 str_pad($row['lead_created'], 22) . " | " . 
                 str_pad($row['ticket_created'], 20) . " | " . 
                 str_pad($row['ticket_resolved'], 20) . "\n";
        }
    }
}

echo "-> Lưu ý: Nhờ các câu query thống kê đã được sửa sang sử dụng cột 'created_at' thay vì 'resolved_at',\n";
echo "   tất cả $diffTickets ticket này đã tự động hiển thị chính xác theo ngày gửi trên dashboard mà không cần chỉnh sửa DB.\n";

echo "\n========================================================================\n";
echo "HƯỚNG DẪN CHẠY MIGRATION:\n";
echo "1. Nếu các thông tin trên chuẩn xác, hãy báo tôi để thêm migration vào file run_migrations.php\n";
echo "2. Hoặc bạn có thể tự cập nhật trực tiếp bảng log bằng các câu lệnh SQL sau:\n";
echo "   - Cập nhật log phân bổ (giam/blacklist/reject):\n";
echo "     UPDATE distribution_logs dl JOIN leads l ON dl.lead_id = l.id SET dl.received_at = l.created_at WHERE dl.status IN ('rejected', 'blacklisted') AND dl.received_at > l.created_at;\n";
echo "   - Cập nhật Ticket (approved/rejected):\n";
echo "     UPDATE data_reports dr JOIN leads l ON dr.lead_id = l.id SET dr.created_at = l.created_at, dr.resolved_at = l.created_at WHERE dr.status IN ('approved', 'rejected') AND (dr.created_at > l.created_at OR dr.resolved_at > l.created_at);\n";
echo "========================================================================\n";
