<?php
// backend/telegram_webhook.php
// Endpoint để nhận sự kiện từ Telegram Bot API

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/zalo_bot.php'; // Tái sử dụng các hàm báo cáo (getReportByTimeWindow, etc.)
require_once __DIR__ . '/telegram_bot.php';

header("Content-Type: application/json");

// 1. Đọc dữ liệu Payload từ Telegram
$rawBody = file_get_contents('php://input');

// BẬT LOG: Lưu payload Telegram gửi về vào file telegram_webhook_log.txt để debug
$logFile = __DIR__ . '/telegram_webhook_log.txt';
if (file_exists($logFile) && @filesize($logFile) > 5 * 1024 * 1024) {
    $bakFile = __DIR__ . '/telegram_webhook_log.bak.txt';
    if (file_exists($bakFile)) {
        @unlink($bakFile);
    }
    @rename($logFile, $bakFile);
}
@file_put_contents($logFile, date('[Y-m-d H:i:s]') . " PAYLOAD: " . $rawBody . "\n\n", FILE_APPEND | LOCK_EX);

$data = json_decode($rawBody, true);

if (!$data || !isset($data['message'])) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid payload"]);
    exit;
}

$message = $data['message'];
$chatId = $message['chat']['id'] ?? '';
$text = isset($message['text']) ? trim($message['text']) : '';
$fromName = $message['from']['first_name'] ?? 'bạn';

if (empty($text) || empty($chatId)) {
    echo json_encode(["message" => "No message text or chat id"]);
    exit;
}

// TỐI ƯU HIỆU SUẤT: Lấy Bot Token một lần duy nhất từ DB
$stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'telegram_bot_token' LIMIT 1");
$botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

if (empty($botToken)) {
    echo json_encode(["message" => "Telegram Bot Token not configured"]);
    exit;
}

// TỐI ƯU HIỆU SUẤT: Đóng kết nối sớm để Telegram Server không bị treo chờ phản hồi lâu
ob_end_clean();
header("Connection: close");
ignore_user_abort(true);
ob_start();
echo json_encode(["message" => "Received"]);
$size = ob_get_length();
header("Content-Length: $size");
ob_end_flush();
flush();
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

$textLower = strtolower(trim($text));

// --- COMMAND LẤY CHAT ID (Public Command) ---
if ($textLower === '/chatid' || $textLower === '/id' || $textLower === '/info' || $textLower === '/start') {
    $telegramMsg = "💬 <b>[ HỆ THỐNG RICH LAND ]</b>\n\n"
        . "• Chat ID của phòng này: <code>$chatId</code>\n\n"
        . "💡 Bạn hãy copy Chat ID này điền vào cấu hình <b>Telegram Chat ID</b> trong trang Hồ sơ cá nhân hoặc mục Cấu hình hệ thống để nhận các thông báo chia số, duyệt ticket và báo cáo.";
    sendTelegramMessage($botToken, $chatId, $telegramMsg);
    exit;
}

// --- XỬ LÝ TEST COMMAND ---
if ($textLower === 'test_data' || $textLower === 'test_data_admin' || $textLower === 'test_report') {
    if ($textLower === 'test_data') {
        $telegramMsg = "📥 <b>[ THÔNG BÁO DATA MỚI ]</b> 📥\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Chào bạn, hệ thống vừa phân bổ một khách hàng mới:\n\n"
            . "❖ <b>THÔNG TIN KHÁCH HÀNG:</b>\n"
            . "  • <b>Tên KH:</b> Nguyễn Khách Test\n"
            . "  • <b>Số ĐT:</b> 0987 654 321\n"
            . "  • <b>Nguồn:</b> Facebook Ads\n"
            . "  • <b>Loại:</b> Quan tâm dịch vụ\n\n"
            . "❖ <b>GHI CHÚ:</b>\n"
            . "  <i>Khách gọi cần tư vấn gấp vào buổi sáng.</i>\n\n"
            . "Báo lỗi Data tại đây: <a href=\"https://open.richland.test/.../\"><b>Link báo cáo lỗi</b></a>";
        sendTelegramMessage($botToken, $chatId, $telegramMsg);
    } else if ($textLower === 'test_data_admin') {
        $telegramMsg = "📢 <b>[ YÊU CẦU DUYỆT TICKET ]</b> 📢\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Một nhân viên vừa gửi báo cáo lỗi Data:\n\n"
            . "❖ <b>THÔNG TIN BÁO CÁO:</b>\n"
            . "  • <b>Sale báo cáo:</b> Trần Sale Test\n"
            . "  • <b>Khách hàng:</b> Nguyễn Khách Test (0987654321)\n\n"
            . "❖ <b>LÝ DO LỖI:</b>\n"
            . "  <i>Khách thuê bao, gọi 3 lần không bắt máy.</i>\n\n"
            . "Vui lòng đăng nhập CRM để duyệt/từ chối Ticket này.";
        sendTelegramMessage($botToken, $chatId, $telegramMsg);
    } else if ($textLower === 'test_report') {
        $reportTime = get_system_setting($conn, 'zalo_daily_report_time') ?: '17:00';
        $reportTimeDisplay = date('H:i', strtotime($reportTime));
        $telegramMsg = "📊 <b>[ BÁO CÁO TỔNG KẾT NGÀY ]</b>\n"
            . "⏱️ <b>Kỳ báo cáo:</b> {$reportTimeDisplay} " . date('d/m/Y', strtotime('-1 day')) . " → {$reportTimeDisplay} " . date('d/m/Y') . "\n\n"
            . "📥 <b>TỔNG QUAN CHIA SỐ:</b>\n"
            . "   (Tổng số data: 4 data | Nhắc lại: 1)\n"
            . "----------\n"
            . "  👤 Nguyễn Văn A: 3 data\n"
            . "    └─ 3 chia vòng\n"
            . "    └─ 0 bù\n"
            . "    └─ 0 nhắc lại\n"
            . "  👤 Trần Thị B: 1 data\n"
            . "    └─ 1 chia vòng\n"
            . "    └─ 0 bù\n"
            . "    └─ 1 nhắc lại\n\n"
            . "🎫 <b>BÁO CÁO LỖI (TICKET):</b>\n"
            . "  • Tổng ticket phát sinh: 2 ⚠️\n"
            . "    (Đã duyệt: 1 | Từ chối: 0 | Chờ duyệt: 1)\n\n"
            . "----------\n"
            . "💡 Gõ <code>/report dd/mm</code> hoặc <code>/report dd/mm to dd/mm</code> để xem báo cáo.\n"
            . "💡 Gõ <code>/tools</code> để xem thêm các câu lệnh nhanh.";
        sendTelegramMessage($botToken, $chatId, $telegramMsg);
    }
    exit;
}

// --- XỬ LÝ COMMANDS BÁO CÁO & QUẢN TRỊ (ADMIN / LEADER ONLY) ---
if (strpos($textLower, '/tools') === 0 || strpos($textLower, '/report') === 0 || strpos($textLower, '/ticket') === 0 || strpos($textLower, '/sales') === 0 || strpos($textLower, '/round') === 0 || strpos($textLower, '/check') === 0 || strpos($textLower, '/week') === 0) {
    
    // Kiểm tra phân quyền Admin
    $isAdmin = false;
    $adminRole = '';
    $adminName = '';
    
    $telegramAdminGroupChatId = get_system_setting($conn, 'telegram_admin_group_chat_id');
    if (!empty($telegramAdminGroupChatId) && (string)$chatId === (string)$telegramAdminGroupChatId) {
        $isAdmin = true;
        $adminRole = 'admin';
        $adminName = 'Group Admin';
    } else {
        $stmtCheck = $conn->prepare("SELECT id, name, role FROM accounts WHERE telegram_chat_id = ? LIMIT 1");
        if ($stmtCheck) {
            $stmtCheck->bind_param("s", $chatId);
            $stmtCheck->execute();
            $resCheck = $stmtCheck->get_result();
            if ($resCheck && $rowCheck = $resCheck->fetch_assoc()) {
                $adminRole = $rowCheck['role'];
                if ($adminRole === 'admin' || $adminRole === 'superadmin' || $adminRole === 'assistant' || $adminRole === 'director') {
                    $isAdmin = true;
                    $adminName = $rowCheck['name'] ?: 'Quản trị viên';
                }
            }
            $stmtCheck->close();
        }
    }

    if (!$isAdmin) {
        sendTelegramMessage($botToken, $chatId, "⚠️ <b>Lỗi:</b> Câu lệnh này chỉ dành cho Quản trị viên/Trợ lý đã xác thực Telegram trên hệ thống.");
        exit;
    }

    // --- LỆNH /tools ---
    if (strpos($textLower, '/tools') === 0) {
        $reportTime = get_system_setting($conn, 'zalo_daily_report_time') ?: '17:00';
        $reportTimeDisplay = date('H:i', strtotime($reportTime));

        $toolsMsg = "🛠️ <b>[ DANH SÁCH LỆNH BÁO CÁO NHANH ]</b> 🛠️\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Chào <b>$adminName</b>, dưới đây là các câu lệnh bạn có thể sử dụng:\n\n"
            . "📈 <b>1. BÁO CÁO PHÂN BỔ & TRA CỨU:</b>\n"
            . "  • <code>/report</code> hoặc <code>/report homnay</code>: Báo cáo từ {$reportTimeDisplay} hôm qua đến hiện tại.\n"
            . "  • <code>/report homqua</code>: Báo cáo ngày hôm qua ({$reportTimeDisplay} hôm kia → {$reportTimeDisplay} hôm qua).\n"
            . "  • <code>/report dd/mm</code>: Báo cáo nguyên ngày dd/mm.\n"
            . "  • <code>/report dd/mm to dd/mm</code>: Báo cáo khoảng ngày.\n"
            . "  • <code>/weekreport &lt;id_hoặc_email&gt;</code>: Xem báo cáo tuần của Sale cụ thể.\n"
            . "  • <code>/check &lt;sdt_hoặc_email&gt;</code>: Kiểm tra thông tin Lead (vòng, sale, ghi chú...).\n\n"
            . "🎫 <b>2. QUẢN LÝ TICKET (BÁO LỖI):</b>\n"
            . "  • <code>/ticket pending</code>: Xem danh sách ticket đang chờ duyệt.\n"
            . "  • <code>/ticket homnay</code>: Thống kê ticket phát sinh trong ngày.\n\n"
            . "👥 <b>3. QUẢN LÝ NHÂN SỰ & HỆ THỐNG:</b>\n"
            . "  • <code>/sales</code>: Xem trạng thái hoạt động của các tư vấn viên.\n"
            . "  • <code>/round</code>: Xem các vòng phân bổ đang hoạt động và Sale tiếp theo nhận số.\n"
            . "━━━━━━━━━━━━━━━━━━━━━";
        sendTelegramMessage($botToken, $chatId, $toolsMsg);
        exit;
    }

    // --- LỆNH /report ---
    if (strpos($textLower, '/report') === 0) {
        $cmdArg = trim(substr($text, 7)); // Bỏ qua "/report"
        $startTimestamp = '';
        $endTimestamp = '';
        $windowLabel = '';
        $reportTime = get_system_setting($conn, 'zalo_daily_report_time') ?: '17:00';

        if (empty($cmdArg) || $cmdArg === 'homnay' || $cmdArg === 'today') {
            $currentTime = date('H:i');
            $startTimestamp = date('Y-m-d H:i:s', strtotime('yesterday ' . $reportTime));
            if ($currentTime >= $reportTime) {
                $endTimestamp = date('Y-m-d H:i:s', strtotime('today ' . $reportTime));
                $windowLabel = date('H:i d/m/Y', strtotime($startTimestamp)) . " → " . date('H:i d/m/Y', strtotime($endTimestamp));
            } else {
                $endTimestamp = date('Y-m-d H:i:s');
                $windowLabel = date('H:i d/m/Y', strtotime($startTimestamp)) . " → Hiện tại";
            }
        } else if ($cmdArg === 'homqua' || $cmdArg === 'yesterday') {
            $startTimestamp = date('Y-m-d H:i:s', strtotime('yesterday -1 day ' . $reportTime));
            $endTimestamp = date('Y-m-d H:i:s', strtotime('yesterday ' . $reportTime));
            $windowLabel = date('H:i d/m/Y', strtotime($startTimestamp)) . " → " . date('H:i d/m/Y', strtotime($endTimestamp));
        } else {
            $range = parseReportDateRange($cmdArg);
            if ($range) {
                $startTimestamp = $range['start'];
                $endTimestamp = $range['end'];
                $windowLabel = $range['label'];
            }
        }

        if (empty($startTimestamp) || empty($endTimestamp)) {
            sendTelegramMessage($botToken, $chatId, "⚠️ <b>Cú pháp không hợp lệ.</b> Vui lòng nhập theo mẫu:\n- <code>/report 21/05</code> hoặc <code>/report 20/05 to 21/05</code>.");
            exit;
        }

        $reportMsg = getReportByTimeWindow($conn, $startTimestamp, $endTimestamp, $windowLabel);
        sendTelegramMessage($botToken, $chatId, $reportMsg);
        exit;
    }

    // --- LỆNH /sales ---
    if (strpos($textLower, '/sales') === 0) {
        $resSales = $conn->query("SELECT id, name, status, vacation_mode, zalo_chat_id, telegram_chat_id FROM consultants ORDER BY id ASC");
        $salesMsg = "👥 <b>[ DANH SÁCH TƯ VẤN VIÊN ]</b> 👥\n━━━━━━━━━━━━━━━━━━━━━\n";
        while ($sale = $resSales->fetch_assoc()) {
            $statusEmoji = ($sale['status'] === 'active' && !$sale['vacation_mode']) ? "🟢" : "🔴";
            $statusText = ($sale['status'] === 'active') ? ($sale['vacation_mode'] ? "Nghỉ phép" : "Đang trực") : "Ngưng trực";
            $zaloLinked = !empty($sale['zalo_chat_id']) ? "✅ Zalo" : "❌ Zalo";
            $teleLinked = !empty($sale['telegram_chat_id']) ? "✅ Tele" : "❌ Tele";
            $salesMsg .= "• ID: <code>{$sale['id']}</code> | <b>{$sale['name']}</b>\n  └ Trạng thái: $statusEmoji $statusText | $zaloLinked | $teleLinked\n";
        }
        sendTelegramMessage($botToken, $chatId, $salesMsg);
        exit;
    }

    // --- LỆNH /round ---
    if (strpos($textLower, '/round') === 0) {
        $resRounds = $conn->query("SELECT id, round_name, is_active FROM distribution_rounds ORDER BY id ASC");
        $roundMsg = "🔄 <b>[ DANH SÁCH VÒNG PHÂN BỔ ]</b> 🔄\n━━━━━━━━━━━━━━━━━━━━━\n";
        while ($rnd = $resRounds->fetch_assoc()) {
            $actEmoji = $rnd['is_active'] ? "🟢" : "🔴";
            $actText = $rnd['is_active'] ? "Đang chạy" : "Tạm ngưng";
            $roundMsg .= "• ID: <code>{$rnd['id']}</code> | <b>{$rnd['round_name']}</b> | $actEmoji $actText\n";
        }
        sendTelegramMessage($botToken, $chatId, $roundMsg);
        exit;
    }

    // --- LỆNH /check ---
    if (strpos($textLower, '/check') === 0) {
        $cmdArg = trim(substr($text, 6));
        if (empty($cmdArg)) {
            sendTelegramMessage($botToken, $chatId, "⚠️ Vui lòng nhập số điện thoại hoặc email khách hàng cần kiểm tra. Ví dụ:\n<code>/check 0987654321</code>");
            exit;
        }
        
        $stmtFind = $conn->prepare("
            SELECT l.id, l.name, l.phone, l.email, l.source, l.created_at, c.name as sale_name, r.round_name
            FROM leads l
            LEFT JOIN consultants c ON l.assigned_to = c.id
            LEFT JOIN distribution_rounds r ON l.round_id = r.id
            WHERE l.phone = ? OR l.email = ?
            ORDER BY l.id DESC LIMIT 1
        ");
        if ($stmtFind) {
            $stmtFind->bind_param("ss", $cmdArg, $cmdArg);
            $stmtFind->execute();
            $resFind = $stmtFind->get_result();
            if ($resFind && $rowFind = $resFind->fetch_assoc()) {
                $checkMsg = "🔍 <b>[ KẾT QUẢ TRA CỨU LEAD ]</b> 🔍\n"
                    . "━━━━━━━━━━━━━━━━━━━━━\n"
                    . "• <b>Tên KH:</b> {$rowFind['name']}\n"
                    . "• <b>SĐT:</b> {$rowFind['phone']}\n"
                    . "• <b>Email:</b> " . ($rowFind['email'] ?: 'Trống') . "\n"
                    . "• <b>Nguồn:</b> {$rowFind['source']}\n"
                    . "• <b>Vòng chia:</b> " . ($rowFind['round_name'] ?: 'Chia ngoài vòng/Không có') . "\n"
                    . "• <b>TVV Đang chăm:</b> " . ($rowFind['sale_name'] ?: 'Chưa phân bổ') . "\n"
                    . "• <b>Thời gian chia:</b> " . date('H:i:s d/m/Y', strtotime($rowFind['created_at'])) . "\n"
                    . "━━━━━━━━━━━━━━━━━━━━━";
                sendTelegramMessage($botToken, $chatId, $checkMsg);
            } else {
                sendTelegramMessage($botToken, $chatId, "❌ Không tìm thấy Lead nào khớp với thông tin: <i>\"$cmdArg\"</i>");
            }
            $stmtFind->close();
        }
        exit;
    }

    // --- LỆNH /ticket ---
    if (strpos($textLower, '/ticket') === 0) {
        $cmdArg = trim(substr($text, 8));
        if ($cmdArg === 'pending') {
            $resTick = $conn->query("
                SELECT t.id, t.created_at, c.name as sale_name, l.name as lead_name, t.error_reason
                FROM duplicate_log t
                LEFT JOIN consultants c ON t.consultant_id = c.id
                LEFT JOIN leads l ON t.lead_id = l.id
                WHERE t.status = 'pending'
                ORDER BY t.id ASC LIMIT 10
            ");
            $tickMsg = "🎫 <b>[ TICKET CHỜ DUYỆT (MỚI NHẤT) ]</b> 🎫\n━━━━━━━━━━━━━━━━━━━━━\n";
            $count = 0;
            while ($t = $resTick->fetch_assoc()) {
                $count++;
                $tickMsg .= "• ID: <code>{$t['id']}</code> | <b>{$t['sale_name']}</b> báo lỗi KH: <b>{$t['lead_name']}</b>\n  └ Lý do: <i>{$t['error_reason']}</i>\n";
            }
            if ($count === 0) {
                $tickMsg .= "🎉 Tuyệt vời! Hiện không có ticket nào đang chờ duyệt.";
            }
            sendTelegramMessage($botToken, $chatId, $tickMsg);
        } else {
            sendTelegramMessage($botToken, $chatId, "⚠️ Vui lòng sử dụng <code>/ticket pending</code> hoặc <code>/ticket homnay</code>.");
        }
        exit;
    }
    // --- XỬ LÝ LIÊN KẾT TÀI KHOẢN TỰ ĐỘNG ---
    $cleanText = trim($text);
    $userId = 0;
    $email = '';
    $targetType = ''; // 'admin', 'sale', or ''

    if (preg_match('/^(a|admin|ad)[\-\s]*(\d+)$/i', $cleanText, $matches)) {
        $targetType = 'admin';
        $userId = (int) $matches[2];
    } else if (preg_match('/^(s|sale|tvv)[\-\s]*(\d+)$/i', $cleanText, $matches)) {
        $targetType = 'sale';
        $userId = (int) $matches[2];
    } else if (preg_match('/^(\d+)[\-\s]+([^\s]+)$/', $cleanText, $matches)) {
        $userId = (int) $matches[1];
        $email = strtolower(trim($matches[2]));
    } else if (preg_match('/^\d+$/', $cleanText)) {
        $userId = (int) $cleanText;
        $targetType = 'sale';
    } else if (filter_var($cleanText, FILTER_VALIDATE_EMAIL)) {
        $email = strtolower($cleanText);
    }

    if ($userId > 0 || !empty($email)) {
        // Lấy thông tin Telegram hiện tại xem đã liên kết với ai chưa
        $existingSaleOwner = null;
        $stmt = $conn->prepare("SELECT id, name, email FROM consultants WHERE telegram_chat_id = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $chatId);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $existingSaleOwner = $res->fetch_assoc();
            }
            $stmt->close();
        }

        $existingAdminOwner = null;
        $stmt = $conn->prepare("SELECT id, name, email FROM accounts WHERE telegram_chat_id = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $chatId);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $existingAdminOwner = $res->fetch_assoc();
            }
            $stmt->close();
        }

        // Tìm Sale
        $sale = null;
        if ($targetType === '' || $targetType === 'sale') {
            $stmtFind = null;
            if ($userId > 0 && !empty($email)) {
                $stmtFind = $conn->prepare("SELECT id, name, email, telegram_chat_id FROM consultants WHERE id = ? AND email = ? LIMIT 1");
                if ($stmtFind) $stmtFind->bind_param("is", $userId, $email);
            } else if ($userId > 0) {
                $stmtFind = $conn->prepare("SELECT id, name, email, telegram_chat_id FROM consultants WHERE id = ? LIMIT 1");
                if ($stmtFind) $stmtFind->bind_param("i", $userId);
            } else {
                $stmtFind = $conn->prepare("SELECT id, name, email, telegram_chat_id FROM consultants WHERE email = ? LIMIT 1");
                if ($stmtFind) $stmtFind->bind_param("s", $email);
            }
            if ($stmtFind && $stmtFind->execute()) {
                $sale = $stmtFind->get_result()->fetch_assoc();
            }
            if ($stmtFind) $stmtFind->close();
        }

        // Tìm Admin
        $admin = null;
        if ($targetType === '' || $targetType === 'admin') {
            $stmtAdmin = null;
            if ($userId > 0 && !empty($email)) {
                $stmtAdmin = $conn->prepare("SELECT id, name, email, telegram_chat_id FROM accounts WHERE id = ? AND email = ? LIMIT 1");
                if ($stmtAdmin) $stmtAdmin->bind_param("is", $userId, $email);
            } else if ($userId > 0) {
                $stmtAdmin = $conn->prepare("SELECT id, name, email, telegram_chat_id FROM accounts WHERE id = ? LIMIT 1");
                if ($stmtAdmin) $stmtAdmin->bind_param("i", $userId);
            } else {
                $stmtAdmin = $conn->prepare("SELECT id, name, email, telegram_chat_id FROM accounts WHERE email = ? LIMIT 1");
                if ($stmtAdmin) $stmtAdmin->bind_param("s", $email);
            }
            if ($stmtAdmin && $stmtAdmin->execute()) {
                $admin = $stmtAdmin->get_result()->fetch_assoc();
            }
            if ($stmtAdmin) $stmtAdmin->close();
        }

        if ($sale && $admin && $targetType === '') {
            $errorMsg = "⚠️ <b>[ HỆ THỐNG RICH LAND DATA ]</b>\n\nEmail này đang được dùng cho cả tài khoản Quản trị viên và Tư vấn viên.\nĐể đảm bảo chính xác, vui lòng sử dụng Mã ID để liên kết:\n\n- Liên kết Admin: Gửi <code>A + Mã ID</code> (Ví dụ: <code>A" . $admin['id'] . "</code>)\n- Liên kết TVV: Gửi <code>Mã ID</code> (Ví dụ: <code>" . $sale['id'] . "</code>)";
            sendTelegramMessage($botToken, $chatId, $errorMsg);
            exit;
        }

        if (!$sale && !$admin) {
            $info = $userId > 0 ? "ID: $userId" : "";
            if (!empty($email)) {
                $info .= ($info ? " hoặc " : "") . "Email: $email";
            }
            sendTelegramMessage($botToken, $chatId, "❌ <b>[ THÔNG BÁO LỖI ]</b>\nKhông tìm thấy tài khoản (Sale/Admin) phù hợp với thông tin ($info) trong hệ thống. Vui lòng kiểm tra lại!");
            exit;
        }

        $successMessages = [];
        $linkedAny = false;

        if ($sale) {
            if (!empty($sale['telegram_chat_id'])) {
                if ($sale['telegram_chat_id'] === (string)$chatId) {
                    $successMessages[] = "Tư vấn viên: <b>" . $sale['name'] . "</b> ({$sale['email']}) - Đã liên kết từ trước.";
                    $linkedAny = true;
                } else {
                    sendTelegramMessage($botToken, $chatId, "❌ <b>[ THÔNG BÁO LỖI ]</b>\nTài khoản TVV này (" . $sale['name'] . ") đã được liên kết với một tài khoản Telegram khác. Vui lòng báo Admin hỗ trợ hủy liên kết cũ.");
                    exit;
                }
            } else {
                if ($existingSaleOwner) {
                    sendTelegramMessage($botToken, $chatId, "❌ <b>[ THÔNG BÁO LỖI ]</b>\nTài khoản Telegram này đã liên kết với TVV khác (" . $existingSaleOwner['name'] . ").");
                    exit;
                } else {
                    $stmtUpdate = $conn->prepare("UPDATE users SET telegram_chat_id = ? WHERE id = ?");
                    if ($stmtUpdate) {
                        $stmtUpdate->bind_param("si", $chatId, $sale['id']);
                        if ($stmtUpdate->execute()) {
                            $successMessages[] = "Tư vấn viên: <b>" . $sale['name'] . "</b> - Email: {$sale['email']}";
                            $linkedAny = true;
                        }
                        $stmtUpdate->close();
                    }
                }
            }
        }

        if ($admin) {
            if (!empty($admin['telegram_chat_id'])) {
                if ($admin['telegram_chat_id'] === (string)$chatId) {
                    $successMessages[] = "Quản trị viên: <b>" . $admin['name'] . "</b> ({$admin['email']}) - Đã liên kết từ trước.";
                    $linkedAny = true;
                } else {
                    sendTelegramMessage($botToken, $chatId, "❌ <b>[ THÔNG BÁO LỖI ]</b>\nTài khoản Admin này (" . $admin['name'] . ") đã được liên kết với một tài khoản Telegram khác. Vui lòng báo Admin hỗ trợ.");
                    exit;
                }
            } else {
                if ($existingAdminOwner) {
                    sendTelegramMessage($botToken, $chatId, "❌ <b>[ THÔNG BÁO LỖI ]</b>\nTài khoản Telegram này đã liên kết với Admin khác (" . $existingAdminOwner['name'] . ").");
                    exit;
                } else {
                    $stmtUpdate = $conn->prepare("UPDATE users SET telegram_chat_id = ? WHERE id = ?");
                    if ($stmtUpdate) {
                        $stmtUpdate->bind_param("si", $chatId, $admin['id']);
                        if ($stmtUpdate->execute()) {
                            $successMessages[] = "Quản trị viên: <b>" . $admin['name'] . "</b> - Email: {$admin['email']}";
                            $linkedAny = true;
                        }
                        $stmtUpdate->close();
                    }
                }
            }
        }

        if ($linkedAny && !empty($successMessages)) {
            $successMsg = "🎉 <b>[ LIÊN KẾT THÀNH CÔNG ]</b> 🎉\n━━━━━━━━━━━━━━━━━━━━━\n"
                . "Hệ thống RICH LAND đã liên kết thành công tài khoản Telegram của bạn với:\n\n"
                . implode("\n", $successMessages)
                . "\n\n💡 <i>Từ bây giờ, bạn sẽ nhận được thông báo chia số, nhắc lịch và báo cáo lỗi trực tiếp qua Telegram này. Chúc bạn chốt được nhiều deal!</i>\n"
                . "━━━━━━━━━━━━━━━━━━━━━";
            sendTelegramMessage($botToken, $chatId, $successMsg);
        }
        exit;
    }

    // Không khớp lệnh hệ thống
    sendTelegramMessage($botToken, $chatId, "⚠️ <b>Xin chào!</b> Tôi là Bot thông báo RICH LAND.\n\n• Gõ <code>/id</code> để xem Chat ID của bạn.\n• Gõ <code>/tools</code> để xem danh sách câu lệnh dành cho quản trị.\n• Để liên kết tài khoản: Nhập <b>Mã ID nhân viên</b> hoặc <b>Email</b> của bạn.");
}
