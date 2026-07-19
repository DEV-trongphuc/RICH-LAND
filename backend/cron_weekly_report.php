<?php
require_once 'db_connect.php';
require_once 'zalo_bot.php';
require_once 'mailer.php';

// Đặt thời gian thực thi không giới hạn để tránh timeout
set_time_limit(0);

function runWeeklyReportCron($conn) {
    // --- PREVENT CONCURRENT EXECUTION ---
    $lockFile = sys_get_temp_dir() . '/cron_weekly_report_' . md5(__DIR__) . '.lock';
    $lockFp = @fopen($lockFile, 'w');
    if (!$lockFp) {
        echo "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Please check folder permissions. Exiting.\n";
        return;
    }
    if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
        fclose($lockFp);
        return; // Already running or locked
    }

    $settingRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_weekly_report_day', 'zalo_weekly_report_time', 'last_weekly_report_date', 'zalo_bot_token', 'last_weekly_report_timestamp')");
    $settings = [];
    if ($settingRes) {
        while ($row = $settingRes->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    $reportDay = (int)($settings['zalo_weekly_report_day'] ?? 0); // 0 = disabled, 1 = Mon, ..., 7 = Sun
    if ($reportDay <= 0 || $reportDay > 7) {
        fclose($lockFp);
        return; // Weekly report is disabled
    }

    $reportTime = $settings['zalo_weekly_report_time'] ?? '08:00';
    if (empty($reportTime)) $reportTime = '08:00';
    
    $lastRunDate = $settings['last_weekly_report_date'] ?? '';
    $botToken = $settings['zalo_bot_token'] ?? '';

    $today = date('Y-m-d');
    $currentTime = date('H:i');
    $currentDayOfWeek = (int)date('N'); // 1 = Mon, ..., 7 = Sun

    // Check if it's the scheduled day of the week, the scheduled time has arrived, and it hasn't run today
    if ($currentDayOfWeek === $reportDay && $lastRunDate !== $today && $currentTime >= $reportTime) {
        $endTimestamp = date('Y-m-d H:i:s');
        
        // Calculate start timestamp
        $lastWeeklyReportTimestamp = $settings['last_weekly_report_timestamp'] ?? '';
        if (!empty($lastWeeklyReportTimestamp)) {
            $startTimestamp = $lastWeeklyReportTimestamp;
        } else {
            // Default to last week's selected day of week at 00:00:00
            $startTimestamp = date('Y-m-d H:i:s', strtotime('-7 days 00:00:00'));
        }

        // 1. Mark as run first to prevent double-sending
        $stmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_weekly_report_date', ?)");
        $stmt->bind_param("s", $today);
        $stmt->execute();
        $stmt->close();

        $stmtTs = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_weekly_report_timestamp', ?)");
        $stmtTs->bind_param("s", $endTimestamp);
        $stmtTs->execute();
        $stmtTs->close();

        // Fetch frontend URL for portal link
        $frontendUrl = '';
        $urlRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key='frontend_url' LIMIT 1");
        if ($urlRes && $urlRes->num_rows > 0) {
            $frontendUrl = rtrim($urlRes->fetch_assoc()['setting_value'], '/');
        }
        if (empty($frontendUrl)) {
            $frontendUrl = 'http://localhost:5173'; // Fallback
        }
        $portalUrl = $frontendUrl . '/sale-portal';

        // 2. Fetch all active or leave consultants (sales)
        $consultantRes = $conn->query("SELECT id, name, email, zalo_chat_id FROM consultants WHERE status IN ('active', 'leave')");
        if ($consultantRes) {
            $windowStart = date('H:i d/m/Y', strtotime($startTimestamp));
            $windowEnd = date('H:i d/m/Y', strtotime($endTimestamp));

            while ($sale = $consultantRes->fetch_assoc()) {
                $saleId = $sale['id'];
                $saleName = $sale['name'];
                $saleEmail = $sale['email'];
                $saleZaloId = $sale['zalo_chat_id'];

                $report = generateWeeklyReportMessage($conn, $sale, $startTimestamp, $endTimestamp);

                // Nếu trong tuần không nhận được data nào thì không gửi báo cáo tự động cho Sale để tránh spam
                if ($report['totalData'] === 0) {
                    continue;
                }

                // Send Zalo Bot message to this Sale if linked
                if (!empty($botToken) && !empty($saleZaloId)) {
                    try {
                        sendZaloMessageToMultiple($botToken, [$saleZaloId], $report['msg'], false);
                    } catch (Exception $zaloEx) {
                        error_log("Failed to send Zalo weekly report to {$saleName}: " . $zaloEx->getMessage());
                    }
                }

                // Send Email to this Sale if email exists
                if (!empty($saleEmail)) {
                    try {
                        sendWeeklyReportEmailToSale(
                            $saleEmail,
                            $saleName,
                            $report['totalData'],
                            $report['roundDetailsHtml'],
                            $report['totalTickets'],
                            $report['approvedTickets'],
                            $report['rejectedTickets'],
                            $report['pendingTickets'],
                            $report['totalCompReceived'],
                            $report['totalCompOwed'],
                            $report['windowStart'],
                            $report['windowEnd']
                        );
                    } catch (Exception $mailEx) {
                        error_log("Failed to send weekly report email to {$saleEmail}: " . $mailEx->getMessage());
                    }
                }
            }
        }
    }
    
    fclose($lockFp);
}

// Nếu gọi trực tiếp từ CLI
if (php_sapi_name() === 'cli' && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    runWeeklyReportCron($conn);
    $conn->close();
}
?>
