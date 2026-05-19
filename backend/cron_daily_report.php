<?php
require_once 'db_connect.php';
require_once 'zalo_bot.php';

// Hàm chạy báo cáo hàng ngày
function runDailyReportCron($conn) {
    $settingRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_daily_report_time', 'last_daily_report_date', 'zalo_bot_token')");
    $settings = [];
    if ($settingRes) {
        while ($row = $settingRes->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    $reportTime = $settings['zalo_daily_report_time'] ?? '17:00';
    if (empty($reportTime)) $reportTime = '17:00';
    $lastRunDate = $settings['last_daily_report_date'] ?? '';
    $botToken = $settings['zalo_bot_token'] ?? '';

    if (empty($botToken)) {
        return;
    }

    $today = date('Y-m-d');
    $currentTime = date('H:i');

    if ($lastRunDate !== $today && $currentTime >= $reportTime) {
        // 1. Mark as run
        $stmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_daily_report_date', ?)");
        $stmt->bind_param("s", $today);
        $stmt->execute();
        
        // 2. Lấy thống kê chia số
        $stmtData = $conn->query("
            SELECT c.name, COUNT(dl.id) as total 
            FROM distribution_logs dl 
            JOIN consultants c ON dl.assigned_to = c.id 
            WHERE dl.received_at >= CURDATE() AND dl.received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND dl.status IN ('assigned', 'compensation', 'error')
            GROUP BY c.id
        ");
        
        $saleStats = "";
        $saleStatsHtml = "";
        $totalData = 0;
        if ($stmtData) {
            while ($row = $stmtData->fetch_assoc()) {
                $saleStats .= "  • " . $row['name'] . ": " . $row['total'] . " data\n";
                $saleStatsHtml .= "<li><strong>" . htmlspecialchars($row['name']) . "</strong>: " . $row['total'] . " data</li>";
                $totalData += $row['total'];
            }
        }
        if (empty($saleStats)) {
            $saleStats = "  Hôm nay chưa chia data nào.\n";
            $saleStatsHtml = "<li>Hôm nay chưa chia data nào.</li>";
        }
        
        // 3. Lấy số ticket hôm nay
        $stmtTicket = $conn->query("
            SELECT COUNT(*) as total 
            FROM data_reports 
            WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        ");
        $totalTicket = 0;
        if ($stmtTicket && $row = $stmtTicket->fetch_assoc()) {
            $totalTicket = $row['total'];
        }
        
        // 4. Lấy danh sách admin
        $adminRes = $conn->query("SELECT email, name, zalo_chat_id FROM accounts WHERE role = 'admin' OR id = 1");
        $admins = [];
        if ($adminRes) {
            while ($row = $adminRes->fetch_assoc()) {
                $admins[] = $row;
            }
        }
        
        if (count($admins) > 0) {
            require_once 'mailer.php';
            
            $msg = "[ BÁO CÁO TỔNG KẾT NGÀY ]\n";
            $msg .= "Ngày " . date('d/m/Y') . "\n\n";
            $msg .= "❖ TỔNG QUAN CHIA SỐ: ($totalData data)\n";
            $msg .= $saleStats . "\n";
            $msg .= "❖ BÁO CÁO LỖI (TICKET):\n";
            $msg .= "  • Tổng ticket phát sinh: $totalTicket\n";
            
            foreach ($admins as $adm) {
                // Gửi Zalo
                if (!empty($botToken) && !empty($adm['zalo_chat_id'])) {
                    sendZaloMessage($botToken, $adm['zalo_chat_id'], $msg);
                }
                
                // Gửi Email
                if (!empty($adm['email'])) {
                    sendDailyReportEmailToAdmins(
                        $adm['email'],
                        $adm['name'] ?: 'Quản trị viên',
                        $totalData,
                        $saleStatsHtml,
                        $totalTicket
                    );
                }
            }
        }
    }
}

// Nếu gọi trực tiếp từ CLI
if (php_sapi_name() === 'cli') {
    runDailyReportCron($conn);
    $conn->close();
}
?>
