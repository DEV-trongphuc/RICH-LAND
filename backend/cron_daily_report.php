<?php
require_once 'db_connect.php';
require_once 'zalo_bot.php';

// Đặt thời gian thực thi không giới hạn để tránh timeout
set_time_limit(0);

function runDailyReportCron($conn)
{
    // --- PREVENT CONCURRENT EXECUTION ---
    $lockFile = sys_get_temp_dir() . '/cron_daily_report_' . md5(__DIR__) . '.lock';
    $lockFp = @fopen($lockFile, 'w');
    if (!$lockFp) {
        echo "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Please check folder permissions. Exiting.\n";
        return;
    }
    if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
        fclose($lockFp);
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
    if (empty($reportTime))
        $reportTime = '17:00';
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
            SELECT c.id, c.name, dl.status, COUNT(*) as cnt
            FROM distribution_logs dl 
            JOIN consultants c ON dl.assigned_to = c.id 
            WHERE dl.received_at >= ?
              AND dl.received_at <= ?
              AND dl.status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours', 'reminder')
            GROUP BY c.id, dl.status
        ");
        $stmtData->bind_param("ss", $startTimestamp, $endTimestamp);
        $stmtData->execute();
        $resData = $stmtData->get_result();

        $saleData = [];
        if ($resData) {
            while ($row = $resData->fetch_assoc()) {
                $cId = (int) $row['id'];
                if (!isset($saleData[$cId])) {
                    $saleData[$cId] = [
                        'name' => $row['name'],
                        'assigned' => 0,
                        'compensation' => 0,
                        'rule_6_month' => 0,
                        'pending_work_hours' => 0,
                        'error' => 0,
                        'reminder' => 0
                    ];
                }
                $status = $row['status'];
                $saleData[$cId][$status] = (int) $row['cnt'];
            }
        }
        $stmtData->close();

        $saleList = [];
        foreach ($saleData as $cId => $stats) {
            $normalTotal = $stats['assigned'] + $stats['compensation'] + $stats['rule_6_month'] + $stats['pending_work_hours'] + max(0, $stats['error'] - $stats['compensation']);
            $reminderTotal = $stats['reminder'];
            $saleList[] = [
                'name' => $stats['name'],
                'normal_total' => $normalTotal,
                'reminder_total' => $reminderTotal,
                'compensation' => $stats['compensation']
            ];
        }

        // Sort descending by normal_total, then reminder_total
        usort($saleList, function ($a, $b) {
            if ($b['normal_total'] !== $a['normal_total']) {
                return $b['normal_total'] <=> $a['normal_total'];
            }
            return $b['reminder_total'] <=> $a['reminder_total'];
        });

        $saleStats = "";
        $saleStatsHtml = "";
        $totalData = 0;
        $totalReminder = 0;
        foreach ($saleList as $saleItem) {
            $normalTotal = $saleItem['normal_total'];
            $reminderTotal = $saleItem['reminder_total'];
            $compensation = $saleItem['compensation'];
            $roundTotal = max(0, $normalTotal - $compensation);

            $saleStats .= "  👤 " . $saleItem['name'] . ": " . $normalTotal . " data\n";
            $saleStats .= "    └─ " . $roundTotal . " chia vòng\n";
            $saleStats .= "    └─ " . $compensation . " bù\n";
            $saleStats .= "    └─ " . $reminderTotal . " nhắc lại\n";

            $saleStatsHtml .= "<li><strong>👤 " . htmlspecialchars($saleItem['name']) . "</strong>: " . $normalTotal . " data<br>";
            $saleStatsHtml .= " &nbsp;&nbsp;└─ " . $roundTotal . " chia vòng<br>";
            $saleStatsHtml .= " &nbsp;&nbsp;└─ " . $compensation . " bù<br>";
            $saleStatsHtml .= " &nbsp;&nbsp;└─ " . $reminderTotal . " nhắc lại</li>";

            $totalData += $normalTotal;
            $totalReminder += $reminderTotal;
        }
        if (empty($saleStats)) {
            $saleStats = "  Kỳ báo cáo này chưa chia data nào.\n";
            $saleStatsHtml = "<li>Kỳ báo cáo này chưa chia data nào.</li>";
        }

        // 3. Lấy số ticket trong kỳ báo cáo (cùng cửa sổ với data)
        $stmtTicket = $conn->prepare("
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status IN ('approved', 'approved_no_comp') THEN 1 ELSE 0 END) as approved_count,
                   SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                   SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
            FROM data_reports 
            WHERE created_at >= ?
              AND created_at <= ?
        ");
        $stmtTicket->bind_param("ss", $startTimestamp, $endTimestamp);
        $stmtTicket->execute();
        $resTicket = $stmtTicket->get_result();
        $totalTicket = 0;
        $approvedTicket = 0;
        $rejectedTicket = 0;
        $pendingTicket = 0;
        if ($resTicket && $row = $resTicket->fetch_assoc()) {
            $totalTicket = (int) $row['total'];
            $approvedTicket = (int) ($row['approved_count'] ?? 0);
            $rejectedTicket = (int) ($row['rejected_count'] ?? 0);
            $pendingTicket = (int) ($row['pending_count'] ?? 0);
        }
        $stmtTicket->close();

        // 3.5 Lấy số data bị chặn trong kỳ báo cáo (blacklist)
        $totalBlocked = 0;
        $stmtBlocked = $conn->prepare("
            SELECT COUNT(*) as total
            FROM admin_logs
            WHERE action = 'BLOCK_LEAD_BLACKLIST'
              AND created_at >= ?
              AND created_at <= ?
        ");
        if ($stmtBlocked) {
            $stmtBlocked->bind_param("ss", $startTimestamp, $endTimestamp);
            $stmtBlocked->execute();
            $resBlocked = $stmtBlocked->get_result();
            if ($resBlocked && $row = $resBlocked->fetch_assoc()) {
                $totalBlocked = (int) $row['total'];
            }
            $stmtBlocked->close();
        }

        // 3.7 Lấy số data bị AI tạm giữ và dưới chuẩn trong kỳ báo cáo
        $totalHeldByAI = 0;
        $totalBelowStandard = 0;

        $stmtScreenerStats = $conn->prepare("
            SELECT 
                SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) as held_count,
                SUM(CASE WHEN status IN ('pending_approval', 'rejected', 'blacklisted') THEN 1 ELSE 0 END) as below_std_count
            FROM leads
            WHERE created_at >= ?
              AND created_at <= ?
        ");
        if ($stmtScreenerStats) {
            $stmtScreenerStats->bind_param("ss", $startTimestamp, $endTimestamp);
            $stmtScreenerStats->execute();
            $resScreenerStats = $stmtScreenerStats->get_result();
            if ($resScreenerStats && $row = $resScreenerStats->fetch_assoc()) {
                $totalHeldByAI = (int) ($row['held_count'] ?? 0);
                $totalBelowStandard = (int) ($row['below_std_count'] ?? 0);
            }
            $stmtScreenerStats->close();
        }

        // Lấy tổng số lượng hiện tại (toàn bộ thời gian) đang chờ xử lý
        $totalHoldingGlobal = 0;
        $resH = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE status = 'pending_approval'");
        if ($resH) {
            $totalHoldingGlobal = (int)$resH->fetch_assoc()['cnt'];
        }

        $totalPendingTicketsGlobal = 0;
        $resP = $conn->query("SELECT COUNT(*) as cnt FROM data_reports WHERE status = 'pending'");
        if ($resP) {
            $totalPendingTicketsGlobal = (int)$resP->fetch_assoc()['cnt'];
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
        if (isset($adminStmt))
            $adminStmt->close();

        if (count($admins) > 0) {
            require_once 'mailer.php';

            // Tạo nội dung cảnh báo cửa sổ thời gian
            $windowStart = date('H:i d/m/Y', strtotime($startTimestamp));
            $windowEnd = date('H:i d/m/Y', strtotime($endTimestamp));

            $msg = "📊 [ BÁO CÁO TỔNG KẾT NGÀY ]\n";
            $msg .= "⏱️ Kỳ báo cáo: $windowStart → $windowEnd\n\n";
            $msg .= "📥 TỔNG QUAN CHIA SỐ:\n";
            if ($totalReminder > 0) {
                $msg .= "   (Tổng số data: " . $totalData . " data | Nhắc lại: " . $totalReminder . ")\n";
            } else {
                $msg .= "   ($totalData data)\n";
            }
            $msg .= "----------\n";
            $msg .= $saleStats . "\n";
            $msg .= "🤖 AI PRE-SCREENER:\n";
            $msg .= "  • Số lead bị AI tạm giữ: $totalHeldByAI\n";
            $msg .= "  • Số lead dưới chuẩn: $totalBelowStandard\n";
            $msg .= "  • Tổng AI đang giữ hiện tại: $totalHoldingGlobal\n\n";
            $msg .= "🎫 BÁO CÁO LỖI (TICKET):\n";
            if ($totalTicket > 0) {
                $msg .= "  • Tổng ticket phát sinh: $totalTicket ⚠️\n";
                $msg .= "    (Đã duyệt: $approvedTicket | Từ chối: $rejectedTicket | Chờ duyệt: $pendingTicket)\n";
            } else {
                $msg .= "  • Tổng ticket phát sinh: 0\n";
            }
            $msg .= "  • Tổng ticket đang chờ hiện tại: $totalPendingTicketsGlobal\n\n";
            $msg .= "CHẶN DATA (BLACKLIST):\n";
            $msg .= "  • Tổng số data bị chặn: $totalBlocked\n\n";
            $msg .= "----------\n";
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
                        $totalReminder,
                        $approvedTicket,
                        $rejectedTicket,
                        $pendingTicket,
                        $totalBlocked,
                        $totalHeldByAI,
                        $totalBelowStandard
                    );
                }
            }
        }

        // 4. Prune old system logs (admin_logs, communication_logs) daily
        pruneAdminLogs($conn);
    }
}

// Nếu gọi trực tiếp từ CLI
if (php_sapi_name() === 'cli' && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    runDailyReportCron($conn);
    $conn->close();
}
?>