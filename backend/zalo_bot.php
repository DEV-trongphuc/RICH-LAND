<?php
// backend/zalo_bot.php

require_once __DIR__ . '/db_connect.php';

/**
 * Gửi tin nhắn qua Zalo Bot Platform
 *
 * @param string $botToken
 * @param string $chatId
 * @param string $text
 * @return bool
 */
function sendZaloMessage($botToken, $chatId, $text, $sync = true, $leadId = 0)
{
    if (empty($botToken) || empty($chatId) || empty($text) || strtolower(trim($chatId)) === 'chưa liên kết') {
        return false;
    }

    global $conn;

    // Automatically replicate matching messages to Telegram
    if ($conn) {
        try {
            $tgTokenRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'telegram_bot_token' LIMIT 1");
            $tgToken = $tgTokenRes ? ($tgTokenRes->fetch_assoc()['setting_value'] ?? '') : '';
            if (!empty($tgToken)) {
                $tgChatId = null;
                // Check if it's the admin group chat ID
                $zaloGroupRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_admin_group_chat_id' LIMIT 1");
                $zaloGroup = $zaloGroupRes ? ($zaloGroupRes->fetch_assoc()['setting_value'] ?? '') : '';
                if (!empty($zaloGroup) && $zaloGroup === $chatId) {
                    $tgGroupRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'telegram_admin_group_chat_id' LIMIT 1");
                    $tgChatId = $tgGroupRes ? ($tgGroupRes->fetch_assoc()['setting_value'] ?? '') : null;
                } else {
                    // Look up users table for individual user match
                    $stmtUser = $conn->prepare("SELECT telegram_chat_id FROM users WHERE zalo_chat_id = ? LIMIT 1");
                    if ($stmtUser) {
                        $stmtUser->bind_param("s", $chatId);
                        $stmtUser->execute();
                        $uRow = $stmtUser->get_result()->fetch_assoc();
                        $stmtUser->close();
                        if ($uRow && !empty($uRow['telegram_chat_id'])) {
                            $tgChatId = $uRow['telegram_chat_id'];
                        }
                    }
                }

                if (!empty($tgChatId)) {
                    // Send to Telegram
                    require_once __DIR__ . '/telegram_bot.php';
                    $tgText = $text;
                    $tgText = preg_replace('/\[\s*([^\]]+?)\s*\]/', '<b>[$1]</b>', $tgText);
                    $tgText = preg_replace('/❖\s*([^:]+?)\s*:/', '❖ <b>$1</b>:', $tgText);
                    sendTelegramMessage($tgToken, $tgChatId, $tgText);
                }
            }
        } catch (Throwable $tgEx) {
            error_log("Error auto-replicating Zalo message to Telegram: " . $tgEx->getMessage());
        }
    }

    if (!$sync) {
        $stmt = $conn->prepare("INSERT INTO zalo_queue (bot_token, chat_id, body_text, status, lead_id) VALUES (?, ?, ?, 'pending', ?)");
        if ($stmt) {
            $lId = ($leadId > 0) ? $leadId : null;
            $stmt->bind_param("sssi", $botToken, $chatId, $text, $lId);
            $result = $stmt->execute();
            $stmt->close();

            if ($leadId > 0) {
                $stmtLead = $conn->prepare("UPDATE leads SET zalo_notify_status = 'pending' WHERE id = ?");
                if ($stmtLead) {
                    $stmtLead->bind_param("i", $leadId);
                    $stmtLead->execute();
                    $stmtLead->close();
                }
            }

            return $result;
        }
        return false;
    }

    $url = "https://bot-api.zaloplatforms.com/bot" . $botToken . "/sendMessage";

    $payload = json_encode([
        "chat_id" => $chatId,
        "text" => $text
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json; charset=utf-8'));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5); // Timeout 5 giây tránh nghẽn
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Ghi nhận log gửi tin nhắn Zalo để kiểm tra lỗi
    $logMsg = date('[Y-m-d H:i:s]') . " Target ChatId: $chatId, HTTP: $httpCode, Request: $payload, Response: " . ($result ?: 'NO RESPONSE') . "\n";
    $logFile = __DIR__ . '/zalo_send_log.txt';
    if (file_exists($logFile) && @filesize($logFile) > 5 * 1024 * 1024) {
        $bakFile = __DIR__ . '/zalo_send_log.bak.txt';
        if (file_exists($bakFile)) {
            @unlink($bakFile);
        }
        @rename($logFile, $bakFile);
    }
    @file_put_contents($logFile, $logMsg, FILE_APPEND | LOCK_EX);

    $isSent = false;
    $errorMessage = null;
    if ($httpCode >= 200 && $httpCode < 300 && $result) {
        $resObj = json_decode($result, true);
        if (isset($resObj['ok']) && $resObj['ok'] === true) {
            $isSent = true;
        } else {
            $errorMessage = $result;
            error_log("Zalo Bot Error: " . $result);
        }
    } else {
        $errorMessage = "HTTP Code: " . $httpCode . ", Response: " . ($result ?: 'NO RESPONSE');
        error_log("Zalo Bot HTTP Error: $httpCode - " . $result);
    }

    $newStatus = $isSent ? 'sent' : 'failed';
    
    // Ghi nhận nhật ký giao tiếp Zalo
    log_communication($conn, $leadId, 'zalo', $chatId, $newStatus, $errorMessage);

    if ($leadId > 0) {
        $sentAtExpr = $isSent ? ", zalo_notify_sent_at = NOW()" : "";
        $stmtLead = $conn->prepare("UPDATE leads SET zalo_notify_status = ? $sentAtExpr WHERE id = ?");
        if ($stmtLead) {
            $stmtLead->bind_param("si", $newStatus, $leadId);
            $stmtLead->execute();
            $stmtLead->close();
        }
    }

    return $isSent;
}

/**
 * Gửi tin nhắn qua Zalo Bot Platform cho NHIỀU người cùng lúc (Concurrent cURL hoặc Queue Async)
 *
 * @param string $botToken
 * @param array $chatIdsArray
 * @param string $text
 * @param bool $sync
 * @param int $leadId
 * @return bool
 */
function sendZaloMessageToMultiple($botToken, $chatIdsArray, $text, $sync = true, $leadId = 0)
{
    if (empty($botToken) || empty($chatIdsArray) || empty($text)) {
        return false;
    }

    // Lọc trùng ID và loại bỏ giá trị rỗng
    $chatIdsArray = array_unique(array_filter($chatIdsArray));

    if (!$sync) {
        $success = true;
        foreach ($chatIdsArray as $chatId) {
            if (!sendZaloMessage($botToken, $chatId, $text, false, $leadId)) {
                $success = false;
            }
        }
        return $success;
    }

    $url = "https://bot-api.zaloplatforms.com/bot" . $botToken . "/sendMessage";
    $multiHandle = curl_multi_init();
    $curlHandles = [];

    foreach ($chatIdsArray as $chatId) {
        $ch = curl_init($url);
        $payload = json_encode([
            "chat_id" => $chatId,
            "text" => $text
        ], JSON_UNESCAPED_UNICODE);

        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json; charset=utf-8'));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3); // Timeout 3s tránh nghẽn lâu
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        curl_multi_add_handle($multiHandle, $ch);
        $curlHandles[] = $ch;
    }

    // Thực thi tất cả cURL request song song
    $running = null;
    do {
        curl_multi_exec($multiHandle, $running);
        if ($running) {
            curl_multi_select($multiHandle);
        }
    } while ($running > 0);

    // Dọn dẹp memory
    foreach ($curlHandles as $ch) {
        // Tùy chọn: Log lỗi nếu muốn curl_getinfo($ch, CURLINFO_HTTP_CODE)
        curl_multi_remove_handle($multiHandle, $ch);
        curl_close($ch);
    }
    curl_multi_close($multiHandle);

    return true;
}

/**
 * Gửi thông báo chia Lead mới cho Sale qua Zalo
 */
function sendLeadAssignedZaloMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $roundName = '', $leadId = 0, $roundId = 0, $leadEmail = '', $leadType = '', $sync = false)
{
    global $conn;

    // Gửi song song qua Telegram Bot trước (không phụ thuộc vào Zalo)
    if (file_exists(__DIR__ . '/telegram_bot.php')) {
        require_once __DIR__ . '/telegram_bot.php';
        sendLeadAssignedTelegramMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote, $leadSource, $roundName, $leadId, $roundId, $leadEmail, $leadType);
    }

    // Lấy config zalo_bot_token từ system_settings
    $botToken = get_system_setting($conn, 'zalo_bot_token');
    if (empty($botToken)) {
        return false; // Chưa cấu hình Zalo Bot
    }

    // Lấy zalo_chat_id của Sale có dùng cache
    static $chatIdCache = [];
    if (isset($chatIdCache[$consultantId])) {
        $chatId = $chatIdCache[$consultantId];
    } else {
        $stmtConsultant = $conn->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
        if (!$stmtConsultant)
            return false;

        $stmtConsultant->bind_param("i", $consultantId);
        $stmtConsultant->execute();
        $res = $stmtConsultant->get_result();
        $chatId = '';
        if ($res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $chatId = trim($row['zalo_chat_id'] ?? '');
        }
        $stmtConsultant->close();
        $chatIdCache[$consultantId] = $chatId;
    }

    if (empty($chatId) || strtolower($chatId) === 'chưa liên kết') {
        return false; // Sale chưa liên kết Zalo
    }

    $roundTitle = !empty($roundName) ? " - " . mb_strtoupper($roundName, 'UTF-8') : "";
    $text = "📥 [ THÔNG BÁO DATA MỚI$roundTitle ] 📥\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào $consultantName,\n\n"
        . "Hệ thống vừa phân bổ cho bạn một khách hàng mới. Vui lòng đăng nhập CRM để tiếp nhận và chăm sóc.\n"
        . "━━━━━━━━━━━━━━━━━━━━━";

    return sendZaloMessage($botToken, $chatId, $text, $sync, $leadId);
}

/**
 * Gửi thông báo nhắc nhở Khách hàng cũ đăng ký lại cho Sale qua Zalo
 */
function sendLeadReminderZaloMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $roundName = '', $timeline = [], $leadId = 0, $leadEmail = '', $leadType = '', $sync = false)
{
    global $conn;

    // Gửi song song qua Telegram Bot trước (không phụ thuộc vào Zalo)
    if (file_exists(__DIR__ . '/telegram_bot.php')) {
        require_once __DIR__ . '/telegram_bot.php';
        sendLeadReminderTelegramMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote, $leadSource, $roundName, $timeline, $leadId, $leadEmail, $leadType);
    }

    $botToken = get_system_setting($conn, 'zalo_bot_token');
    if (empty($botToken)) {
        return false;
    }

    // Lấy zalo_chat_id của Sale có dùng cache
    static $chatIdCache = [];
    if (isset($chatIdCache[$consultantId])) {
        $chatId = $chatIdCache[$consultantId];
    } else {
        $stmtConsultant = $conn->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
        if (!$stmtConsultant)
            return false;

        $stmtConsultant->bind_param("i", $consultantId);
        $stmtConsultant->execute();
        $res = $stmtConsultant->get_result();
        $chatId = '';
        if ($res->num_rows > 0) {
            $chatId = trim($res->fetch_assoc()['zalo_chat_id'] ?? '');
        }
        $stmtConsultant->close();
        $chatIdCache[$consultantId] = $chatId;
    }

    if (empty($chatId) || strtolower($chatId) === 'chưa liên kết') {
        return false;
    }

    // Lấy email và loại data (type) fallback từ DB nếu chưa được truyền vào
    $email = $leadEmail;
    $type = $leadType;
    if (empty($email) || empty($type)) {
        if ($leadId > 0) {
            $stmt = $conn->prepare("SELECT email, type FROM leads WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $leadId);
                $stmt->execute();
                $res = $stmt->get_result();
                if ($res && $res->num_rows > 0) {
                    $row = $res->fetch_assoc();
                    if (empty($email))
                        $email = $row['email'] ?? '';
                    if (empty($type))
                        $type = $row['type'] ?? '';
                }
                $stmt->close();
            }
        } else if (!empty($leadPhone)) {
            $stmt = $conn->prepare("SELECT email, type FROM leads WHERE phone = ? ORDER BY id DESC LIMIT 1");
            if ($stmt) {
                $stmt->bind_param("s", $leadPhone);
                $stmt->execute();
                $res = $stmt->get_result();
                if ($res && $res->num_rows > 0) {
                    $row = $res->fetch_assoc();
                    if (empty($email))
                        $email = $row['email'] ?? '';
                    if (empty($type))
                        $type = $row['type'] ?? '';
                }
                $stmt->close();
            }
        }
    }

    $fName = !empty($leadName) ? $leadName : "Không có";
    $fPhone = !empty($leadPhone) ? $leadPhone : "Không có";
    $fSource = !empty($leadSource) ? $leadSource : "Không có";
    $fNote = !empty($leadNote) ? $leadNote : "Không có";

    $historyText = '';
    if (!empty($timeline) && is_array($timeline)) {
        $lines = [];
        foreach ($timeline as $t) {
            $parts = [];
            if (!empty($t['round_name']))
                $parts[] = "Vòng: " . $t['round_name'];
            if (!empty($t['consultant_name']))
                $parts[] = "Sale: " . $t['consultant_name'];
            $extra = !empty($parts) ? " (" . implode(" | ", $parts) . ")" : "";
            $line = "  • " . $t['received_at'] . " - " . $t['status'] . $extra;
            if (!empty($t['message'])) {
                $line .= "\n    └─ " . $t['message'];
            }
            $lines[] = $line;
        }
        $historyText = implode("\n", $lines);
    }

    $emailLine = !empty($email) ? "  • Email: $email\n" : "";
    $typeLine = (!empty($type) && $type !== '-') ? "  • Loại Data: $type\n" : "";

    $roundTitle = !empty($roundName) ? " - " . mb_strtoupper($roundName, 'UTF-8') : "";
    $text = "🔄 [ KHÁCH HÀNG ĐĂNG KÝ LẠI$roundTitle ] 🔄\n"
        . "🕒 Đây là tin nhắn thông báo không tính vào vòng phân bổ\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào $consultantName, khách hàng cũ của bạn vừa đăng ký lại trên hệ thống:\n\n"
        . "👤 THÔNG TIN KHÁCH HÀNG:\n"
        . "  • Tên KH: $fName\n"
        . "  • Số ĐT: $fPhone\n"
        . $emailLine
        . $typeLine
        . "  • Nguồn: $fSource\n";

    if (!empty($roundName)) {
        $text .= "  • Vòng: $roundName\n";
    }

    $text .= "\n📝 GHI CHÚ MỚI:\n"
        . "  $fNote\n";

    if (!empty($historyText)) {
        $text .= "\n📜 LỊCH SỬ PHÂN BỔ GẦN NHẤT:\n"
            . $historyText . "\n";
    }

    $text .= "\n⚡ Vui lòng liên hệ lại với khách hàng sớm nhất có thể!";
    $text .= "\n━━━━━━━━━━━━━━━━━━━━━";

    return sendZaloMessage($botToken, $chatId, $text, $sync, $leadId);
}

/**
 * Gửi thông báo chia Lead fallback trực tiếp cho Admin qua Zalo
 */
function sendLeadAssignedZaloMessageToAdmin($adminChatId, $adminName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $leadId = 0, $leadEmail = '', $leadType = '', $sync = false)
{
    global $conn;

    // Gửi song song qua Telegram Bot trước (không phụ thuộc vào Zalo)
    if (file_exists(__DIR__ . '/telegram_bot.php')) {
        require_once __DIR__ . '/telegram_bot.php';
        $teleAdminGroupChatId = get_system_setting($conn, 'telegram_admin_group_chat_id');
        if (!empty($teleAdminGroupChatId)) {
            sendLeadAssignedTelegramMessageToAdmin($teleAdminGroupChatId, $adminName, $leadName, $leadPhone, $leadNote, $leadSource, $leadId, $leadEmail, $leadType);
        }
    }

    $botToken = get_system_setting($conn, 'zalo_bot_token');
    if (empty($botToken) || empty($adminChatId) || strtolower($adminChatId) === 'chưa liên kết') {
        return false;
    }

    $email = $leadEmail;
    $type = $leadType;
    if (empty($email) || empty($type)) {
        if ($leadId > 0) {
            $stmt = $conn->prepare("SELECT email, type FROM leads WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $leadId);
                $stmt->execute();
                $res = $stmt->get_result();
                if ($res && $res->num_rows > 0) {
                    $row = $res->fetch_assoc();
                    if (empty($email))
                        $email = $row['email'] ?? '';
                    if (empty($type))
                        $type = $row['type'] ?? '';
                }
                $stmt->close();
            }
        }
    }

    $fName = !empty($leadName) ? $leadName : "Không có";
    $fPhone = !empty($leadPhone) ? $leadPhone : "Không có";
    $fSource = !empty($leadSource) ? $leadSource : "Không có";
    $fNote = !empty($leadNote) ? $leadNote : "Không có";

    $emailLine = !empty($email) ? "  • Email: $email\n" : "";
    $typeLine = (!empty($type) && $type !== '-') ? "  • Loại Data: $type\n" : "";

    $text = "⚠️ [ THÔNG BÁO DATA FALLBACK ] ⚠️\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào Quản trị viên $adminName, hệ thống vừa phân bổ trực tiếp cho bạn 1 data bị fallback:\n\n"
        . "👤 THÔNG TIN KHÁCH HÀNG:\n"
        . "  • Tên KH: $fName\n"
        . "  • Số ĐT: $fPhone\n"
        . $emailLine
        . $typeLine
        . "  • Nguồn: $fSource\n"
        . "\n📝 GHI CHÚ:\n"
        . "  $fNote\n\n"
        . "💡 Data này không khớp với bất kỳ quy luật nào và được chuyển thẳng cho bạn.\n"
        . "━━━━━━━━━━━━━━━━━━━━━";

    return sendZaloMessage($botToken, $adminChatId, $text, $sync);
}

function sendCompensationAddedZaloMessageToSale($consultantId, $consultantName, $roundName, $amount, $adminName = 'Quản trị viên', $reason = '', $time = '', $sync = false)
{
    global $conn;
    if (empty($time))
        $time = date('H:i:s d/m/Y');

    // Gửi song song qua Telegram Bot trước (không phụ thuộc vào Zalo)
    if (file_exists(__DIR__ . '/telegram_bot.php')) {
        require_once __DIR__ . '/telegram_bot.php';
        sendCompensationAddedTelegramMessageToSale($consultantId, $consultantName, $roundName, $amount, $adminName, $reason, $time);
    }

    $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
    $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
    if (!$botToken)
        return false;

    $stmtC = $conn->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ?");
    $stmtC->bind_param('i', $consultantId);
    $stmtC->execute();
    $resC = $stmtC->get_result();
    $chatId = '';
    if ($resC->num_rows > 0) {
        $chatId = trim($resC->fetch_assoc()['zalo_chat_id'] ?? '');
    }
    $stmtC->close();
    if (empty($chatId) || strtolower($chatId) === 'chưa liên kết')
        return false;

    $reasonStr = !empty($reason) ? "  • Lý do: $reason\n" : "";

    $msg = "🎁 [ THÔNG BÁO BÙ DATA CHỦ ĐỘNG ] 🎁\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Xin chào $consultantName,\n\n"
        . "Admin $adminName vừa thực hiện bù chủ động thêm $amount data cho bạn tại vòng: $roundName.\n\n"
        . "  • Thời gian: $time\n"
        . $reasonStr
        . "\n💡 Khi hệ thống có khách hàng mới phù hợp, data sẽ tự động ưu tiên phân bổ thêm cho bạn.\n\n"
        . "Trân trọng,\nHệ thống Quản lý Domation DATA\n"
        . "━━━━━━━━━━━━━━━━━━━━━";

    return sendZaloMessage($botToken, $chatId, $msg, $sync);
}

function sendCompensationAddedZaloMessageToAdmin($adminChatId, $adminName, $consultantName, $roundName, $amount, $operatorName, $reason = '', $time = '', $sync = false)
{
    global $conn;
    if (empty($time))
        $time = date('H:i:s d/m/Y');

    // Gửi song song qua Telegram Bot trước (không phụ thuộc vào Zalo)
    if (file_exists(__DIR__ . '/telegram_bot.php')) {
        require_once __DIR__ . '/telegram_bot.php';
        $teleAdminGroupChatId = get_system_setting($conn, 'telegram_admin_group_chat_id');
        if (!empty($teleAdminGroupChatId)) {
            sendCompensationAddedTelegramMessageToAdmin($teleAdminGroupChatId, $adminName, $consultantName, $roundName, $amount, $operatorName, $reason, $time);
        }
    }

    $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
    $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
    if (!$botToken || empty($adminChatId) || strtolower($adminChatId) === 'chưa liên kết')
        return false;

    $reasonStr = !empty($reason) ? "  • Lý do: $reason\n" : "";

    $msg = "🔔 [ BÁO CÁO BÙ DATA CHỦ ĐỘNG ] 🔔\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Xin chào Quản trị viên $adminName,\n\n"
        . "Quản trị viên $operatorName vừa thực hiện bù chủ động data cho Sale:\n"
        . "  • Sale nhận: $consultantName\n"
        . "  • Số lượng: $amount data\n"
        . "  • Vòng: $roundName\n"
        . "  • Thời gian: $time\n"
        . $reasonStr
        . "\n━━━━━━━━━━━━━━━━━━━━━";

    return sendZaloMessage($botToken, $adminChatId, $msg, $sync);
}

/**
 * Tạo báo cáo phân bổ và ticket trong khoảng thời gian xác định
 */
function getReportByTimeWindow($conn, $startTimestamp, $endTimestamp, $windowLabel = '')
{
    $stmtData = $conn->prepare("
        SELECT c.id, c.name, dl.status, COUNT(*) as cnt
            FROM distribution_logs dl 
            JOIN consultants c ON dl.assigned_to = c.id 
            WHERE dl.received_at >= ?
              AND dl.received_at <= ?
              AND dl.status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours', 'reminder')
            GROUP BY c.id, dl.status
    ");
    if (!$stmtData) {
        return "⚠️ Lỗi hệ thống: Không thể chuẩn bị câu lệnh truy vấn dữ liệu.";
    }

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

    $sumRoundTotal = 0;
    $sumCompensation = 0;
    $sumReminder = 0;
    $totalData = 0;
    $totalReminder = 0;
    foreach ($saleList as $saleItem) {
        $normalTotal = $saleItem['normal_total'];
        $reminderTotal = $saleItem['reminder_total'];
        $compensation = $saleItem['compensation'];
        $roundTotal = max(0, $normalTotal - $compensation);

        $sumRoundTotal += $roundTotal;
        $sumCompensation += $compensation;
        $sumReminder += $reminderTotal;
        $totalData += $normalTotal;
        $totalReminder += $reminderTotal;
    }

    $stmtTicket = $conn->prepare("
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status IN ('approved', 'approved_no_comp') THEN 1 ELSE 0 END) as approved_count,
               SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
               SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
        FROM data_reports 
        WHERE created_at >= ?
          AND created_at <= ?
    ");
    $totalTicket = 0;
    $approvedTicket = 0;
    $rejectedTicket = 0;
    $pendingTicket = 0;
    if ($stmtTicket) {
        $stmtTicket->bind_param("ss", $startTimestamp, $endTimestamp);
        $stmtTicket->execute();
        $resTicket = $stmtTicket->get_result();
        if ($resTicket && $row = $resTicket->fetch_assoc()) {
            $totalTicket = (int) $row['total'];
            $approvedTicket = (int) ($row['approved_count'] ?? 0);
            $rejectedTicket = (int) ($row['rejected_count'] ?? 0);
            $pendingTicket = (int) ($row['pending_count'] ?? 0);
        }
        $stmtTicket->close();
    }

    // Lấy số data bị chặn trong kỳ báo cáo (blacklist)
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

    // Lấy số data bị AI tạm giữ và dưới chuẩn trong kỳ báo cáo
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

    $msg = "📊 [ BÁO CÁO TỔNG KẾT NGÀY ] 📊\n";
    $msg .= "━━━━━━━━━━\n";
    $msg .= "⏱️ Kỳ báo cáo: " . ($windowLabel ?: "$startTimestamp → $endTimestamp") . "\n\n";
    $msg .= "📥 TỔNG QUAN CHIA SỐ:\n";
    $msg .= "  • Tổng số data: " . $totalData . " data\n";
    $msg .= "    └─ " . $sumRoundTotal . " chia vòng\n";
    $msg .= "    └─ " . $sumCompensation . " bù\n";
    $msg .= "    └─ " . $sumReminder . " 🕒 nhắc trùng\n\n";
    $msg .= "🤖 AI PRE-SCREENER:\n";
    $msg .= "  • Số lead bị AI tạm giữ: $totalHeldByAI\n";
    $msg .= "  • Số lead dưới chuẩn: $totalBelowStandard\n";
    $msg .= "  • Tổng AI đang giữ hiện tại: $totalHoldingGlobal\n\n";
    $msg .= "🎫 BÁO CÁO LỖI (TICKETS):\n";
    if ($totalTicket > 0) {
        $msg .= "  • Tổng số ticket phát sinh: $totalTicket ⚠️\n";
        $msg .= "  • ✅ Thành công (đã duyệt): $approvedTicket\n";
        $msg .= "  • ❌ Thất bại (bị từ chối): $rejectedTicket\n";
        $msg .= "  • ⏳ Chờ duyệt: $pendingTicket\n";
    } else {
        $msg .= "  • Tổng số ticket phát sinh: 0\n";
    }
    $msg .= "  • Tổng ticket đang chờ hiện tại: $totalPendingTicketsGlobal\n\n";
    $msg .= "🚫 CHẶN DATA (BLACKLIST):\n";
    $msg .= "  • Tổng số data bị chặn: $totalBlocked\n";
    $msg .= "━━━━━━━━━━\n";
    $msg .= "💡 Gõ /report dd/mm hoặc /report dd/mm to dd/mm để xem báo cáo.\n";
    $msg .= "💡 Gõ /tools để xem các câu lệnh nhanh.";

    return $msg;
}

/**
 * Phân tích khoảng ngày báo cáo từ text
 */
function parseReportDateRange($text)
{
    // Chuẩn hóa khoảng trắng
    $text = preg_replace('/\s+/', ' ', trim($text));
    preg_match_all('/\b\d{1,2}[\/\-\.\s]\d{1,2}([\/\-\.\s]\d{4})?\b/', $text, $matches);

    if (empty($matches[0])) {
        return null;
    }

    $date1Str = $matches[0][0];
    $date2Str = isset($matches[0][1]) ? $matches[0][1] : '';

    $d1 = parseSingleDate($date1Str);
    if (!$d1)
        return null;

    if (empty($date2Str)) {
        return [
            'start' => $d1 . ' 00:00:00',
            'end' => $d1 . ' 23:59:59',
            'label' => date('d/m/Y', strtotime($d1))
        ];
    }

    $d2 = parseSingleDate($date2Str);
    if (!$d2)
        return null;

    if (strtotime($d1) > strtotime($d2)) {
        $temp = $d1;
        $d1 = $d2;
        $d2 = $temp;
    }

    return [
        'start' => $d1 . ' 00:00:00',
        'end' => $d2 . ' 23:59:59',
        'label' => date('d/m/Y', strtotime($d1)) . ' → ' . date('d/m/Y', strtotime($d2))
    ];
}

/**
 * Phân tích ngày đơn lẻ
 */
function parseSingleDate($str)
{
    $str = preg_replace('/[\/\-\.\s]+/', '/', trim($str));

    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $str, $m)) {
        $day = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $year = $m[3];
        if (checkdate((int) $month, (int) $day, (int) $year)) {
            return "$year-$month-$day";
        }
    }
    if (preg_match('/^(\d{1,2})\/(\d{1,2})$/', $str, $m)) {
        $day = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $year = date('Y');
        if (checkdate((int) $month, (int) $day, (int) $year)) {
            return "$year-$month-$day";
        }
    }
    return null;
}

/**
 * Gửi tin nhắn chào buổi sáng gom nhóm data cho Sale qua Zalo
 */
function sendZaloReleaseSummaryMessageToSale($consultantId, $consultantName, $minTimeStr, $maxTimeStr, $count, $sync = false)
{
    global $conn;

    // Lấy config zalo_bot_token từ system_settings
    $botToken = get_system_setting($conn, 'zalo_bot_token');

    if (empty($botToken)) {
        return false; // Chưa cấu hình Zalo Bot
    }

    // Lấy zalo_chat_id của Sale có dùng cache
    static $chatIdCache = [];
    if (isset($chatIdCache[$consultantId])) {
        $chatId = $chatIdCache[$consultantId];
    } else {
        $stmtConsultant = $conn->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
        if (!$stmtConsultant)
            return false;

        $stmtConsultant->bind_param("i", $consultantId);
        $stmtConsultant->execute();
        $res = $stmtConsultant->get_result();
        $chatId = '';
        if ($res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $chatId = $row['zalo_chat_id'];
        }
        $stmtConsultant->close();
        $chatIdCache[$consultantId] = $chatId;
    }

    if (empty($chatId)) {
        return false; // Sale chưa liên kết Zalo
    }

    // Build nội dung tin nhắn
    $text = "[ THÔNG BÁO NHẬN DATA SAU GIỜ LÀM ]\n\n"
        . "Chào $consultantName, chúc bạn một ngày mới đầy năng lượng!\n\n"
        . "Tối qua từ $minTimeStr đến $maxTimeStr bạn có $count data chờ xử lý.\n"
        . "Hệ thống sẽ bàn giao chi tiết các data ngay sau đây...";

    // Gửi song song qua Telegram Bot
    if (file_exists(__DIR__ . '/telegram_bot.php')) {
        require_once __DIR__ . '/telegram_bot.php';
        sendTelegramReleaseSummaryMessageToSale($consultantId, $consultantName, $minTimeStr, $maxTimeStr, $count);
    }

    return sendZaloMessage($botToken, $chatId, $text, $sync);
}

/**
 * Tạo nội dung báo cáo tuần cho một Consultant/Sale cụ thể
 */
function generateWeeklyReportMessage($conn, $sale, $startTimestamp, $endTimestamp)
{
    $saleId = $sale['id'];
    $saleName = $sale['name'];
    $saleEmail = $sale['email'];

    $windowStart = date('H:i d/m/Y', strtotime($startTimestamp));
    $windowEnd = date('H:i d/m/Y', strtotime($endTimestamp));

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
            'total' => (int) $row['total'],
            'comp_received' => (int) $row['comp_received']
        ];
        $roundDetailsHtml .= '<li>Vòng <strong>' . htmlspecialchars($row['round_name']) . '</strong>: ' . (int) $row['total'] . ' data (trong đó đã đền bù: ' . (int) $row['comp_received'] . ')</li>';
        $totalData += (int) $row['total'];
        $totalCompReceived += (int) $row['comp_received'];
    }
    $stmtData->close();

    if (empty($roundDetailsHtml)) {
        $roundDetailsHtml = '<li>Bạn không nhận được data nào trong tuần này.</li>';
    }

    // Query tickets (data_reports) raised by this sale in the time window
    $stmtTicket = $conn->prepare("
        SELECT 
            SUM(CASE WHEN status IN ('approved', 'approved_no_comp') THEN 1 ELSE 0 END) as approved_tickets,
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

    $approvedTickets = (int) ($resTicket['approved_tickets'] ?? 0);
    $rejectedTickets = (int) ($resTicket['rejected_tickets'] ?? 0);
    $pendingTickets = (int) ($resTicket['pending_tickets'] ?? 0);
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

    $totalCompOwed = (int) ($resCompOwed['total_owed'] ?? 0);

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

    // Construct Zalo message content with beautiful emojis/icons and premium styling
    $msg = "📊 [ BÁO CÁO TUẦN ] 📊\n";
    $msg .= "👤 Sale: $saleName\n";
    $msg .= "📅 Kỳ: $windowStart → $windowEnd\n";
    $msg .= "____\n\n";

    $msg .= "📥 DATA NHẬN: $totalData data\n";
    if ($totalData > 0) {
        foreach ($roundDetails as $rd) {
            $msg .= "  • Vòng \"{$rd['name']}\": {$rd['total']} (Đã bù: {$rd['comp_received']})\n";
        }
    } else {
        $msg .= "  • Không nhận data nào trong tuần này.\n";
    }

    $msg .= "\n🎫 VÉ LỖI (TICKETS): $totalTickets\n";
    $msg .= "  • ✅ Thành công: $approvedTickets\n";
    $msg .= "  • ❌ Thất bại: $rejectedTickets\n";
    $msg .= "  • ⏳ Chờ duyệt: $pendingTickets\n";

    $msg .= "\n🎁 ĐỀN BÙ:\n";
    $msg .= "  • 🔄 Đã bù tuần này: $totalCompReceived lượt\n";
    $msg .= "  • ⏳ Chờ bù tiếp theo: $totalCompOwed lượt\n";

    $msg .= "\n🔗 Link Portal: $portalUrl\n";
    $msg .= "____\n";
    $msg .= "✨ Chúc bạn một tuần mới tràn đầy năng lượng và bùng nổ doanh số! 🚀";

    return [
        'msg' => $msg,
        'roundDetailsHtml' => $roundDetailsHtml,
        'totalData' => $totalData,
        'totalTickets' => $totalTickets,
        'approvedTickets' => $approvedTickets,
        'rejectedTickets' => $rejectedTickets,
        'pendingTickets' => $pendingTickets,
        'totalCompReceived' => $totalCompReceived,
        'totalCompOwed' => $totalCompOwed,
        'windowStart' => $windowStart,
        'windowEnd' => $windowEnd
    ];
}

/**
 * Tạo nội dung báo cáo tháng cho một Consultant/Sale cụ thể
 */
function generateMonthlyReportMessage($conn, $sale, $startTimestamp, $endTimestamp)
{
    $saleId = $sale['id'];
    $saleName = $sale['name'];
    $saleEmail = $sale['email'];

    $windowStart = date('d/m/Y', strtotime($startTimestamp));
    $windowEnd = date('d/m/Y', strtotime($endTimestamp));

    // Query data breakdown similar to daily report but filtered by this consultant
    $stmtData = $conn->prepare("
        SELECT dl.status, COUNT(*) as cnt
        FROM distribution_logs dl
        WHERE dl.assigned_to = ?
          AND dl.received_at >= ?
          AND dl.received_at <= ?
          AND dl.status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours', 'reminder')
        GROUP BY dl.status
    ");
    $stmtData->bind_param("iss", $saleId, $startTimestamp, $endTimestamp);
    $stmtData->execute();
    $resData = $stmtData->get_result();

    $stats = [
        'assigned' => 0,
        'compensation' => 0,
        'rule_6_month' => 0,
        'pending_work_hours' => 0,
        'error' => 0,
        'reminder' => 0
    ];
    if ($resData) {
        while ($row = $resData->fetch_assoc()) {
            $status = $row['status'];
            if (isset($stats[$status])) {
                $stats[$status] = (int) $row['cnt'];
            }
        }
    }
    $stmtData->close();

    $normalTotal = $stats['assigned'] + $stats['compensation'] + $stats['rule_6_month'] + $stats['pending_work_hours'] + max(0, $stats['error'] - $stats['compensation']);
    $reminderTotal = $stats['reminder'];
    $compensation = $stats['compensation'];
    $roundTotal = max(0, $normalTotal - $compensation);

    // Query tickets (data_reports) raised by this sale in the time window
    $stmtTicket = $conn->prepare("
        SELECT 
            SUM(CASE WHEN status IN ('approved', 'approved_no_comp') THEN 1 ELSE 0 END) as approved_tickets,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_tickets,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tickets
        FROM data_reports
        WHERE consultant_id = ?
          AND created_at >= ?
          AND created_at <= ?
    ");
    $stmtTicket->bind_param("iss", $saleId, $startTimestamp, $endTimestamp);
    $stmtTicket->execute();
    $resTicket = $stmtTicket->get_result();
    
    $approvedTickets = 0;
    $rejectedTickets = 0;
    $pendingTickets = 0;
    if ($resTicket && $row = $resTicket->fetch_assoc()) {
        $approvedTickets = (int) ($row['approved_tickets'] ?? 0);
        $rejectedTickets = (int) ($row['rejected_tickets'] ?? 0);
        $pendingTickets = (int) ($row['pending_tickets'] ?? 0);
    }
    $stmtTicket->close();
    $totalTickets = $approvedTickets + $rejectedTickets + $pendingTickets;

    // Query current compensation settings (tổng bù còn lại) in all rounds for this consultant
    $stmtCompOwed = $conn->prepare("
        SELECT SUM(compensation_count) as total_owed
        FROM round_consultants
        WHERE consultant_id = ?
    ");
    $stmtCompOwed->bind_param("i", $saleId);
    $stmtCompOwed->execute();
    $resCompOwed = $stmtCompOwed->get_result();
    
    $totalCompOwed = 0;
    if ($resCompOwed && $row = $resCompOwed->fetch_assoc()) {
        $totalCompOwed = (int) ($row['total_owed'] ?? 0);
    }
    $stmtCompOwed->close();

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

    // Construct Zalo message content
    $msg = "📊 [ BÁO CÁO THÁNG ] 📊\n";
    $msg .= "👤 Sale: $saleName\n";
    $msg .= "📅 Kỳ: $windowStart → $windowEnd\n";
    $msg .= "____\n\n";

    $msg .= "📥 DATA NHẬN: $normalTotal data\n";
    $msg .= "  • 🔄 Chia vòng: $roundTotal data\n";
    $msg .= "  • 🎁 Bù: $compensation data\n";
    $msg .= "  • ⏳ Nhắc lại: $reminderTotal data\n";

    $msg .= "\n🎫 VÉ LỖI (TICKETS): $totalTickets\n";
    $msg .= "  • ✅ Thành công: $approvedTickets\n";
    $msg .= "  • ❌ Thất bại: $rejectedTickets\n";
    $msg .= "  • ⏳ Chờ duyệt: $pendingTickets\n";

    $msg .= "\n🎁 ĐỀN BÙ:\n";
    $msg .= "  • 🔄 Đã bù tháng này: $compensation lượt\n";
    $msg .= "  • ⏳ Chờ bù tiếp theo: $totalCompOwed lượt\n";

    $msg .= "\n🔗 Link Portal: $portalUrl\n";
    $msg .= "____\n";
    $msg .= "✨ Chúc bạn một tháng mới tràn đầy năng lượng và bùng nổ doanh số! 🚀";

    return [
        'msg' => $msg,
        'totalData' => $normalTotal,
        'roundTotal' => $roundTotal,
        'compensation' => $compensation,
        'reminderTotal' => $reminderTotal,
        'totalTickets' => $totalTickets,
        'approvedTickets' => $approvedTickets,
        'rejectedTickets' => $rejectedTickets,
        'pendingTickets' => $pendingTickets,
        'totalCompReceived' => $compensation,
        'totalCompOwed' => $totalCompOwed,
        'windowStart' => $windowStart,
        'windowEnd' => $windowEnd
    ];
}


