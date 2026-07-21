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

            // ==================== CHANNEL 4: EMAIL SMTP (INDEPENDENT & SYNCHRONOUS) ====================
            try {
                if (!empty($emailSubject) && !empty($emailContent)) {
                    require_once __DIR__ . '/mailer.php';
                    foreach ($recipients as $rec) {
                        $rId = (int)($rec['id'] ?? 0);
                        if (!empty($rec['email']) && $isChannelEnabled($rId, 'email')) {
                            try {
                                sendEmailNotification($rec['email'], $emailSubject, $emailTitle, $emailContent, '', true);
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
                        . (!empty($reason) ? "  • Ghi chú: <i>\"" . htmlspecialchars($reason) . "\"</i>\n" : ""),
                    'email_subject' => "[RICH LAND] Phê duyệt " . ($isSupplementary ? "cập nhật công" : "đi trễ") . " - Ngày " . $today,
                    'email_title' => "KẾT QUẢ PHÊ DUYỆT CHẤM CÔNG",
                    'email_content' => "Chào <strong>" . htmlspecialchars($userName) . "</strong>,<br/><br/>" .
                                    "Yêu cầu " . ($isSupplementary ? "cập nhật công" : "phê duyệt đi trễ") . " ngày $today của bạn đã được <strong>$statusText</strong> bởi quản trị viên.<br/>" .
                                    (!empty($reason) ? "Ghi chú: <em>\"" . htmlspecialchars($reason) . "\"</em><br/>" : "") .
                                    "Vui lòng kiểm tra trên hệ thống CRM."
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

            default:
                return null;
        }
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
