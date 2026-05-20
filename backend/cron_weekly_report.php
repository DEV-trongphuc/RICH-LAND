<?php
require_once 'db_connect.php';
require_once 'zalo_bot.php';
require_once 'mailer.php';

function runWeeklyReportCron($conn) {
    // --- PREVENT CONCURRENT EXECUTION ---
    $lockFile = __DIR__ . '/cron_weekly_report.lock';
    $lockFp = fopen($lockFile, 'w');
    if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
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

                // Query total data received by this sale broken down by round in the time window
                $stmtData = $conn->prepare("
                    SELECT r.round_name, COUNT(dl.id) as total,
                           SUM(CASE WHEN dl.status = 'compensation' THEN 1 ELSE 0 END) as comp_received
                    FROM distribution_logs dl
                    JOIN distribution_rounds r ON dl.round_id = r.id
                    WHERE dl.assigned_to = ?
                      AND dl.received_at >= ?
                      AND dl.received_at <= ?
                      AND dl.status IN ('assigned', 'compensation')
                    GROUP BY dl.round_id
                ");
                $stmtData->bind_param("iss", $saleId, $startTimestamp, $endTimestamp);
                $stmtData->execute();
                $resData = $stmtData->get_result();

                $totalData = 0;
                $totalCompReceived = 0;
                $roundDetails = [];
                $roundDetailsHtml = '';
                
                while ($row = $resData->fetch_assoc()) {
                    $roundDetails[] = [
                        'name' => $row['round_name'],
                        'total' => (int)$row['total'],
                        'comp_received' => (int)$row['comp_received']
                    ];
                    $roundDetailsHtml .= '<li>Vòng <strong>' . htmlspecialchars($row['round_name']) . '</strong>: ' . (int)$row['total'] . ' data (trong đó đã đền bù: ' . (int)$row['comp_received'] . ')</li>';
                    $totalData += (int)$row['total'];
                    $totalCompReceived += (int)$row['comp_received'];
                }
                $stmtData->close();

                if ($totalData === 0) {
                    continue;
                }

                if (empty($roundDetailsHtml)) {
                    $roundDetailsHtml = '<li>Bạn không nhận được data nào trong tuần này.</li>';
                }

                // Query tickets (data_reports) raised by this sale in the time window
                $stmtTicket = $conn->prepare("
                    SELECT 
                        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_tickets,
                        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_tickets,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tickets
                    FROM data_reports
                    WHERE consultant_id = ?
                      AND created_at >= ?
                      AND created_at <= ?
                ");
                $stmtTicket->bind_param("iss", $saleId, $startTimestamp, $endTimestamp);
                $stmtTicket->execute();
                $resTicket = $stmtTicket->get_result()->fetch_assoc();
                $stmtTicket->close();

                $approvedTickets = (int)($resTicket['approved_tickets'] ?? 0);
                $rejectedTickets = (int)($resTicket['rejected_tickets'] ?? 0);
                $pendingTickets = (int)($resTicket['pending_tickets'] ?? 0);
                $totalTickets = $approvedTickets + $rejectedTickets + $pendingTickets;

                // Query current compensation settings (tổng bù còn lại) in all rounds for this consultant
                $stmtCompOwed = $conn->prepare("
                    SELECT SUM(compensation_count) as total_owed
                    FROM round_consultants
                    WHERE consultant_id = ?
                ");
                $stmtCompOwed->bind_param("i", $saleId);
                $stmtCompOwed->execute();
                $resCompOwed = $stmtCompOwed->get_result()->fetch_assoc();
                $stmtCompOwed->close();

                $totalCompOwed = (int)($resCompOwed['total_owed'] ?? 0);

                // Construct Zalo message content
                $msg = "[ BÁO CÁO TỔNG KẾT TUẦN CỦA BẠN ]\n";
                $msg .= "Kỳ báo cáo: $windowStart → $windowEnd\n";
                $msg .= "Xin chào $saleName,\n\n";
                $msg .= "❖ SỐ DATA ĐÃ NHẬN: ($totalData data)\n";
                if ($totalData > 0) {
                    foreach ($roundDetails as $rd) {
                        $msg .= "  • Vòng \"{$rd['name']}\": {$rd['total']} data (trong đó đã bù: {$rd['comp_received']})\n";
                    }
                } else {
                    $msg .= "  • Bạn chưa nhận data nào trong tuần này.\n";
                }
                $msg .= "\n❖ BÁO CÁO LỖI:\n";
                $msg .= "  • Tổng số ticket đã tạo: $totalTickets\n";
                $msg .= "  • Thành công (được duyệt): $approvedTickets\n";
                $msg .= "  • Thất bại (từ chối): $rejectedTickets\n";
                $msg .= "  • Chờ duyệt: $pendingTickets\n";
                $msg .= "\n❖ THÔNG TIN ĐỀN BÙ:\n";
                $msg .= "  • Số lượt đã bù tuần này: $totalCompReceived lượt\n";
                $msg .= "  • Số lượt đang chờ bù tiếp theo: $totalCompOwed lượt\n";

                // Send Zalo Bot message to this Sale if linked
                if (!empty($botToken) && !empty($saleZaloId)) {
                    sendZaloMessageToMultiple($botToken, [$saleZaloId], $msg);
                }

                // Send Email to this Sale if email exists
                if (!empty($saleEmail)) {
                    sendWeeklyReportEmailToSale(
                        $saleEmail,
                        $saleName,
                        $totalData,
                        $roundDetailsHtml,
                        $totalTickets,
                        $approvedTickets,
                        $rejectedTickets,
                        $pendingTickets,
                        $totalCompReceived,
                        $totalCompOwed,
                        $windowStart,
                        $windowEnd
                    );
                }
            }
        }
    }
    
    fclose($lockFp);
}

// Nếu gọi trực tiếp từ CLI
if (php_sapi_name() === 'cli') {
    runWeeklyReportCron($conn);
    $conn->close();
}
?>
