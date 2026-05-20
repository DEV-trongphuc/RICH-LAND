<?php
require_once 'db_connect.php';
require_once 'zalo_bot.php';

function runDailyReportCron($conn) {
    // --- PREVENT CONCURRENT EXECUTION ---
    $lockFile = __DIR__ . '/cron_daily_report.lock';
    $lockFp = fopen($lockFile, 'w');
    if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
        return; // Already running
    }
    
    // 0. Auto-resume consultants whose leave has ended
    $conn->query("
        UPDATE consultants 
        SET status = 'active', leave_start = NULL, leave_end = NULL 
        WHERE status = 'leave' AND leave_end IS NOT NULL AND leave_end < CURDATE()
    ");

    $settingRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_daily_report_time', 'last_daily_report_date', 'zalo_bot_token', 'daily_report_admins')");
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
        // 1. Mark as run FIRST to prevent double-sending
        $stmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_daily_report_date', ?)");
        $stmt->bind_param("s", $today);
        $stmt->execute();
        
        // 2. BUG-FIX: Dùng cửa sổ 24h trượt thay vì CURDATE() để tránh bỏ sót data 17:00 - 00:00
        // Nếu báo cáo gửi lúc 17:00, data được đếm từ 17:00 hôm qua đến 17:00 hôm nay
        $stmtData = $conn->query("
            SELECT c.name, COUNT(dl.id) as total 
            FROM distribution_logs dl 
            JOIN consultants c ON dl.assigned_to = c.id 
            WHERE dl.received_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
              AND dl.received_at <= NOW()
              AND dl.status IN ('assigned', 'compensation', 'error')
            GROUP BY c.id
            ORDER BY total DESC
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
        
        // 3. Lấy số ticket trong 24h trượt (cùng cửa sổ với data)
        $stmtTicket = $conn->query("
            SELECT COUNT(*) as total 
            FROM data_reports 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
              AND created_at <= NOW()
        ");
        $totalTicket = 0;
        if ($stmtTicket && $row = $stmtTicket->fetch_assoc()) {
            $totalTicket = $row['total'];
        }
        
        // 4. Lấy danh sách Admin nhận báo cáo
        // Ưu tiên danh sách đã được cấu hình; nếu chưa có thì gửi cho tất cả admin + super admin
        $adminIds = [];
        $dailyReportAdminsSetting = $settings['daily_report_admins'] ?? '';
        if (!empty($dailyReportAdminsSetting)) {
            $decoded = json_decode($dailyReportAdminsSetting, true);
            if (is_array($decoded) && count($decoded) > 0) {
                $adminIds = array_map('intval', $decoded);
            }
        }

        if (!empty($adminIds)) {
            $inPlaceholders = implode(',', array_fill(0, count($adminIds), '?'));
            $types = str_repeat('i', count($adminIds));
            $adminStmt = $conn->prepare("SELECT email, name, zalo_chat_id FROM accounts WHERE id IN ($inPlaceholders)");
            $adminStmt->bind_param($types, ...$adminIds);
            $adminStmt->execute();
            $adminRes = $adminStmt->get_result();
        } else {
            // Fallback: gửi tất cả Admin như trước
            $adminRes = $conn->query("SELECT email, name, zalo_chat_id FROM accounts WHERE role = 'admin' OR id = 1");
        }

        $admins = [];
        if ($adminRes) {
            while ($row = $adminRes->fetch_assoc()) {
                $admins[] = $row;
            }
        }
        
        if (count($admins) > 0) {
            require_once 'mailer.php';
            
            // Tạo nội dung cảnh báo cửa sổ thời gian
            $windowStart = date('H:i d/m/Y', strtotime('-24 hours'));
            $windowEnd = date('H:i d/m/Y');

            $msg = "[ BÁO CÁO TỔNG KẾT NGÀY ]\n";
            $msg .= "Kỳ báo cáo: $windowStart → $windowEnd\n\n";
            $msg .= "❖ TỔNG QUAN CHIA SỐ: ($totalData data)\n";
            $msg .= $saleStats . "\n";
            $msg .= "❖ BÁO CÁO LỖI (TICKET):\n";
            $msg .= "  • Tổng ticket phát sinh: $totalTicket\n";
            
            // Collect all Admin Zalo chat IDs for parallel batch execution
            $adminChatIds = [];
            foreach ($admins as $adm) {
                if (!empty($adm['zalo_chat_id'])) {
                    $adminChatIds[] = $adm['zalo_chat_id'];
                }
            }
            if (!empty($botToken) && !empty($adminChatIds)) {
                sendZaloMessageToMultiple($botToken, $adminChatIds, $msg);
            }
            
            foreach ($admins as $adm) {
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
