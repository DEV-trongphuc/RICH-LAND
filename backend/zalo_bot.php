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

    // Ghi nhận log gửi tin nhắn Zalo để kiểm tra lỗi
    $logMsg = date('[Y-m-d H:i:s]') . " Target ChatId: $chatId, HTTP: $httpCode, Request: $payload, Response: " . ($result ?: 'NO RESPONSE') . "\n";
    file_put_contents(__DIR__ . '/zalo_send_log.txt', $logMsg, FILE_APPEND);

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
function sendLeadAssignedZaloMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $roundName = '', $leadId = 0, $roundId = 0, $leadEmail = '', $leadType = '')
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
                    if (empty($email)) $email = $row['email'] ?? '';
                    if (empty($type)) $type = $row['type'] ?? '';
                }
                $stmt->close();
            }
        }
    }

    // Build nội dung tin nhắn
    $roundStr = !empty($roundName) ? " Vòng: $roundName\n" : "";
    $fName = !empty($leadName) ? $leadName : "Không có";
    $fPhone = !empty($leadPhone) ? $leadPhone : "Không có";
    $fSource = !empty($leadSource) ? $leadSource : "Không có";
    $fNote = !empty($leadNote) ? $leadNote : "Không có";

    $emailLine = !empty($email) ? "  • Email: $email\n" : "";
    $typeLine = (!empty($type) && $type !== '-') ? "  • Loại Data: $type\n" : "";

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
        . $emailLine
        . $typeLine
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
function sendLeadReminderZaloMessageToSale($consultantId, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $roundName = '', $timeline = [], $leadId = 0, $leadEmail = '', $leadType = '')
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
                    if (empty($email)) $email = $row['email'] ?? '';
                    if (empty($type)) $type = $row['type'] ?? '';
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
                    if (empty($email)) $email = $row['email'] ?? '';
                    if (empty($type)) $type = $row['type'] ?? '';
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
            if (!empty($t['round_name'])) $parts[] = "Vòng: " . $t['round_name'];
            if (!empty($t['consultant_name'])) $parts[] = "Sale: " . $t['consultant_name'];
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

    $text = "[ KHÁCH HÀNG ĐĂNG KÝ LẠI - KHÔNG TÍNH VÒNG LEAD ]\n\n"
        . "Chào $consultantName, khách hàng cũ của bạn vừa đăng ký lại trên hệ thống:\n\n"
        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
        . "  • Tên KH: $fName\n"
        . "  • Số ĐT: $fPhone\n"
        . $emailLine
        . $typeLine
        . "  • Nguồn: $fSource\n";
    
    if (!empty($roundName)) {
        $text .= "  • Vòng: $roundName\n";
    }

    $text .= "\n❖ GHI CHÚ MỚI:\n"
        . "  $fNote\n";

    if (!empty($historyText)) {
        $text .= "\n❖ LỊCH SỬ GẦN NHẤT:\n"
            . $historyText . "\n";
    }

    $text .= "\nVui lòng liên hệ lại với khách hàng sớm nhất có thể!";

    // Build Report URL
    $reportUrl = '';
    if ($leadId > 0) {
        $frontendUrl = rtrim(get_system_setting($conn, 'frontend_url'), '/');
        if (empty($frontendUrl)) {
            $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $frontendUrl = $proto . '://' . preg_replace('/\/backend.*$/', '', $host);
        }
        $reportUrl = $frontendUrl . "/report-data?lead_id={$leadId}&sale_id={$consultantId}&round_id=0";
    }

    if (!empty($reportUrl)) {
        $text .= "\n\nNếu Data bị sai SĐT hoặc trùng lặp, vui lòng báo cáo tại đây: $reportUrl";
    }

    return sendZaloMessage($botToken, $chatId, $text);
}

/**
 * Gửi thông báo chia Lead fallback trực tiếp cho Admin qua Zalo
 */
function sendLeadAssignedZaloMessageToAdmin($adminChatId, $adminName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $leadId = 0, $leadEmail = '', $leadType = '')
{
    global $conn;

    $botToken = get_system_setting($conn, 'zalo_bot_token');

    if (empty($botToken) || empty($adminChatId)) {
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
                    if (empty($email)) $email = $row['email'] ?? '';
                    if (empty($type)) $type = $row['type'] ?? '';
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

    $text = "[ THÔNG BÁO DATA FALLBACK ]\n\n"
        . "Chào Quản trị viên $adminName, hệ thống vừa phân bổ trực tiếp cho bạn 1 data bị fallback:\n\n"
        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
        . "  • Tên KH: $fName\n"
        . "  • Số ĐT: $fPhone\n"
        . $emailLine
        . $typeLine
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
    $chatId = '';
    if ($resC->num_rows > 0) {
        $chatId = $resC->fetch_assoc()['zalo_chat_id'];
    }
    $stmtC->close();
    if (!$chatId) return false;

    $msg = "[ THÔNG BÁO BÙ DATA ]\n\n";
    $msg .= "Xin chào $consultantName,\n\n";
    $msg .= "Quản trị viên vừa cập nhật bù thêm $amount data cho bạn tại vòng: $roundName.\n\n";
    $msg .= "Khi hệ thống có khách hàng mới phù hợp, data sẽ tự động ưu tiên phân bổ thêm cho bạn.\n\n";
    $msg .= "Trân trọng,\nHệ thống Quản lý Domation DATA";

    return sendZaloMessage($botToken, $chatId, $msg);
}

/**
 * Tạo báo cáo phân bổ và ticket trong khoảng thời gian xác định
 */
function getReportByTimeWindow($conn, $startTimestamp, $endTimestamp, $windowLabel = '') {
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
    if (!$stmtData) {
        return "⚠️ Lỗi hệ thống: Không thể chuẩn bị câu lệnh truy vấn dữ liệu.";
    }
    
    $stmtData->bind_param("ss", $startTimestamp, $endTimestamp);
    $stmtData->execute();
    $resData = $stmtData->get_result();
    
    $saleStats = "";
    $totalData = 0;
    $totalReminder = 0;
    if ($resData) {
        while ($row = $resData->fetch_assoc()) {
            $normalTotal = (int)$row['normal_total'];
            $reminderTotal = (int)$row['reminder_total'];
            
            if ($reminderTotal > 0) {
                $total = $normalTotal + $reminderTotal;
                $saleStats .= "  👤 " . $row['name'] . ": " . $total . " data (Chia số: " . $normalTotal . " | Nhắc lại: " . $reminderTotal . ")\n";
            } else {
                $saleStats .= "  👤 " . $row['name'] . ": " . $normalTotal . " data\n";
            }
            $totalData += $normalTotal;
            $totalReminder += $reminderTotal;
        }
    }
    $stmtData->close();
    
    if (empty($saleStats)) {
        $saleStats = "  Kỳ báo cáo này chưa chia data nào.\n";
    }
    
    $stmtTicket = $conn->prepare("
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
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
            $totalTicket = (int)$row['total'];
            $approvedTicket = (int)($row['approved_count'] ?? 0);
            $rejectedTicket = (int)($row['rejected_count'] ?? 0);
            $pendingTicket = (int)($row['pending_count'] ?? 0);
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
            $totalBlocked = (int)$row['total'];
        }
        $stmtBlocked->close();
    }
    
    $msg = "📊 [ BÁO CÁO TỔNG KẾT NGÀY ]\n";
    $msg .= "⏱️ Kỳ báo cáo: " . ($windowLabel ?: "$startTimestamp → $endTimestamp") . "\n\n";
    $msg .= "📥 TỔNG QUAN CHIA SỐ:\n";
    if ($totalReminder > 0) {
        $msg .= "   (Tổng cộng: " . ($totalData + $totalReminder) . " | Chia số: " . $totalData . " | Nhắc lại: " . $totalReminder . ")\n";
    } else {
        $msg .= "   ($totalData data)\n";
    }
    $msg .= "------------------------------\n";
    $msg .= $saleStats . "\n";
    $msg .= "🎫 BÁO CÁO LỖI (TICKET):\n";
    if ($totalTicket > 0) {
        $msg .= "  • Tổng ticket phát sinh: $totalTicket ⚠️\n";
        $msg .= "    (Đã duyệt: $approvedTicket | Từ chối: $rejectedTicket | Chờ duyệt: $pendingTicket)\n\n";
    } else {
        $msg .= "  • Tổng ticket phát sinh: 0\n\n";
    }
    $msg .= "CHẶN DATA (BLACKLIST):\n";
    $msg .= "  • Tổng số data bị chặn: $totalBlocked\n\n";
    $msg .= "-------------------\n";
    $msg .= "💡 Gõ /report dd/mm hoặc /report dd/mm to dd/mm để xem báo cáo.\n";
    $msg .= "💡 Gõ /tools để xem thêm các câu lệnh nhanh.";
    
    return $msg;
}

/**
 * Phân tích khoảng ngày báo cáo từ text
 */
function parseReportDateRange($text) {
    // Chuẩn hóa khoảng trắng
    $text = preg_replace('/\s+/', ' ', trim($text));
    preg_match_all('/\b\d{1,2}[\/\-\.\s]\d{1,2}([\/\-\.\s]\d{4})?\b/', $text, $matches);
    
    if (empty($matches[0])) {
        return null;
    }
    
    $date1Str = $matches[0][0];
    $date2Str = isset($matches[0][1]) ? $matches[0][1] : '';
    
    $d1 = parseSingleDate($date1Str);
    if (!$d1) return null;
    
    if (empty($date2Str)) {
        return [
            'start' => $d1 . ' 00:00:00',
            'end' => $d1 . ' 23:59:59',
            'label' => date('d/m/Y', strtotime($d1))
        ];
    }
    
    $d2 = parseSingleDate($date2Str);
    if (!$d2) return null;
    
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
function parseSingleDate($str) {
    $str = preg_replace('/[\/\-\.\s]+/', '/', trim($str));
    
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $str, $m)) {
        $day = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $year = $m[3];
        if (checkdate((int)$month, (int)$day, (int)$year)) {
            return "$year-$month-$day";
        }
    }
    if (preg_match('/^(\d{1,2})\/(\d{1,2})$/', $str, $m)) {
        $day = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $year = date('Y');
        if (checkdate((int)$month, (int)$day, (int)$year)) {
            return "$year-$month-$day";
        }
    }
    return null;
}
