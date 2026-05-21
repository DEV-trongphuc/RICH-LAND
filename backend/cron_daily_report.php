<?php
require_once 'db_connect.php';
require_once 'zalo_bot.php';

function runDailyReportCron($conn) {
    // --- PREVENT CONCURRENT EXECUTION ---
    $lockFile = __DIR__ . '/cron_daily_report.lock';
    $lockFp = fopen($lockFile, 'w');
    if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
        if ($lockFp) fclose($lockFp);
        return; // Already running
    }
    
    // 0. Auto-resume consultants whose leave has ended
    $conn->query("
        UPDATE consultants 
        SET status = 'active', leave_start = NULL, leave_end = NULL 
        WHERE status = 'leave' AND leave_end IS NOT NULL AND leave_end < CURDATE()
    ");

    $settingRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_daily_report_time', 'last_daily_report_date', 'zalo_bot_token', 'daily_report_admins', 'last_daily_report_timestamp')");
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
        $endTimestamp = date('Y-m-d H:i:s');
        $lastReportTimestamp = $settings['last_daily_report_timestamp'] ?? '';
        $startTimestamp = !empty($lastReportTimestamp) ? $lastReportTimestamp : date('Y-m-d H:i:s', strtotime('-24 hours'));

        // 1. Mark as run FIRST to prevent double-sending
        $stmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_daily_report_date', ?)");
        $stmt->bind_param("s", $today);
        $stmt->execute();
        $stmt->close();

        $stmtTs = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_daily_report_timestamp', ?)");
        $stmtTs->bind_param("s", $endTimestamp);
        $stmtTs->execute();
        $stmtTs->close();
        
        // 2. Dùng cửa sổ thời gian từ lần chạy báo cáo trước đến nay để tránh bỏ sót hoặc trùng lặp data
        $stmtData = $conn->prepare("
            SELECT c.name, 
                   SUM(CASE WHEN dl.status IN ('assigned', 'compensation', 'error') THEN 1 ELSE 0 END) as normal_total,
                   SUM(CASE WHEN dl.status = 'reminder' THEN 1 ELSE 0 END) as reminder_total
            FROM distribution_logs dl 
            JOIN consultants c ON dl.assigned_to = c.id 
            WHERE dl.received_at >= ?
              AND dl.received_at <= ?
              AND dl.status IN ('assigned', 'compensation', 'error', 'reminder')
            GROUP BY c.id
            ORDER BY normal_total DESC, reminder_total DESC
        ");
        $stmtData->bind_param("ss", $startTimestamp, $endTimestamp);
        $stmtData->execute();
        $resData = $stmtData->get_result();
        
        $saleStats = "";
        $saleStatsHtml = "";
        $totalData = 0;
        $totalReminder = 0;
        if ($resData) {
            while ($row = $resData->fetch_assoc()) {
                $normalTotal = (int)$row['normal_total'];
                $reminderTotal = (int)$row['reminder_total'];
                
                $saleStats .= "  👤 " . $row['name'] . ": " . $normalTotal . " data\n";
                $saleStatsHtml .= "<li><strong>👤 " . htmlspecialchars($row['name']) . "</strong>: " . $normalTotal . " data";
                
                if ($reminderTotal > 0) {
                    $saleStats .= "     ↳ 🔄 Nhắc lại: " . $reminderTotal . "\n";
                    $saleStatsHtml .= "<br/><span style=\"color: #64748b; font-size: 13px; margin-left: 15px;\">↳ 🔄 Nhắc lại: " . $reminderTotal . "</span>";
                }
                
                $saleStatsHtml .= "</li>";
                $totalData += $normalTotal;
                $totalReminder += $reminderTotal;
            }
        }
        $stmtData->close();
        if (empty($saleStats)) {
            $saleStats = "  Kỳ báo cáo này chưa chia data nào.\n";
            $saleStatsHtml = "<li>Kỳ báo cáo này chưa chia data nào.</li>";
        }
        
        // 3. Lấy số ticket trong kỳ báo cáo (cùng cửa sổ với data)
        $stmtTicket = $conn->prepare("
            SELECT COUNT(*) as total 
            FROM data_reports 
            WHERE created_at >= ?
              AND created_at <= ?
        ");
        $stmtTicket->bind_param("ss", $startTimestamp, $endTimestamp);
        $stmtTicket->execute();
        $resTicket = $stmtTicket->get_result();
        $totalTicket = 0;
        if ($resTicket && $row = $resTicket->fetch_assoc()) {
            $totalTicket = $row['total'];
        }
        $stmtTicket->close();
        
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
        if (isset($adminStmt)) $adminStmt->close();
        
        if (count($admins) > 0) {
            require_once 'mailer.php';
            
            // Tạo nội dung cảnh báo cửa sổ thời gian
            $windowStart = date('H:i d/m/Y', strtotime($startTimestamp));
            $windowEnd = date('H:i d/m/Y', strtotime($endTimestamp));

            $msg = "📊 [ BÁO CÁO TỔNG KẾT NGÀY ]\n";
            $msg .= "⏱️ Kỳ báo cáo: $windowStart → $windowEnd\n\n";
            $msg .= "📥 TỔNG QUAN CHIA SỐ:\n";
            if ($totalReminder > 0) {
                $msg .= "   (Tổng cộng: " . ($totalData + $totalReminder) . " | Chia số: " . $totalData . " | Nhắc lại: " . $totalReminder . ")\n";
            } else {
                $msg .= "   ($totalData data)\n";
            }
            $msg .= "------------------------------\n";
            $msg .= $saleStats . "\n";
            $msg .= "🎫 BÁO CÁO LỖI (TICKET):\n";
            $msg .= "  • Tổng ticket phát sinh: $totalTicket" . ($totalTicket > 0 ? " ⚠️" : "") . "\n\n";
            $msg .= "-------------------\n";
            $msg .= "💡 Gõ /report dd/mm hoặc /report dd/mm to dd/mm để xem báo cáo.\n";
            $msg .= "💡 Gõ /tools để xem thêm các câu lệnh nhanh.";
            
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
                        $totalTicket,
                        $totalReminder
                    );
                }
            }
        }
    }
}

// Nếu gọi trực tiếp từ CLI
if (php_sapi_name() === 'cli' && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    runDailyReportCron($conn);
    $conn->close();
}
?>
