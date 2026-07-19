<?php
// backend/cron_monthly_report.php
// Auto monthly report cron job for Sales. Runs on the 1st of each month.

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/zalo_bot.php';
require_once __DIR__ . '/mailer.php';

// Đặt thời gian thực thi không giới hạn để tránh timeout
set_time_limit(0);

function runMonthlyReportCron($conn) {
    // --- PREVENT CONCURRENT EXECUTION ---
    $lockFile = sys_get_temp_dir() . '/cron_monthly_report_' . md5(__DIR__) . '.lock';
    $lockFp = @fopen($lockFile, 'w');
    if (!$lockFp) {
        echo "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Please check folder permissions. Exiting.\n";
        return;
    }
    if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
        fclose($lockFp);
        return; // Already running or locked
    }

    $settingRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_monthly_report_enabled', 'zalo_monthly_report_time', 'last_monthly_report_date', 'zalo_bot_token', 'last_monthly_report_timestamp')");
    $settings = [];
    if ($settingRes) {
        while ($row = $settingRes->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    $reportEnabled = (int)($settings['zalo_monthly_report_enabled'] ?? 0); // 0 = disabled, 1 = enabled
    if ($reportEnabled <= 0) {
        fclose($lockFp);
        return; // Monthly report is disabled
    }

    $reportTime = $settings['zalo_monthly_report_time'] ?? '08:00';
    if (empty($reportTime)) $reportTime = '08:00';
    
    $lastRunDate = $settings['last_monthly_report_date'] ?? '';
    $botToken = $settings['zalo_bot_token'] ?? '';

    $today = date('Y-m-d');
    $currentTime = date('H:i');
    $currentDayOfMonth = (int)date('j'); // Day of the month: 1 to 31

    // Check if it's the 1st of the month, scheduled time has arrived, and it hasn't run today
    if ($currentDayOfMonth === 1 && $lastRunDate !== $today && $currentTime >= $reportTime) {
        // Calculate previous calendar month start and end dates using mktime to avoid relative date parser issues
        $currentMonth = (int)date('n');
        $currentYear = (int)date('Y');
        $prevMonthTime = mktime(0, 0, 0, $currentMonth - 1, 1, $currentYear);
        
        $startTimestamp = date('Y-m-01 00:00:00', $prevMonthTime);
        $endTimestamp = date('Y-m-t 23:59:59', $prevMonthTime);

        // 1. Mark as run first to prevent double-sending
        $stmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_monthly_report_date', ?)");
        $stmt->bind_param("s", $today);
        $stmt->execute();
        $stmt->close();

        $stmtTs = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('last_monthly_report_timestamp', ?)");
        $stmtTs->bind_param("s", $endTimestamp);
        $stmtTs->execute();
        $stmtTs->close();

        // 2. Fetch all active or leave consultants (sales)
        $consultantRes = $conn->query("SELECT id, name, email, zalo_chat_id FROM consultants WHERE status IN ('active', 'leave')");
        if ($consultantRes) {
            while ($sale = $consultantRes->fetch_assoc()) {
                $saleEmail = $sale['email'];
                $saleZaloId = $sale['zalo_chat_id'];

                $report = generateMonthlyReportMessage($conn, $sale, $startTimestamp, $endTimestamp);

                // Nếu trong tháng không nhận được data nào thì không gửi báo cáo tự động cho Sale để tránh spam
                if ($report['totalData'] === 0) {
                    continue;
                }

                // Send Zalo Bot message to this Sale if linked
                if (!empty($botToken) && !empty($saleZaloId)) {
                    try {
                        sendZaloMessageToMultiple($botToken, [$saleZaloId], $report['msg'], false);
                    } catch (Exception $zaloEx) {
                        error_log("Failed to send Zalo monthly report to {$sale['name']}: " . $zaloEx->getMessage());
                    }
                }

                // Send Email to this Sale if email exists
                if (!empty($saleEmail)) {
                    try {
                        sendMonthlyReportEmailToSale(
                            $saleEmail,
                            $sale['name'],
                            $report['totalData'],
                            $report['roundTotal'],
                            $report['compensation'],
                            $report['reminderTotal'],
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
                        error_log("Failed to send monthly report email to {$saleEmail}: " . $mailEx->getMessage());
                    }
                }
            }
        }
    }
    
    fclose($lockFp);
}

// Nếu gọi trực tiếp từ CLI
if (php_sapi_name() === 'cli' && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    runMonthlyReportCron($conn);
    $conn->close();
}
?>
