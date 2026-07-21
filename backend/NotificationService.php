<?php
// backend/NotificationService.php

class NotificationService {

    /**
     * Dispatch notification across all 4 independent channels (In-App Bell, Zalo Bot, Telegram Bot, Email)
     * 
     * @param PDO $db
     * @param int $tenantId
     * @param string $eventType e.g. 'CHECKIN_LATE', 'ATTENDANCE_UPDATE', 'ATTENDANCE_APPROVAL', 'EXPENSE_REQUEST', 'TICKET_NEW'
     * @param array $payload Event specific details
     */
    public static function send(PDO $db, int $tenantId, string $eventType, array $payload): void {
        try {
            $resolved = self::resolveEventData($db, $tenantId, $eventType, $payload);
            if (!$resolved) {
                return;
            }

            $recipients = $resolved['recipients'] ?? [];
            $title = $resolved['title'] ?? 'Thông báo hệ thống';
            $body = $resolved['body'] ?? '';
            $type = $resolved['type'] ?? 'attendance';
            $link = $resolved['link'] ?? '/';
            $zaloMsg = $resolved['zalo_msg'] ?? '';
            $tgMsg = $resolved['tg_msg'] ?? '';
            $emailSubject = $resolved['email_subject'] ?? '';
            $emailTitle = $resolved['email_title'] ?? '';
            $emailContent = $resolved['email_content'] ?? '';

            // ==================== CHANNEL 1: IN-APP NOTIFICATION BELL ====================
            try {
                if (!empty($recipients)) {
                    $insertNotif = $db->prepare("
                        INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    foreach ($recipients as $rec) {
                        if (!empty($rec['id'])) {
                            $insertNotif->execute([$rec['id'], $tenantId, $title, $body, $type, $link]);
                        }
                    }
                }
            } catch (\Throwable $bellEx) {
                error_log("NotificationService Bell Error: " . $bellEx->getMessage());
            }

            // Fetch recipients' matrix configurations from database
            $recipientIds = array_filter(array_map(fn($r) => (int)($r['id'] ?? 0), $recipients));
            $userConfigs = [];
            if (!empty($recipientIds)) {
                try {
                    $inPlace = implode(',', array_fill(0, count($recipientIds), '?'));
                    $stmtCfg = $db->prepare("SELECT user_id, matrix_config FROM user_notification_settings WHERE user_id IN ($inPlace)");
                    $stmtCfg->execute(array_values($recipientIds));
                    while ($cRow = $stmtCfg->fetch(PDO::FETCH_ASSOC)) {
                        if (!empty($cRow['matrix_config'])) {
                            $userConfigs[(int)$cRow['user_id']] = json_decode($cRow['matrix_config'], true);
                        }
                    }
                } catch (\Throwable $cfgEx) {}
            }

            // Helper lambda to check if a specific channel is enabled for a user for this eventType
            $isChannelEnabled = function(int $userId, string $channel) use ($userConfigs, $eventType): bool {
                if (!isset($userConfigs[$userId][$eventType])) {
                    return true; // Default behavior: Enabled
                }
                $evtCfg = $userConfigs[$userId][$eventType];
                if (isset($evtCfg['master']) && !$evtCfg['master']) {
                    return false; // Master switch OFF for this event
                }
                if (isset($evtCfg[$channel])) {
                    return (bool)$evtCfg[$channel];
                }
                return true;
            };

            // Fetch system settings for Zalo and Telegram group configuration
            $stmtGSettings = $db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_admin_group_chat_id', 'zalo_notify_only_group', 'telegram_admin_group_chat_id', 'telegram_notify_only_group', 'zalo_bot_token', 'telegram_bot_token')");
            $stmtGSettings->execute();
            $gSettings = $stmtGSettings->fetchAll(PDO::FETCH_KEY_PAIR);

            $zaloBotToken = trim((string)($gSettings['zalo_bot_token'] ?? ''));
            $zaloGroupChatId = trim((string)($gSettings['zalo_admin_group_chat_id'] ?? ''));
            $zaloOnlyGroup = ($gSettings['zalo_notify_only_group'] ?? '0') === '1';

            $tgBotToken = trim((string)($gSettings['telegram_bot_token'] ?? ''));
            $tgGroupChatId = trim((string)($gSettings['telegram_admin_group_chat_id'] ?? ''));
            $tgOnlyGroup = ($gSettings['telegram_notify_only_group'] ?? '0') === '1';

            // ==================== CHANNEL 2: ZALO BOT (INDEPENDENT) ====================
            try {
                if ($zaloBotToken && !empty($zaloMsg)) {
                    require_once __DIR__ . '/zalo_bot.php';

                    $zaloChatIds = [];
                    // Group Chat ID (only if set in settings)
                    if (!empty($zaloGroupChatId)) {
                        $zaloChatIds[] = $zaloGroupChatId;
                    }
                    // Individual Chat IDs (if not strictly only_group and channel enabled by user)
                    if (!$zaloOnlyGroup) {
                        foreach ($recipients as $rec) {
                            $rId = (int)($rec['id'] ?? 0);
                            if (!empty($rec['zalo_chat_id']) && $isChannelEnabled($rId, 'zalo')) {
                                $zaloChatIds[] = trim($rec['zalo_chat_id']);
                            }
                        }
                    }

                    $zaloChatIds = array_unique(array_filter($zaloChatIds));

                    foreach ($zaloChatIds as $zId) {
                        try {
                            sendZaloMessage($zaloBotToken, $zId, $zaloMsg, true);
                        } catch (\Throwable $ze) {
                            error_log("NotificationService Zalo send error ($zId): " . $ze->getMessage());
                        }
                    }
                }
            } catch (\Throwable $zEx) {
                error_log("NotificationService Zalo Channel Error: " . $zEx->getMessage());
            }

            // ==================== CHANNEL 3: TELEGRAM BOT (INDEPENDENT) ====================
            try {
                if ($tgBotToken && !empty($tgMsg)) {
                    require_once __DIR__ . '/telegram_bot.php';

                    $tgChatIds = [];
                    // Group Chat ID (only if set in settings)
                    if (!empty($tgGroupChatId)) {
                        $tgChatIds[] = $tgGroupChatId;
                    }
                    // Individual Chat IDs (if not strictly only_group and channel enabled by user)
                    if (!$tgOnlyGroup) {
                        foreach ($recipients as $rec) {
                            $rId = (int)($rec['id'] ?? 0);
                            if (!empty($rec['telegram_chat_id']) && $isChannelEnabled($rId, 'telegram')) {
                                $tgChatIds[] = trim($rec['telegram_chat_id']);
                            }
                        }
                    }

                    $tgChatIds = array_unique(array_filter($tgChatIds));

                    foreach ($tgChatIds as $cId) {
                        try {
                            sendTelegramMessage($tgBotToken, $cId, $tgMsg);
                        } catch (\Throwable $tge) {
                            error_log("NotificationService Telegram send error ($cId): " . $tge->getMessage());
                        }
                    }
                }
            } catch (\Throwable $tgEx) {
                error_log("NotificationService Telegram Channel Error: " . $tgEx->getMessage());
            }

            // ==================== CHANNEL 4: EMAIL SMTP (INDEPENDENT VIA MAIL QUEUE) ====================
            try {
                if (!empty($emailSubject) && !empty($emailContent)) {
                    require_once __DIR__ . '/mailer.php';
                    foreach ($recipients as $rec) {
                        $rId = (int)($rec['id'] ?? 0);
                        if (!empty($rec['email']) && $isChannelEnabled($rId, 'email')) {
                            try {
                                sendEmailNotification($rec['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                            } catch (\Throwable $ee) {
                                error_log("NotificationService Email send error (" . $rec['email'] . "): " . $ee->getMessage());
                            }
                        }
                    }
                }
            } catch (\Throwable $emEx) {
                error_log("NotificationService Email Channel Error: " . $emEx->getMessage());
            }

        } catch (\Throwable $outerEx) {
            error_log("NotificationService Global Dispatch Error: " . $outerEx->getMessage());
        }
    }

    /**
     * Resolve event templates and recipient accounts
     */
    private static function resolveEventData(PDO $db, int $tenantId, string $eventType, array $payload): ?array {
        $userName = $payload['user_name'] ?? 'Nhân viên';
        $today = $payload['date'] ?? date('Y-m-d');
        $time = $payload['time'] ?? date('H:i');
        $reason = $payload['reason'] ?? 'Không có';

        switch ($eventType) {
            case 'CHECKIN_LATE':
                $recipients = self::getAdminsAndManagers($db, $tenantId, $payload['team_id'] ?? null);
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu duyệt đi trễ",
                    'body' => "Nhân viên " . $userName . " đã check-in trễ lúc " . substr($time, 0, 5) . " và gửi lý do: \"" . $reason . "\"",
                    'type' => "attendance",
                    'link' => "/attendance?view=calendar&date=" . $today,
                    'zalo_msg' => "⏰ [ YÊU CẦU DUYỆT ĐI TRỄ ]\n\n"
                        . "Nhân viên $userName vừa báo cáo đi trễ ngày $today:\n"
                        . "  • Tên NV: $userName\n"
                        . "  • Thời gian: " . substr($time, 0, 5) . "\n"
                        . "  • Lý do: \"$reason\"\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "⏰ <b>[ YÊU CẦU DUYỆT ĐI TRỄ ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa báo cáo đi trễ ngày <code>$today</code>:\n"
                        . "  • Tên NV: <b>$userName</b>\n"
                        . "  • Thời gian: <code>" . substr($time, 0, 5) . "</code>\n"
                        . "  • Lý do: <i>\"$reason\"</i>\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[RICH LAND] Yêu cầu phê duyệt đi trễ - NV $userName",
                    'email_title' => "DUYỆT YÊU CẦU ĐI TRỄ",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa check-in trễ giờ quy định lúc " . substr($time, 0, 5) . " ngày $today.<br/>" .
                                    "Lý do đi trễ: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'ATTENDANCE_UPDATE':
                $recipients = self::getAdminsAndManagers($db, $tenantId, $payload['team_id'] ?? null);
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu cập nhật công",
                    'body' => "Nhân viên " . $userName . " vừa gửi Yêu cầu cập nhật công bổ sung ngày " . $today . " lúc " . substr($time, 0, 5) . " với lý do: \"" . $reason . "\"",
                    'type' => "attendance_update",
                    'link' => "/attendance?view=calendar&date=" . $today,
                    'zalo_msg' => "🔄 [ YÊU CẦU CẬP NHẬT CÔNG ]\n\n"
                        . "Nhân viên $userName vừa gửi Yêu cầu cập nhật công ngày $today:\n"
                        . "  • Tên NV: $userName\n"
                        . "  • Giờ đề xuất: " . substr($time, 0, 5) . "\n"
                        . "  • Lý do: \"$reason\"\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "🔄 <b>[ YÊU CẦU CẬP NHẬT CÔNG ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa gửi Yêu cầu cập nhật công ngày <code>$today</code>:\n"
                        . "  • Tên NV: <b>$userName</b>\n"
                        . "  • Giờ đề xuất: <code>" . substr($time, 0, 5) . "</code>\n"
                        . "  • Lý do: <i>\"$reason\"</i>\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[RICH LAND] Yêu cầu cập nhật công - NV $userName",
                    'email_title' => "YÊU CẦU CẬP NHẬT CÔNG",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa gửi Yêu cầu cập nhật công bổ sung ngày $today lúc " . substr($time, 0, 5) . ".<br/>" .
                                    "Lý do: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'ATTENDANCE_APPROVAL_RESULT':
                $status = $payload['status'] ?? 'approved';
                $isSupplementary = !empty($payload['is_supplementary']);
                $statusText = $status === 'approved' ? "chấp thuận" : ($status === 'rejected' ? "từ chối" : "cập nhật thành chờ duyệt");

                $recipients = [];
                if (!empty($payload['user_id'])) {
                    $stmtUser = $db->prepare("SELECT id, email, zalo_chat_id, telegram_chat_id, full_name FROM users WHERE id = ? LIMIT 1");
                    $stmtUser->execute([$payload['user_id']]);
                    $rowU = $stmtUser->fetch(PDO::FETCH_ASSOC);
                    if ($rowU) $recipients[] = $rowU;
                }

                $title = $isSupplementary
                    ? ($status === 'approved' ? "Cập nhật công của bạn đã được duyệt" : "Yêu cầu cập nhật công bị từ chối")
                    : ($status === 'approved' ? "Chấm công đi trễ đã được duyệt" : "Yêu cầu đi trễ bị từ chối");
                $body = "Yêu cầu " . ($isSupplementary ? "cập nhật công" : "nhận lead/đi trễ") . " ngày " . $today . " của bạn đã được " . $statusText . " bởi quản trị viên." . (!empty($reason) ? " Ghi chú: \"$reason\"" : "");

                return [
                    'recipients' => $recipients,
                    'title' => $title,
                    'body' => $body,
                    'type' => "attendance",
                    'link' => "/sale-portal",
                    'zalo_msg' => "✅ [ KẾT QUẢ DUYỆT " . ($isSupplementary ? "CẬP NHẬT CÔNG" : "ĐI TRỄ") . " ]\n\n"
                        . "Yêu cầu của $userName ngày $today đã được $statusText bởi quản trị viên.\n"
                        . (!empty($reason) ? "  • Ghi chú: \"$reason\"\n" : ""),
                    'tg_msg' => "✅ <b>[ KẾT QUẢ DUYỆT " . ($isSupplementary ? "CẬP NHẬT CÔNG" : "ĐI TRỄ") . " ]</b>\n\n"
                        . "Yêu cầu của <b>" . htmlspecialchars($userName) . "</b> ngày <code>$today</code> đã được <b>$statusText</b> bởi quản trị viên.\n"
                    'email_subject' => "[RICH LAND] Phê duyệt " . ($isSupplementary ? "cập nhật công" : "đi trễ") . " - Ngày " . $today,
                    'email_title' => "KẾT QUẢ PHÊ DUYỆT CHẤM CÔNG",
                    'email_content' => "Chào <strong>" . htmlspecialchars($userName) . "</strong>,<br/><br/>" .
                                    "Yêu cầu " . ($isSupplementary ? "cập nhật công" : "phê duyệt đi trễ") . " ngày $today của bạn đã được <strong>$statusText</strong> bởi quản trị viên.<br/>" .
                                    (!empty($reason) ? "Ghi chú: <em>\"" . htmlspecialchars($reason) . "\"</em><br/>" : "") .
                                    "Vui lòng kiểm tra trên hệ thống CRM."
                ];

            case 'HOLIDAY_REGISTRATION_OPENED':
                $holidayName = $payload['holiday_name'] ?? 'Lễ, Tết';
                $shiftDate = $payload['shift_date'] ?? '';
                $deadline = $payload['deadline'] ?? '';
                $recipients = self::getAllActiveUsers($db, $tenantId);
                return [
                    'recipients' => $recipients,
                    'title' => "🎉 Mở đăng ký ca trực lễ $holidayName",
                    'body' => "Ban quản trị đã mở đăng ký trực ca cho ngày lễ $holidayName ($shiftDate)." . (!empty($deadline) ? " Hạn đăng ký: $deadline" : ""),
                    'type' => "holiday",
                    'link' => "/sale-portal",
                    'zalo_msg' => "🎉 [ MỞ ĐĂNG KÝ TRỰC LỄ ]\n\n"
                        . "Ban quản trị đã mở đăng ký ca trực cho ngày nghỉ lễ: $holidayName ($shiftDate).\n"
                        . (!empty($deadline) ? "  • Hạn chót đăng ký: $deadline\n" : "")
                        . "Vui lòng truy cập trang Cá nhân / Sale Portal để đăng ký nhận lead.",
                    'tg_msg' => "🎉 <b>[ MỞ ĐĂNG KÝ TRỰC LỄ ]</b>\n\n"
                        . "Ban quản trị đã mở đăng ký ca trực cho ngày nghỉ lễ: <b>$holidayName</b> (<code>$shiftDate</code>).\n"
                        . (!empty($deadline) ? "  • Hạn chót đăng ký: <code>$deadline</code>\n" : "")
                        . "Vui lòng truy cập hệ thống để đăng ký nhận lead.",
                    'email_subject' => "[RICH LAND] Mở đăng ký trực lễ - $holidayName",
                    'email_title' => "MỞ ĐĂNG KÝ TRỰC LỄ",
                    'email_content' => "Chào các thành viên,<br/><br/>" .
                                    "Ban quản trị chính thức mở đăng ký nhận lead ca trực cho ngày lễ: <strong>$holidayName</strong> ($shiftDate).<br/>" .
                                    (!empty($deadline) ? "Hạn chót đăng ký: <strong>$deadline</strong>.<br/>" : "") .
                                    "Vui lòng truy cập trang Sale Portal để đăng ký."
                ];

            case 'HOLIDAY_UPDATE':
                $holidayName = $payload['holiday_name'] ?? 'Ngày nghỉ lễ';
                $description = $payload['description'] ?? '';
                $recipients = self::getAllActiveUsers($db, $tenantId);
                return [
                    'recipients' => $recipients,
                    'title' => "🌴 Thông báo lịch nghỉ lễ $holidayName",
                    'body' => "Công ty thông báo lịch nghỉ lễ $holidayName. $description",
                    'type' => "holiday",
                    'link' => "/sale-portal",
                    'zalo_msg' => "🌴 [ THÔNG BÁO LỊCH NGHĨ LỄ ]\n\n"
                        . "Công ty thông báo chính thức lịch nghỉ lễ: $holidayName.\n"
                        . (!empty($description) ? "  • Chi tiết: $description\n" : "")
                        . "Chúc toàn thể cán bộ nhân viên có kỳ nghỉ vui vẻ!",
                    'tg_msg' => "🌴 <b>[ THÔNG BÁO LỊCH NGHĨ LỄ ]</b>\n\n"
                        . "Công ty thông báo chính thức lịch nghỉ lễ: <b>$holidayName</b>.\n"
                        . (!empty($description) ? "  • Chi tiết: <i>$description</i>\n" : "")
                        . "Chúc toàn thể cán bộ nhân viên có kỳ nghỉ vui vẻ!",
                    'email_subject' => "[RICH LAND] Thông báo lịch nghỉ lễ - $holidayName",
                    'email_title' => "THÔNG BÁO LỊCH NGHĨ LỄ",
                    'email_content' => "Chào toàn thể cán bộ nhân viên,<br/><br/>" .
                                    "Công ty xin thông báo chính thức lịch nghỉ lễ: <strong>$holidayName</strong>.<br/>" .
                                    (!empty($description) ? "Chi tiết: <em>\"$description\"</em><br/>" : "") .
                                    "Chúc các bạn có một kỳ nghỉ an lành và vui vẻ!"
                ];

            case 'MONTHLY_ATTENDANCE_REPORT':
                $recipients = $payload['recipients'] ?? [];
                $summaryText = $payload['summary_text'] ?? '';
                $periodStr = $payload['period_str'] ?? '';
                return [
                    'recipients' => $recipients,
                    'title' => "📊 Báo cáo Chấm công & Trực ca ($periodStr)",
                    'body' => $summaryText,
                    'type' => "attendance_report",
                    'link' => "/attendance",
                    'zalo_msg' => "📊 [ BÁO CÁO CHẤM CÔNG & TRỰC CA ]\n\n" . $summaryText,
                    'tg_msg' => "📊 <b>[ BÁO CÁO CHẤM CÔNG & TRỰC CA ]</b>\n\n" . preg_replace('/•\s*([^:]+):/', '• <b>$1</b>:', htmlspecialchars($summaryText)),
                    'email_subject' => "[RICH LAND] Báo cáo tổng kết Chấm công & Trực ca ($periodStr)",
                    'email_title' => "BÁO CÁO CHẤM CÔNG CÁ NHÂN",
                    'email_content' => nl2br(htmlspecialchars($summaryText))
                ];

            case 'CHECKOUT_REMINDER':
                $recipients = $payload['recipients'] ?? [];
                $workEnd = $payload['work_end'] ?? '17:30';
                return [
                    'recipients' => $recipients,
                    'title' => "🌆 Nhắc nhở chấm công Ra ca",
                    'body' => "Đã đến giờ tan làm ($workEnd)! Vui lòng thực hiện chấm công ra ca.",
                    'type' => "attendance",
                    'link' => "/attendance",
                    'zalo_msg' => "🌆 [ NHẮC NHỞ CHẤM CÔNG RA CA ]\n\nĐã đến giờ tan làm ($workEnd)! Vui lòng truy cập hệ thống để chấm công ra ca.",
                    'tg_msg' => "🌆 <b>[ NHẮC NHỞ CHẤM CÔNG RA CA ]</b>\n\nĐã đến giờ tan làm (<code>$workEnd</code>)! Vui lòng truy cập hệ thống để chấm công ra ca.",
                    'email_subject' => "[RICH LAND] Nhắc nhở chấm công ra ca",
                    'email_title' => "NHẮC NHỞ TAN LÀM",
                    'email_content' => "Chào bạn,<br/><br/>Đã đến giờ tan làm ca chiều (lúc $workEnd).<br/>Vui lòng truy cập hệ thống CRM để chấm công ra ca."
                ];

            case 'EXPENSE_REQUEST':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $titleText = $payload['title'] ?? 'Chi phí';
                $amountText = number_format((float)($payload['amount'] ?? 0), 0, ',', '.') . 'đ';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu phê duyệt chi phí",
                    'body' => "Nhân viên " . $userName . " vừa tạo yêu cầu chi phí mới: " . $titleText . " (" . $amountText . ")",
                    'type' => "expense",
                    'link' => "/expenses",
                    'zalo_msg' => "💸 [ YÊU CẦU PHÊ DUYỆT CHI PHÍ ]\n\n"
                        . "Nhân viên $userName vừa tạo yêu cầu chi phí mới:\n"
                        . "  • Tiêu đề: $titleText\n"
                        . "  • Số tiền: $amountText\n"
                        . "  • Ghi chú: \"$reason\"\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "💸 <b>[ YÊU CẦU PHÊ DUYỆT CHI PHÍ ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa tạo yêu cầu chi phí mới:\n"
                        . "  • Tiêu đề: <b>" . htmlspecialchars($titleText) . "</b>\n"
                        . "  • Số tiền: <b>$amountText</b>\n"
                        . "  • Ghi chú: <i>\"" . htmlspecialchars($reason) . "\"</i>\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[RICH LAND] Yêu cầu phê duyệt Chi phí - NV $userName",
                    'email_title' => "PHÊ DUYỆT CHI PHÍ",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa tạo một khoản chi phí mới cần phê duyệt: <strong>" . htmlspecialchars($titleText) . "</strong>.<br/>" .
                                    "Số tiền: <strong>$amountText</strong>.<br/>" .
                                    "Ghi chú: <em>\"" . htmlspecialchars($reason) . "\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'TICKET_NEW':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $ticketId = $payload['ticket_id'] ?? '0';
                $subjectText = $payload['subject'] ?? 'Hỗ trợ';
                $priorityText = $payload['priority'] ?? 'medium';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu hỗ trợ mới (Ticket #$ticketId)",
                    'body' => "Có yêu cầu hỗ trợ mới từ $userName: $subjectText",
                    'type' => "ticket_assignment",
                    'link' => "/support-tickets",
                    'zalo_msg' => "🎫 [ TICKET HỖ TRỢ MỚI ]\n\n"
                        . "Có yêu cầu hỗ trợ mới từ $userName:\n"
                        . "  • Ticket: #$ticketId\n"
                        . "  • Tiêu đề: $subjectText\n"
                        . "  • Độ ưu tiên: $priorityText\n\n"
                        . "Vui lòng truy cập CRM để xử lý.",
                    'tg_msg' => "🎫 <b>[ TICKET HỖ TRỢ MỚI ]</b>\n\n"
                        . "Có yêu cầu hỗ trợ mới từ <b>" . htmlspecialchars($userName) . "</b>:\n"
                        . "  • Ticket: <b>#$ticketId</b>\n"
                        . "  • Tiêu đề: <b>" . htmlspecialchars($subjectText) . "</b>\n"
                        . "  • Độ ưu tiên: <b>" . htmlspecialchars($priorityText) . "</b>\n\n"
                        . "Vui lòng truy cập CRM để xử lý.",
                    'email_subject' => "[RICH LAND] Yêu cầu hỗ trợ mới (Ticket #$ticketId)",
                    'email_title' => "TICKET HỖ TRỢ MỚI",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Có yêu cầu hỗ trợ mới từ <strong>" . htmlspecialchars($userName) . "</strong>:<br/>" .
                                    "Tiêu đề: <strong>" . htmlspecialchars($subjectText) . "</strong>.<br/>" .
                                    "Mô tả: <em>\"" . htmlspecialchars($reason) . "\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để xử lý."
                ];

            case 'COOPERATION_PENDING_APPROVAL':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $slipId = $payload['slip_id'] ?? '0';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu phê duyệt phiếu hợp tác",
                    'body' => "Phiếu hợp tác #" . $slipId . " đã thu thập đủ chữ ký và đang chờ phê duyệt",
                    'type' => "cooperation",
                    'link' => "/cooperation-slips",
                    'zalo_msg' => "✍️ [ YÊU CẦU PHÊ DUYỆT PHIẾU HỢP TÁC ]\n\n"
                        . "Phiếu hợp tác chia sẻ hoa hồng #$slipId đã thu thập đầy đủ chữ ký của các thành viên.\n"
                        . "  • Mã phiếu: #$slipId\n"
                        . "  • Trạng thái: Chờ phê duyệt\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "✍️ <b>[ YÊU CẦU PHÊ DUYỆT PHIẾU HỢP TÁC ]</b>\n\n"
                        . "Phiếu hợp tác chia sẻ hoa hồng <b>#$slipId</b> đã thu thập đầy đủ chữ ký của các thành viên.\n"
                        . "  • Trạng thái: Chờ phê duyệt\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[RICH LAND] Yêu cầu phê duyệt Phiếu hợp tác #$slipId",
                    'email_title' => "PHÊ DUYỆT PHIẾU HỢP TÁC",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Phiếu hợp tác chia sẻ hoa hồng <strong>#$slipId</strong> đã thu thập đầy đủ chữ ký của các thành viên.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'DEPOSIT_NEW':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $depId = $payload['deposit_id'] ?? '0';
                $customerName = $payload['customer_name'] ?? 'Khách hàng';
                $depAmount = number_format((float)($payload['amount'] ?? 0), 0, ',', '.') . 'đ';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu duyệt đặt cọc mới",
                    'body' => "Nhân viên " . $userName . " vừa tạo giao dịch đặt cọc cho khách hàng " . $customerName . " (" . $depAmount . ")",
                    'type' => "deposit",
                    'link' => "/deposits",
                    'zalo_msg' => "🏠 [ YÊU CẦU DUYỆT ĐẶT CỌC MỚI ]\n\n"
                        . "Nhân viên $userName vừa tạo yêu cầu đặt cọc mới:\n"
                        . "  • Mã cọc: #$depId\n"
                        . "  • Khách hàng: $customerName\n"
                        . "  • Số tiền: $depAmount\n\n"
                        . "Vui lòng truy cập CRM để xem xét.",
                    'tg_msg' => "🏠 <b>[ YÊU CẦU DUYỆT ĐẶT CỌC MỚI ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa tạo yêu cầu đặt cọc mới:\n"
                        . "  • Mã cọc: <b>#$depId</b>\n"
                        . "  • Khách hàng: <b>" . htmlspecialchars($customerName) . "</b>\n"
                        . "  • Số tiền: <b>$depAmount</b>\n\n"
                        . "Vui lòng truy cập CRM để xem xét.",
                    'email_subject' => "[RICH LAND] Yêu cầu duyệt Đặt cọc mới #$depId",
                    'email_title' => "DUYỆT ĐẶT CỌC MỚI",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa tạo giao dịch đặt cọc mới cho khách hàng <strong>" . htmlspecialchars($customerName) . "</strong>.<br/>" .
                                    "Số tiền cọc: <strong>$depAmount</strong>.<br/>" .
                                    "Vui lòng truy cập CRM để xem xét."
                ];

            case 'MY_DEPOSIT_UPDATE':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $customerName = $payload['customer_name'] ?? 'Khách hàng';
                $statusText = $payload['status_text'] ?? 'được cập nhật';
                $depId = $payload['deposit_id'] ?? '0';
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật giao dịch đặt cọc #$depId",
                    'body' => "Giao dịch cọc cho khách hàng $customerName đã $statusText",
                    'type' => "deposit",
                    'link' => "/deposits",
                    'zalo_msg' => "💳 [ CẬP NHẬT GIAO DỊCH CỌC ]\n\n"
                        . "Giao dịch cọc #$depId (KH $customerName) đã $statusText.\n"
                        . (!empty($reason) ? "  • Ghi chú: \"$reason\"\n" : "")
                        . "\nVui lòng xem chi tiết trên CRM.",
                    'tg_msg' => "💳 <b>[ CẬP NHẬT GIAO DỊCH CỌC ]</b>\n\n"
                        . "Giao dịch cọc <b>#$depId</b> (KH <b>" . htmlspecialchars($customerName) . "</b>) đã <b>$statusText</b>.\n"
                        . (!empty($reason) ? "  • Ghi chú: <i>\"" . htmlspecialchars($reason) . "\"</i>\n" : "")
                        . "\nVui lòng xem chi tiết trên CRM.",
                    'email_subject' => "[RICH LAND] Cập nhật giao dịch cọc #$depId - $customerName",
                    'email_title' => "CẬP NHẬT GIAO DỊCH ĐẶT CỌC",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Giao dịch cọc #$depId của khách hàng <strong>" . htmlspecialchars($customerName) . "</strong> đã <strong>$statusText</strong>.<br/>" .
                                    (!empty($reason) ? "Ghi chú: <em>\"" . htmlspecialchars($reason) . "\"</em><br/>" : "") .
                                    "Vui lòng kiểm tra trên CRM."
                ];

            case 'NIGHT_SHIFT_BOOKING':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $shiftDate = $payload['shift_date'] ?? $today;
                return [
                    'recipients' => $recipients,
                    'title' => "Đăng ký trực đêm mới",
                    'body' => "Nhân viên " . $userName . " đã đăng ký trực ca đêm ngày " . $shiftDate,
                    'type' => "roster",
                    'link' => "/roster",
                    'zalo_msg' => "🌙 [ ĐĂNG KÝ TRỰC ĐÊM MỚI ]\n\n"
                        . "Nhân viên $userName vừa đăng ký trực ca đêm:\n"
                        . "  • Ngày trực: $shiftDate\n"
                        . "  • Trạng thái: Đã ghi nhận\n\n"
                        . "Vui lòng kiểm tra lịch trực trên CRM.",
                    'tg_msg' => "🌙 <b>[ ĐĂNG KÝ TRỰC ĐÊM MỚI ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa đăng ký trực ca đêm:\n"
                        . "  • Ngày trực: <code>$shiftDate</code>\n\n"
                        . "Vui lòng kiểm tra lịch trực trên CRM.",
                    'email_subject' => "[RICH LAND] Đăng ký trực đêm - NV $userName",
                    'email_title' => "ĐĂNG KÝ TRỰC ĐÊM",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa đăng ký trực ca đêm ngày <strong>$shiftDate</strong>.<br/>" .
                                    "Vui lòng kiểm tra lịch trực trên CRM."
                ];

            case 'LEAVE_REQUEST':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $leaveDate = $payload['leave_date'] ?? $today;
                return [
                    'recipients' => $recipients,
                    'title' => "Đơn xin nghỉ phép mới",
                    'body' => "Nhân viên " . $userName . " đã gửi đơn xin nghỉ phép ngày " . $leaveDate . " với lý do: \"" . $reason . "\"",
                    'type' => "leave",
                    'link' => "/attendance",
                    'zalo_msg' => "🏖️ [ ĐƠN XIN NGHỈ PHÉP MỚI ]\n\n"
                        . "Nhân viên $userName vừa gửi đơn xin nghỉ phép:\n"
                        . "  • Ngày nghỉ: $leaveDate\n"
                        . "  • Lý do: \"$reason\"\n\n"
                        . "Vui lòng truy cập CRM để phê duyệt.",
                    'tg_msg' => "🏖️ <b>[ ĐƠN XIN NGHỈ PHÉP MỚI ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa gửi đơn xin nghỉ phép:\n"
                        . "  • Ngày nghỉ: <code>$leaveDate</code>\n"
                        . "  • Lý do: <i>\"$reason\"</i>\n\n"
                        . "Vui lòng truy cập CRM để phê duyệt.",
                    'email_subject' => "[RICH LAND] Đơn xin nghỉ phép - NV $userName",
                    'email_title' => "ĐƠN XIN NGHỈ PHÉP",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa gửi đơn xin nghỉ phép ngày $leaveDate.<br/>" .
                                    "Lý do: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập CRM để phê duyệt."
                ];

            case 'LEAD_ASSIGNMENT':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $custName = $payload['customer_name'] ?? 'Khách hàng mới';
                $phone = $payload['phone'] ?? '';
                $maskedPhone = !empty($phone) && strlen($phone) >= 7 
                    ? (substr($phone, 0, 4) . '***' . substr($phone, -3)) 
                    : '******';
                return [
                    'recipients' => $recipients,
                    'title' => "Khách hàng mới được phân bổ",
                    'body' => "Bạn vừa được phân bổ khách hàng mới. Vui lòng vào CRM (Sale Portal) để nhận và xem chi tiết.",
                    'type' => "lead",
                    'link' => "/sale-portal",
                    'zalo_msg' => "🎯 [ KHÁCH HÀNG MỚI ĐƯỢC CHIA ]\n\n"
                        . "Bạn vừa được hệ thống phân bổ 1 khách hàng mới:\n"
                        . "  • Trạng thái: Chờ nhận & xem chi tiết\n"
                        . "  • SĐT liên hệ: $maskedPhone\n\n"
                        . "Vui lòng truy cập Sale Portal trên CRM ngay để nhận và lấy thông tin chi tiết!",
                    'tg_msg' => "🎯 <b>[ KHÁCH HÀNG MỚI ĐƯỢC CHIA ]</b>\n\n"
                        . "Bạn vừa được hệ thống phân bổ 1 khách hàng mới:\n"
                        . "  • Trạng thái: <b>Chờ nhận & xem chi tiết</b>\n"
                        . "  • SĐT liên hệ: <code>$maskedPhone</code>\n\n"
                        . "Vui lòng truy cập Sale Portal trên CRM ngay để nhận và lấy thông tin chi tiết!",
                    'email_subject' => "[RICH LAND] Thông báo phân bổ khách hàng mới",
                    'email_title' => "KHÁCH HÀNG MỚI ĐƯỢC PHÂN BỔ",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Hệ thống vừa phân bổ 1 khách hàng mới cho bạn.<br/>" .
                                    "Vì lý do bảo mật dữ liệu, thông tin chi tiết và SĐT đầy đủ chỉ hiển thị khi bạn đăng nhập vào CRM.<br/>" .
                                    "Vui lòng truy cập <strong>Sale Portal</strong> trên CRM để nhận khách hàng."
                ];

            case 'CUSTOMER_UPDATE':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $custName = $payload['customer_name'] ?? 'Khách hàng';
                $updateContent = $payload['content'] ?? 'Thông tin khách hàng vừa được cập nhật';
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật khách hàng $custName",
                    'body' => $updateContent,
                    'type' => "customer",
                    'link' => "/contacts",
                    'zalo_msg' => "👤 [ CẬP NHẬT KHÁCH HÀNG ]\n\n"
                        . "Khách hàng $custName có cập nhật mới:\n"
                        . "  • Nội dung: $updateContent\n\n"
                        . "Vui lòng truy cập CRM để xem chi tiết.",
                    'tg_msg' => "👤 <b>[ CẬP NHẬT KHÁCH HÀNG ]</b>\n\n"
                        . "Khách hàng <b>" . htmlspecialchars($custName) . "</b> có cập nhật mới:\n"
                        . "  • Nội dung: <i>" . htmlspecialchars($updateContent) . "</i>\n\n"
                        . "Vui lòng truy cập CRM để xem chi tiết.",
                    'email_subject' => "[RICH LAND] Cập nhật thông tin khách hàng $custName",
                    'email_title' => "CẬP NHẬT KHÁCH HÀNG",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Khách hàng <strong>" . htmlspecialchars($custName) . "</strong> có cập nhật mới.<br/>" .
                                    "Nội dung: <em>" . htmlspecialchars($updateContent) . "</em>.<br/>" .
                                    "Vui lòng kiểm tra trên CRM."
                ];

            case 'SECURITY_DEADLINE_WARNING':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $custName = $payload['customer_name'] ?? 'Khách hàng';
                $deadlineText = $payload['deadline'] ?? '24h';
                return [
                    'recipients' => $recipients,
                    'title' => "Cảnh báo hạn bảo mật Data",
                    'body' => "Khách hàng $custName sắp hết hạn bảo mật và sẽ bị thu hồi sau $deadlineText",
                    'type' => "security_warning",
                    'link' => "/contacts",
                    'zalo_msg' => "⏳ [ CẢNH BÁO HẠN BẢO MẬT DATA ]\n\n"
                        . "Khách hàng $custName của bạn sắp hết thời hạn bảo mật:\n"
                        . "  • Thời gian còn lại: $deadlineText\n\n"
                        . "Hãy cập nhật tương tác để gia hạn bảo mật data.",
                    'tg_msg' => "⏳ <b>[ CẢNH BÁO HẠN BẢO MẬT DATA ]</b>\n\n"
                        . "Khách hàng <b>" . htmlspecialchars($custName) . "</b> của bạn sắp hết thời hạn bảo mật:\n"
                        . "  • Thời gian còn lại: <code>$deadlineText</code>\n\n"
                        . "Hãy cập nhật tương tác để gia hạn bảo mật data.",
                    'email_subject' => "[RICH LAND] Cảnh báo hạn bảo mật Data - $custName",
                    'email_title' => "CẢNH BÁO HẠN BẢO MẬT DATA",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Khách hàng <strong>" . htmlspecialchars($custName) . "</strong> sắp hết thời hạn bảo mật.<br/>" .
                                    "Thời gian còn lại: <strong>$deadlineText</strong>.<br/>" .
                                    "Hãy cập nhật tương tác để giữ quyền chăm sóc data."
                ];

            case 'MENTION_TAGGED':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $authorName = $payload['author_name'] ?? 'Đồng nghiệp';
                $commentText = $payload['comment'] ?? 'đã nhắc tên bạn';
                return [
                    'recipients' => $recipients,
                    'title' => "$authorName vừa nhắc tên bạn",
                    'body' => "$authorName: \"$commentText\"",
                    'type' => "mention",
                    'link' => $payload['link'] ?? '/',
                    'zalo_msg' => "🏷️ [ ĐƯỢC TAG TÊN / MENTION ]\n\n"
                        . "$authorName vừa nhắc tên bạn trong ghi chú/thảo luận:\n"
                        . "  • Nội dung: \"$commentText\"\n\n"
                        . "Bấm để xem chi tiết.",
                    'tg_msg' => "🏷️ <b>[ ĐƯỢC TAG TÊN / MENTION ]</b>\n\n"
                        . "<b>" . htmlspecialchars($authorName) . "</b> vừa nhắc tên bạn trong ghi chú/thảo luận:\n"
                        . "  • Nội dung: <i>\"" . htmlspecialchars($commentText) . "\"</i>\n\n"
                        . "Bấm để xem chi tiết.",
                    'email_subject' => "[RICH LAND] $authorName vừa tag tên bạn trong bình luận",
                    'email_title' => "BẠN ĐƯỢC NHẮC ĐẾN",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "<strong>" . htmlspecialchars($authorName) . "</strong> vừa nhắc tên bạn trong bình luận:<br/>" .
                                    "<em>\"" . htmlspecialchars($commentText) . "\"</em>.<br/>" .
                                    "Vui lòng kiểm tra trên CRM."
                ];

            case 'WORKFLOW_TASK_ASSIGNED':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $taskTitle = $payload['task_title'] ?? 'Nhiệm vụ mới';
                $dueDate = $payload['due_date'] ?? '';
                return [
                    'recipients' => $recipients,
                    'title' => "Công việc CRM mới được giao",
                    'body' => "Bạn được giao công việc: $taskTitle" . ($dueDate ? " (Hạn: $dueDate)" : ""),
                    'type' => "task",
                    'link' => "/activities",
                    'zalo_msg' => "📋 [ GÁN CÔNG VIỆC MỚI ]\n\n"
                        . "Bạn vừa được giao nhiệm vụ CRM mới:\n"
                        . "  • Tiêu đề: $taskTitle\n"
                        . ($dueDate ? "  • Hạn hoàn thành: $dueDate\n" : "")
                        . "\nVui lòng kiểm tra và xử lý.",
                    'tg_msg' => "📋 <b>[ GÁN CÔNG VIỆC MỚI ]</b>\n\n"
                        . "Bạn vừa được giao nhiệm vụ CRM mới:\n"
                        . "  • Tiêu đề: <b>" . htmlspecialchars($taskTitle) . "</b>\n"
                        . ($dueDate ? "  • Hạn hoàn thành: <code>$dueDate</code>\n" : "")
                        . "\nVui lòng kiểm tra và xử lý.",
                    'email_subject' => "[RICH LAND] Công việc mới được giao - $taskTitle",
                    'email_title' => "CÔNG VIỆC MỚI ĐƯỢC GIAO",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Bạn vừa được phân công công việc mới: <strong>" . htmlspecialchars($taskTitle) . "</strong>.<br/>" .
                                    ($dueDate ? "Hạn hoàn thành: <strong>$dueDate</strong>.<br/>" : "") .
                                    "Vui lòng truy cập CRM để thực hiện."
                ];

            case 'PROFILE_ACCOUNT_UPDATE':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật hồ sơ & bảo mật tài khoản",
                    'body' => "Thông tin hồ sơ hoặc cài đặt tài khoản của bạn vừa được cập nhật thành công.",
                    'type' => "account",
                    'link' => "/personal-account",
                    'zalo_msg' => "🔒 [ BẢO MẬT TÀI KHOẢN ]\n\n"
                        . "Thông tin hồ sơ tài khoản của bạn vừa được cập nhật thành công.\n"
                        . "Nếu không phải bạn thực hiện, vui lòng liên hệ Admin ngay lập tức.",
                    'tg_msg' => "🔒 <b>[ BẢO MẬT TÀI KHOẢN ]</b>\n\n"
                        . "Thông tin hồ sơ tài khoản của bạn vừa được cập nhật thành công.\n"
                        . "Nếu không phải bạn thực hiện, vui lòng liên hệ Admin ngay lập tức.",
                    'email_subject' => "[RICH LAND] Cập nhật thông tin hồ sơ tài khoản",
                    'email_title' => "THÔNG BÁO BẢO MẬT TÀI KHOẢN",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Thông tin hồ sơ tài khoản của bạn vừa được thay đổi.<br/>" .
                                    "Nếu không phải bạn thực hiện, vui lòng đổi mật khẩu và liên hệ Ban quản trị ngay."
                ];

            case 'PROJECT_ROSTER_UPDATE':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $projectName = $payload['project_name'] ?? 'Dự án';
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật lịch Roster dự án",
                    'body' => "Lịch trực Roster dự án $projectName vừa được cập nhật mới.",
                    'type' => "project",
                    'link' => "/projects",
                    'zalo_msg' => "🏢 [ CẬP NHẬT ROSTER DỰ ÁN ]\n\n"
                        . "Lịch trực ca và phân công nhân sự dự án $projectName vừa được cập nhật.\n"
                        . "Vui lòng xem chi tiết trên bảng Roster CRM.",
                    'tg_msg' => "🏢 <b>[ CẬP NHẬT ROSTER DỰ ÁN ]</b>\n\n"
                        . "Lịch trực ca và phân công nhân sự dự án <b>" . htmlspecialchars($projectName) . "</b> vừa được cập nhật.\n"
                        . "Vui lòng xem chi tiết trên bảng Roster CRM.",
                    'email_subject' => "[RICH LAND] Cập nhật Lịch Roster dự án $projectName",
                    'email_title' => "CẬP NHẬT LỊCH ROSTER DỰ ÁN",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Danh sách phân công Roster dự án <strong>" . htmlspecialchars($projectName) . "</strong> vừa có thay đổi.<br/>" .
                                    "Vui lòng truy cập CRM để xem chi tiết."
                ];

            case 'MONTHLY_ATTENDANCE_REPORT':
                $recipients = !empty($payload['user_id']) ? self::getRecipientById($db, (int)$payload['user_id']) : self::getAllUsers($db, $tenantId);
                $periodText = $payload['period'] ?? 'Tháng vừa qua';
                $workDays = $payload['work_days'] ?? 0;
                $lateDays = $payload['late_days'] ?? 0;
                $lateMins = $payload['late_minutes'] ?? 0;
                $missingDays = $payload['missing_days'] ?? 0;
                $nightShifts = $payload['night_shifts'] ?? 0;
                $weekendShifts = $payload['weekend_shifts'] ?? 0;
                $holidayShifts = $payload['holiday_shifts'] ?? 0;

                $reportSummary = "• Ngày chấm công: $workDays ngày\n"
                    . "• Đi trễ: $lateDays lần ($lateMins phút)\n"
                    . "• Quên chấm (giờ hành chính): $missingDays ngày\n"
                    . "• Trực đêm: $nightShifts ca\n"
                    . "• Trực cuối tuần: $weekendShifts ca\n"
                    . ($holidayShifts > 0 ? "• Trực lễ: $holidayShifts ca\n" : "");

                return [
                    'recipients' => $recipients,
                    'title' => "Báo cáo Chấm công & Ca trực ($periodText)",
                    'body' => "Tổng kết $periodText: $workDays ngày công, $lateDays lần trễ ($lateMins phút), $missingDays ngày chưa chấm.",
                    'type' => "attendance_report",
                    'link' => "/sale-portal",
                    'zalo_msg' => "📊 [ BÁO CÁO CHẤM CÔNG & CA TRỰC - $periodText ]\n\n"
                        . "Chi tiết tổng kết cá nhân:\n"
                        . $reportSummary
                        . "\nVui lòng xem thêm chi tiết tại Sale Portal.",
                    'tg_msg' => "📊 <b>[ BÁO CÁO CHẤM CÔNG & CA TRỰC - $periodText ]</b>\n\n"
                        . "Chi tiết tổng kết cá nhân:\n"
                        . nl2br(htmlspecialchars($reportSummary))
                        . "\nVui lòng xem thêm chi tiết tại Sale Portal.",
                    'email_subject' => "[RICH LAND] Báo cáo Chấm công & Ca trực - $periodText",
                    'email_title' => "BÁO CÁO CHẤM CÔNG & CA TRỰC",
                    'email_content' => "Chào <strong>$userName</strong>,<br/><br/>" .
                                    "Dưới đây là chi tiết báo cáo chấm công & ca trực kỳ <strong>$periodText</strong> của bạn:<br/>" .
                                    "<ul>" .
                                    "<li>Ngày đã chấm công hợp lệ: <strong>$workDays ngày</strong></li>" .
                                    "<li>Số lần đi trễ: <strong>$lateDays lần ($lateMins phút)</strong></li>" .
                                    "<li>Số ngày vắng/chưa chấm (giờ hành chính): <strong style='color:red;'>$missingDays ngày</strong></li>" .
                                    "<li>Ca trực đêm: <strong>$nightShifts ca</strong></li>" .
                                    "<li>Ca trực cuối tuần: <strong>$weekendShifts ca</strong></li>" .
                                    ($holidayShifts > 0 ? "<li>Ca trực lễ/tết: <strong>$holidayShifts ca</strong></li>" : "") .
                                    "</ul><br/>" .
                                    "Vui lòng truy cập hệ thống để đối soát thông tin."
                ];

            case 'HOLIDAY_ROSTER_OPEN':
                $recipients = self::getAllUsers($db, $tenantId);
                $holidayName = $payload['holiday_name'] ?? 'Lễ / Tết';
                $deadline = $payload['deadline'] ?? 'trước ngày trực';
                return [
                    'recipients' => $recipients,
                    'title' => "Mở đăng ký trực lễ $holidayName",
                    'body' => "Ban quản trị đã mở cổng đăng ký ca trực ngày lễ $holidayName. Hạn đăng ký: $deadline",
                    'type' => "roster",
                    'link' => "/roster",
                    'zalo_msg' => "🎉 [ MỞ ĐĂNG KÝ TRỰC LỄ / TẾT ]\n\n"
                        . "Hệ thống đã mở đăng ký trực ngày lễ $holidayName.\n"
                        . "  • Dịp lễ: $holidayName\n"
                        . "  • Hạn đăng ký: $deadline\n\n"
                        . "Vui lòng truy cập mục Lịch Roster để đăng ký ca trực.",
                    'tg_msg' => "🎉 <b>[ MỞ ĐĂNG KÝ TRỰC LỄ / TẾT ]</b>\n\n"
                        . "Hệ thống đã mở đăng ký trực ngày lễ <b>" . htmlspecialchars($holidayName) . "</b>.\n"
                        . "  • Dịp lễ: <b>" . htmlspecialchars($holidayName) . "</b>\n"
                        . "  • Hạn đăng ký: <code>$deadline</code>\n\n"
                        . "Vui lòng truy cập mục Lịch Roster để đăng ký ca trực.",
                    'email_subject' => "[RICH LAND] Mở đăng ký trực lễ $holidayName",
                    'email_title' => "MỞ ĐĂNG KÝ TRỰC LỄ / TẾT",
                    'email_content' => "Chào toàn thể cán bộ nhân viên,<br/><br/>" .
                                    "Hệ thống đã mở cổng đăng ký ca trực dịp <strong>" . htmlspecialchars($holidayName) . "</strong>.<br/>" .
                                    "Hạn đăng ký: <strong>$deadline</strong>.<br/>" .
                                    "Vui lòng truy cập CRM để đăng ký ca trực."
                ];

            case 'HOLIDAY_ANNOUNCEMENT':
                $recipients = self::getAllUsers($db, $tenantId);
                $holidayName = $payload['holiday_name'] ?? 'Nghỉ lễ';
                $datesText = $payload['dates'] ?? '';
                return [
                    'recipients' => $recipients,
                    'title' => "Thông báo lịch nghỉ lễ $holidayName",
                    'body' => "Công ty thông báo lịch nghỉ lễ $holidayName" . ($datesText ? ": $datesText" : ""),
                    'type' => "announcement",
                    'link' => "/",
                    'zalo_msg' => "📢 [ THÔNG BÁO LỊCH NGHỈ LỄ ]\n\n"
                        . "Thông báo lịch nghỉ lễ $holidayName toàn công ty:\n"
                        . "  • Dịp lễ: $holidayName\n"
                        . ($datesText ? "  • Thời gian: $datesText\n" : "")
                        . "\nChúc toàn thể nhân viên có kỳ nghỉ lễ an toàn và vui vẻ!",
                    'tg_msg' => "📢 <b>[ THÔNG BÁO LỊCH NGHỈ LỄ ]</b>\n\n"
                        . "Thông báo lịch nghỉ lễ <b>" . htmlspecialchars($holidayName) . "</b> toàn công ty:\n"
                        . "  • Dịp lễ: <b>" . htmlspecialchars($holidayName) . "</b>\n"
                        . ($datesText ? "  • Thời gian: <code>$datesText</code>\n" : "")
                        . "\nChúc toàn thể nhân viên có kỳ nghỉ lễ an toàn và vui vẻ!",
                    'email_subject' => "[RICH LAND] Thông báo lịch nghỉ lễ $holidayName",
                    'email_title' => "THÔNG BÁO LỊCH NGHỈ LỄ",
                    'email_content' => "Chào toàn thể cán bộ nhân viên,<br/><br/>" .
                                    "Công ty xin thông báo lịch nghỉ lễ <strong>" . htmlspecialchars($holidayName) . "</strong>.<br/>" .
                                    ($datesText ? "Thời gian nghỉ: <strong>$datesText</strong>.<br/><br/>" : "") .
                                    "Chúc toàn thể nhân viên kỳ nghỉ vui vẻ!"
                ];

            default:
                return null;
        }
    }

    private static function getRecipientById(PDO $db, int $userId): array {
        if ($userId <= 0) return [];
        $stmt = $db->prepare("SELECT id, email, zalo_chat_id, telegram_chat_id, full_name FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? [$row] : [];
    }

    private static function getAllUsers(PDO $db, int $tenantId): array {
        $stmt = $db->prepare("SELECT id, email, zalo_chat_id, telegram_chat_id, full_name FROM users WHERE tenant_id = ? AND is_active = 1");
        $stmt->execute([$tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Get list of admin and manager user accounts
     */
    private static function getAdminsAndManagers(PDO $db, int $tenantId, $teamId = null): array {
        $sql = "
            SELECT id, email, zalo_chat_id, telegram_chat_id, full_name
            FROM users 
            WHERE tenant_id = ? 
              AND (
                role IN ('admin', 'superadmin', 'super_admin', 'director', 'assistant')
                OR (
                  role = 'manager' 
                  AND (
                    ? IS NULL
                    OR id IN (SELECT leader_id FROM teams WHERE id = ?)
                    OR team_id = ?
                  )
                )
              )
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute([$tenantId, $teamId, $teamId, $teamId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
