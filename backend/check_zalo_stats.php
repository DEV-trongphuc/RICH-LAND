<?php
// backend/check_zalo_stats.php
// Script to audit Zalo/Email database statistics for the user.

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/html; charset=utf-8");

echo "<html><head><title>Kiểm tra Thống kê Zalo/Email</title>";
echo "<style>
    body { font-family: sans-serif; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; color: #334155; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: bold; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #e2e8f0; }
</style></head><body>";

echo "<h1>📊 Kiểm tra Thống kê Zalo & Email trong Cơ sở dữ liệu</h1>";

// 1. Leads Stats
echo "<div class='card'>";
echo "<h3>1. Thống kê bảng khách hàng (leads)</h3>";
echo "<table>";
echo "<tr><th>Chỉ số</th><th>Số lượng</th></tr>";

$res = $conn->query("SELECT COUNT(*) as cnt FROM leads");
echo "<tr><td>Tổng số leads trong hệ thống (Tất cả thời gian)</td><td><strong>" . number_format($res->fetch_assoc()['cnt']) . "</strong></td></tr>";

$res = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE created_at >= DATE_SUB(NOW(), INTERVAL 10 DAY)");
echo "<tr><td>Số leads được tạo mới trong 10 ngày qua</td><td><strong>" . number_format($res->fetch_assoc()['cnt']) . "</strong></td></tr>";

$res = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE zalo_notify_status = 'sent'");
echo "<tr><td>Leads có zalo_notify_status = 'sent' (Tất cả thời gian)</td><td><strong>" . number_format($res->fetch_assoc()['cnt']) . "</strong></td></tr>";

$res = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE zalo_notify_status = 'sent' AND created_at >= DATE_SUB(NOW(), INTERVAL 10 DAY)");
echo "<tr><td>Leads có zalo_notify_status = 'sent' được tạo trong 10 ngày qua</td><td><strong>" . number_format($res->fetch_assoc()['cnt']) . "</strong></td></tr>";

$res = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE email_notify_status = 'sent'");
echo "<tr><td>Leads có email_notify_status = 'sent' (Tất cả thời gian)</td><td><strong>" . number_format($res->fetch_assoc()['cnt']) . "</strong></td></tr>";

$res = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE email_notify_status = 'sent' AND created_at >= DATE_SUB(NOW(), INTERVAL 10 DAY)");
echo "<tr><td>Leads có email_notify_status = 'sent' được tạo trong 10 ngày qua</td><td><strong>" . number_format($res->fetch_assoc()['cnt']) . "</strong></td></tr>";

echo "</table>";
echo "</div>";

// 2. Queue Stats
echo "<div class='card'>";
echo "<h3>2. Thống kê bảng Hàng đợi Zalo (zalo_queue)</h3>";
echo "<table>";
echo "<tr><th>Trạng thái (status)</th><th>Số lượng bản ghi</th></tr>";
$res = $conn->query("SELECT status, COUNT(*) as cnt FROM zalo_queue GROUP BY status");
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo "<tr><td><span class='badge'>" . htmlspecialchars($row['status']) . "</span></td><td><strong>" . number_format($row['cnt']) . "</strong></td></tr>";
    }
} else {
    echo "<tr><td colspan='2'>Không có bản ghi nào trong zalo_queue</td></tr>";
}
echo "</table>";
echo "</div>";

echo "<div class='card'>";
echo "<h3>3. Thống kê bảng Hàng đợi Email (mail_queue)</h3>";
echo "<table>";
echo "<tr><th>Trạng thái (status)</th><th>Số lượng bản ghi</th></tr>";
$res = $conn->query("SELECT status, COUNT(*) as cnt FROM mail_queue GROUP BY status");
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo "<tr><td><span class='badge'>" . htmlspecialchars($row['status']) . "</span></td><td><strong>" . number_format($row['cnt']) . "</strong></td></tr>";
    }
} else {
    echo "<tr><td colspan='2'>Không có bản ghi nào trong mail_queue</td></tr>";
}
echo "</table>";
echo "</div>";

// 3. Log Stats
echo "<div class='card'>";
echo "<h3>4. Thống kê bảng Nhật ký Giao tiếp (communication_logs)</h3>";
echo "<table>";
echo "<tr><th>Loại (type)</th><th>Trạng thái (status)</th><th>Số lượng</th></tr>";
$res = $conn->query("SELECT type, status, COUNT(*) as cnt FROM communication_logs GROUP BY type, status");
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo "<tr><td>" . htmlspecialchars(strtoupper($row['type'])) . "</td><td><span class='badge'>" . htmlspecialchars($row['status']) . "</span></td><td><strong>" . number_format($row['cnt']) . "</strong></td></tr>";
    }
} else {
    echo "<tr><td colspan='3'>Không có bản ghi nào trong communication_logs</td></tr>";
}
echo "</table>";
echo "</div>";

echo "</body></html>";
