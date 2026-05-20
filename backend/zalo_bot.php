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
function sendZaloMessage($botToken, $chatId, $text)
{
    if (empty($botToken) || empty($chatId) || empty($text)) {
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

    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 300 && $result) {
        $resObj = json_decode($result, true);
        if (isset($resObj['ok']) && $resObj['ok'] === true) {
            return true;
        } else {
            error_log("Zalo Bot Error: " . $result);
        }
    } else {
        error_log("Zalo Bot HTTP Error: $httpCode - " . $result);
    }

    return false;
}

/**
 * Gửi tin nhắn qua Zalo Bot Platform cho NHIỀU người cùng lúc (Concurrent cURL)
 *
 * @param string $botToken
 * @param array $chatIdsArray
 * @param string $text
 * @return bool
 */
function sendZaloMessageToMultiple($botToken, $chatIdsArray, $text)
{
    if (empty($botToken) || empty($chatIdsArray) || empty($text)) {
        return false;
    }

    $url = "https://bot-api.zaloplatforms.com/bot" . $botToken . "/sendMessage";
    $multiHandle = curl_multi_init();
    $curlHandles = [];

    // Lọc trùng ID và loại bỏ giá trị rỗng
    $chatIdsArray = array_unique(array_filter($chatIdsArray));

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
function sendLeadAssignedZaloMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $roundName = '', $leadId = 0, $roundId = 0)
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
        if (!$stmtConsultant) return false;
        
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
    $roundStr = !empty($roundName) ? " Vòng: $roundName\n" : "";
    $fName = !empty($leadName) ? $leadName : "Không có";
    $fPhone = !empty($leadPhone) ? $leadPhone : "Không có";
    $fSource = !empty($leadSource) ? $leadSource : "Không có";
    $fNote = !empty($leadNote) ? $leadNote : "Không có";

    // Build Report URL
    $frontendUrl = rtrim(get_system_setting($conn, 'frontend_url'), '/');
    if (empty($frontendUrl)) {
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $frontendUrl = $proto . '://' . preg_replace('/\/backend.*$/', '', $host);
    }
    $reportUrl = $frontendUrl . "/report-data?lead_id={$leadId}&sale_id={$consultantId}&round_id={$roundId}";
    $roundLine = !empty($roundName) ? "  • Vòng phân bổ: $roundName\n" : "";

    $roundTitle = !empty($roundName) ? " - " . mb_strtoupper($roundName, 'UTF-8') : "";
    $text = "[ THÔNG BÁO DATA MỚI$roundTitle ]\n\n"
        . "Chào $consultantName, hệ thống vừa phân bổ cho bạn một khách hàng mới:\n\n"
        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
        . "  • Tên KH: $fName\n"
        . "  • Số ĐT: $fPhone\n"
        . "  • Nguồn: $fSource\n"
        . $roundLine
        . "\n❖ GHI CHÚ:\n"
        . "  $fNote\n\n"
        . "Nếu Data bị sai SĐT hoặc trùng lặp, vui lòng báo cáo tại đây: $reportUrl";

    return sendZaloMessage($botToken, $chatId, $text);
}

/**
 * Gửi thông báo nhắc nhở Khách hàng cũ đăng ký lại cho Sale qua Zalo
 */
function sendLeadReminderZaloMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'zalo_bot_token');

    if (empty($botToken))
        return false;

    // Lấy zalo_chat_id của Sale có dùng cache
    static $chatIdCache = [];
    if (isset($chatIdCache[$consultantId])) {
        $chatId = $chatIdCache[$consultantId];
    } else {
        $stmtConsultant = $conn->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
        if (!$stmtConsultant) return false;
        
        $stmtConsultant->bind_param("i", $consultantId);
        $stmtConsultant->execute();
        $res = $stmtConsultant->get_result();
        $chatId = '';
        if ($res->num_rows > 0) {
            $chatId = $res->fetch_assoc()['zalo_chat_id'];
        }
        $stmtConsultant->close();
        $chatIdCache[$consultantId] = $chatId;
    }

    if (empty($chatId)) return false;

    $fName = !empty($leadName) ? $leadName : "Không có";
    $fPhone = !empty($leadPhone) ? $leadPhone : "Không có";
    $fSource = !empty($leadSource) ? $leadSource : "Không có";
    $fNote = !empty($leadNote) ? $leadNote : "Không có";

    $text = "[ KHÁCH HÀNG ĐĂNG KÝ LẠI - KHÔNG TÍNH VÒNG LEAD]\n\n"
        . "Chào $consultantName, khách hàng cũ của bạn vừa đăng ký lại trên hệ thống:\n\n"
        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
        . "  • Tên KH: $fName\n"
        . "  • Số ĐT: $fPhone\n"
        . "  • Nguồn: $fSource\n"
        . "\n❖ GHI CHÚ MỚI:\n"
        . "  $fNote\n\n"
        . "Vui lòng liên hệ lại với khách hàng sớm nhất có thể!";

    return sendZaloMessage($botToken, $chatId, $text);
}

/**
 * Gửi thông báo chia Lead fallback trực tiếp cho Admin qua Zalo
 */
function sendLeadAssignedZaloMessageToAdmin($adminChatId, $adminName, $leadName, $leadPhone, $leadNote = '', $leadSource = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'zalo_bot_token');

    if (empty($botToken) || empty($adminChatId)) {
        return false;
    }

    $fName = !empty($leadName) ? $leadName : "Không có";
    $fPhone = !empty($leadPhone) ? $leadPhone : "Không có";
    $fSource = !empty($leadSource) ? $leadSource : "Không có";
    $fNote = !empty($leadNote) ? $leadNote : "Không có";

    $text = "[ THÔNG BÁO DATA FALLBACK ]\n\n"
        . "Chào Quản trị viên $adminName, hệ thống vừa phân bổ trực tiếp cho bạn 1 data bị fallback:\n\n"
        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
        . "  • Tên KH: $fName\n"
        . "  • Số ĐT: $fPhone\n"
        . "  • Nguồn: $fSource\n"
        . "\n❖ GHI CHÚ:\n"
        . "  $fNote\n\n"
        . "Data này không khớp với bất kỳ quy luật nào và được chuyển thẳng cho bạn.";

    return sendZaloMessage($botToken, $adminChatId, $text);
}

function sendCompensationAddedZaloMessageToSale($consultantId, $consultantName, $roundName, $amount) {
    global $conn;
    $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
    $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
    if (!$botToken) return false;

    $stmtC = $conn->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ?");
    $stmtC->bind_param('i', $consultantId);
    $stmtC->execute();
    $resC = $stmtC->get_result();
    $stmtC->close();
    if ($resC->num_rows === 0) return false;
    $chatId = $resC->fetch_assoc()['zalo_chat_id'];
    if (!$chatId) return false;

    $msg = "[ THÔNG BÁO BÙ DATA ]\n\n";
    $msg .= "Xin chào $consultantName,\n\n";
    $msg .= "Quản trị viên vừa cập nhật bù thêm $amount data cho bạn tại vòng: $roundName.\n\n";
    $msg .= "Khi hệ thống có khách hàng mới phù hợp, data sẽ tự động ưu tiên phân bổ thêm cho bạn.\n\n";
    $msg .= "Trân trọng,\nHệ thống Quản lý Domation DATA";

    return sendZaloMessage($botToken, $chatId, $msg);
}
