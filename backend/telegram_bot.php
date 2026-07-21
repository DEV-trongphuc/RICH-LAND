<?php
// backend/telegram_bot.php

require_once __DIR__ . '/db_connect.php';

/**
 * Gửi tin nhắn qua Telegram Bot API
 *
 * @param string $botToken
 * @param string $chatId
 * @param string $text
 * @return bool
 */
function sendTelegramMessage($botToken, $chatId, $text)
{
    if (empty($botToken) || empty($chatId) || empty($text) || strtolower(trim($chatId)) === 'chưa liên kết') {
        return false;
    }

    $url = "https://api.telegram.org/bot" . $botToken . "/sendMessage";

    $payload = json_encode([
        "chat_id" => $chatId,
        "text" => $text,
        "parse_mode" => "HTML"
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 4);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Ghi nhận log gửi tin nhắn Telegram để kiểm tra lỗi
    $logMsg = date('[Y-m-d H:i:s]') . " Target ChatId: $chatId, HTTP: $httpCode, Request: $payload, Response: " . ($response ?: 'NO RESPONSE') . "\n";
    $logFile = __DIR__ . '/telegram_send_log.txt';
    if (file_exists($logFile) && @filesize($logFile) > 5 * 1024 * 1024) {
        $bakFile = __DIR__ . '/telegram_send_log.bak.txt';
        if (file_exists($bakFile)) {
            @unlink($bakFile);
        }
        @rename($logFile, $bakFile);
    }
    @file_put_contents($logFile, $logMsg, FILE_APPEND | LOCK_EX);

    return ($httpCode === 200);
}

/**
 * Gửi tin nhắn thông báo data mới cho Sale qua Telegram
 */
function sendLeadAssignedTelegramMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $roundName = '', $leadId = 0, $roundId = 0, $leadEmail = '', $leadType = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'telegram_bot_token');
    if (empty($botToken)) {
        return false;
    }

    $stmtConsultant = $conn->prepare("SELECT telegram_chat_id FROM consultants WHERE id = ? LIMIT 1");
    if (!$stmtConsultant) return false;
    $stmtConsultant->bind_param("i", $consultantId);
    $stmtConsultant->execute();
    $res = $stmtConsultant->get_result();
    $chatId = '';
    if ($res->num_rows > 0) {
        $chatId = $res->fetch_assoc()['telegram_chat_id'];
    }
    $stmtConsultant->close();

    if (empty($chatId)) {
        return false;
    }

    $roundTitle = !empty($roundName) ? " - " . mb_strtoupper($roundName, 'UTF-8') : "";
    $frontendUrl = get_system_setting($conn, 'frontend_url') ?: 'http://localhost:5173';
    $detailLink = rtrim($frontendUrl, '/') . "/leads?id=" . $leadId;

    $text = "📥 <b>[ THÔNG BÁO DATA MỚI" . htmlspecialchars($roundTitle) . " ]</b> 📥\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào <b>" . htmlspecialchars($consultantName) . "</b>,\n\n"
        . "Hệ thống vừa phân bổ cho bạn một khách hàng mới:\n"
        . " • <b>Tên KH:</b> " . htmlspecialchars($leadName) . "\n"
        . " • <b>Số ĐT:</b> " . htmlspecialchars($leadPhone) . "\n"
        . " • <b>Nguồn:</b> " . htmlspecialchars($leadSource) . "\n";
    
    if (!empty($leadEmail)) {
        $text .= " • <b>Email:</b> " . htmlspecialchars($leadEmail) . "\n";
    }
    if (!empty($leadType)) {
        $text .= " • <b>Loại:</b> " . htmlspecialchars($leadType) . "\n";
    }
    if (!empty($leadNote)) {
        $text .= " • <b>Ghi chú:</b> <i>" . htmlspecialchars($leadNote) . "</i>\n";
    }
    
    $res = sendTelegramMessage($botToken, $chatId, $text);
    if ($res && $leadId > 0) {
        $stmtUpdate = $conn->prepare("UPDATE leads SET telegram_notify_status = 'sent', telegram_notify_sent_at = NOW() WHERE id = ?");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("i", $leadId);
            $stmtUpdate->execute();
            $stmtUpdate->close();
        }
    } else if (!$res && $leadId > 0) {
        $stmtUpdate = $conn->prepare("UPDATE leads SET telegram_notify_status = 'failed' WHERE id = ?");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("i", $leadId);
            $stmtUpdate->execute();
            $stmtUpdate->close();
        }
    }
    return $res;
}

/**
 * Gửi thông báo nhắc nhở chăm sóc Lead cho Sale qua Telegram
 */
function sendLeadReminderTelegramMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $roundName = '', $timeline = [], $leadId = 0, $leadEmail = '', $leadType = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'telegram_bot_token');
    if (empty($botToken)) {
        return false;
    }

    $stmtConsultant = $conn->prepare("SELECT telegram_chat_id FROM consultants WHERE id = ? LIMIT 1");
    if (!$stmtConsultant) return false;
    $stmtConsultant->bind_param("i", $consultantId);
    $stmtConsultant->execute();
    $res = $stmtConsultant->get_result();
    $chatId = '';
    if ($res->num_rows > 0) {
        $chatId = $res->fetch_assoc()['telegram_chat_id'];
    }
    $stmtConsultant->close();

    if (empty($chatId)) {
        return false;
    }

    $frontendUrl = get_system_setting($conn, 'frontend_url') ?: 'http://localhost:5173';
    $detailLink = rtrim($frontendUrl, '/') . "/leads?id=" . $leadId;

    $text = "⏰ <b>[ NHẮC NHỞ CHĂM SÓC KHÁCH HÀNG ]</b> ⏰\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào <b>" . htmlspecialchars($consultantName) . "</b>,\n\n"
        . "Bạn có khách hàng mới đăng ký lại/nhắc lịch chăm sóc:\n"
        . " • <b>Tên KH:</b> " . htmlspecialchars($leadName) . "\n"
        . " • <b>Số ĐT:</b> " . htmlspecialchars($leadPhone) . "\n"
        . " • <b>Nguồn:</b> " . htmlspecialchars($leadSource) . "\n"
        . " • <b>Vòng:</b> " . htmlspecialchars($roundName) . "\n";

    if (!empty($leadNote)) {
        $text .= " • <b>Ghi chú:</b> <i>" . htmlspecialchars($leadNote) . "</i>\n";
    }

    $res = sendTelegramMessage($botToken, $chatId, $text);
    if ($res && $leadId > 0) {
        $stmtUpdate = $conn->prepare("UPDATE leads SET telegram_notify_status = 'sent', telegram_notify_sent_at = NOW() WHERE id = ?");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("i", $leadId);
            $stmtUpdate->execute();
            $stmtUpdate->close();
        }
    } else if (!$res && $leadId > 0) {
        $stmtUpdate = $conn->prepare("UPDATE leads SET telegram_notify_status = 'failed' WHERE id = ?");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("i", $leadId);
            $stmtUpdate->execute();
            $stmtUpdate->close();
        }
    }
    return $res;
}

/**
 * Gửi thông báo có Lead mới cho Admin qua Telegram
 */
function sendLeadAssignedTelegramMessageToAdmin($adminChatId, $adminName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $leadId = 0, $leadEmail = '', $leadType = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'telegram_bot_token');
    if (empty($botToken) || empty($adminChatId)) {
        return false;
    }

    $text = "📢 <b>[ THÔNG BÁO HỆ THỐNG - DATA MỚI ]</b> 📢\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào <b>" . htmlspecialchars($adminName) . "</b>,\n\n"
        . "Hệ thống vừa tiếp nhận và phân bổ khách hàng:\n"
        . " • <b>Tên KH:</b> " . htmlspecialchars($leadName) . "\n"
        . " • <b>Số ĐT:</b> " . htmlspecialchars($leadPhone) . "\n"
        . " • <b>Nguồn:</b> " . htmlspecialchars($leadSource) . "\n";

    if (!empty($leadNote)) {
        $text .= " • <b>Ghi chú:</b> <i>" . htmlspecialchars($leadNote) . "</i>\n";
    }
    $text .= "━━━━━━━━━━━━━━━━━━━━━";

    return sendTelegramMessage($botToken, $adminChatId, $text);
}

/**
 * Gửi thông báo được bù số cho Sale qua Telegram
 */
function sendCompensationAddedTelegramMessageToSale($consultantId, $consultantName, $roundName, $amount, $adminName = 'Quản trị viên', $reason = '', $time = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'telegram_bot_token');
    if (empty($botToken)) {
        return false;
    }

    $stmtConsultant = $conn->prepare("SELECT telegram_chat_id FROM consultants WHERE id = ? LIMIT 1");
    if (!$stmtConsultant) return false;
    $stmtConsultant->bind_param("i", $consultantId);
    $stmtConsultant->execute();
    $res = $stmtConsultant->get_result();
    $chatId = '';
    if ($res->num_rows > 0) {
        $chatId = $res->fetch_assoc()['telegram_chat_id'];
    }
    $stmtConsultant->close();

    if (empty($chatId)) {
        return false;
    }

    $text = "🎁 <b>[ THÔNG BÁO CỘNG ĐỀN BÙ DATA ]</b> 🎁\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào <b>" . htmlspecialchars($consultantName) . "</b>,\n\n"
        . "Bạn vừa được cộng thêm lượt bù data trong vòng <b>" . htmlspecialchars($roundName) . "</b>:\n"
        . " • <b>Số lượng cộng:</b> +" . htmlspecialchars($amount) . " data\n"
        . " • <b>Người thực hiện:</b> " . htmlspecialchars($adminName) . "\n";

    if (!empty($reason)) {
        $text .= " • <b>Lý do:</b> <i>" . htmlspecialchars($reason) . "</i>\n";
    }
    if (!empty($time)) {
        $text .= " • <b>Thời gian:</b> " . htmlspecialchars($time) . "\n";
    }
    
    $text .= "━━━━━━━━━━━━━━━━━━━━━";

    return sendTelegramMessage($botToken, $chatId, $text);
}

/**
 * Gửi thông báo đền bù số cho Admin qua Telegram
 */
function sendCompensationAddedTelegramMessageToAdmin($adminChatId, $adminName, $consultantName, $roundName, $amount, $operatorName, $reason = '', $time = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'telegram_bot_token');
    if (empty($botToken) || empty($adminChatId)) {
        return false;
    }

    $text = "⚙️ <b>[ THÔNG BÁO CỘNG BÙ DATA (ADMIN) ]</b> ⚙️\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào <b>" . htmlspecialchars($adminName) . "</b>,\n\n"
        . "Tài khoản <b>" . htmlspecialchars($operatorName) . "</b> vừa thực hiện cộng bù số:\n"
        . " • <b>Nhân sự nhận:</b> " . htmlspecialchars($consultantName) . "\n"
        . " • <b>Vòng áp dụng:</b> " . htmlspecialchars($roundName) . "\n"
        . " • <b>Số lượng:</b> +" . htmlspecialchars($amount) . " lượt\n";

    if (!empty($reason)) {
        $text .= " • <b>Lý do:</b> <i>" . htmlspecialchars($reason) . "</i>\n";
    }
    if (!empty($time)) {
        $text .= " • <b>Thời gian:</b> " . htmlspecialchars($time) . "\n";
    }
    $text .= "━━━━━━━━━━━━━━━━━━━━━";

    return sendTelegramMessage($botToken, $adminChatId, $text);
}

/**
 * Gửi thông báo thống kê thu hồi/giải phóng data cho Sale qua Telegram
 */
function sendTelegramReleaseSummaryMessageToSale($consultantId, $consultantName, $minTimeStr, $maxTimeStr, $count)
{
    global $conn;

    $botToken = get_system_setting($conn, 'telegram_bot_token');
    if (empty($botToken)) {
        return false;
    }

    $stmtConsultant = $conn->prepare("SELECT telegram_chat_id FROM consultants WHERE id = ? LIMIT 1");
    if (!$stmtConsultant) return false;
    $stmtConsultant->bind_param("i", $consultantId);
    $stmtConsultant->execute();
    $res = $stmtConsultant->get_result();
    $chatId = '';
    if ($res->num_rows > 0) {
        $chatId = $res->fetch_assoc()['telegram_chat_id'];
    }
    $stmtConsultant->close();

    if (empty($chatId)) {
        return false;
    }

    $text = "♻️ <b>[ THÔNG BÁO THU HỒI DATA CHƯA LIÊN HỆ ]</b> ♻️\n"
        . "━━━━━━━━━━━━━━━━━━━━━\n"
        . "Chào <b>" . htmlspecialchars($consultantName) . "</b>,\n\n"
        . "Hệ thống vừa thực hiện tự động thu hồi/giải phóng các data quá hạn liên hệ của bạn:\n"
        . " • <b>Số lượng:</b> " . htmlspecialchars($count) . " data\n"
        . " • <b>Thời gian phân bổ:</b> Từ " . htmlspecialchars($minTimeStr) . " đến " . htmlspecialchars($maxTimeStr) . "\n\n"
        . "💡 <i>Các data bị thu hồi sẽ được đưa vào Kho data chung để chia lại. Vui lòng liên hệ mới kịp thời để tránh mất số.</i>\n"
        . "━━━━━━━━━━━━━━━━━━━━━";

    return sendTelegramMessage($botToken, $chatId, $text);
}
