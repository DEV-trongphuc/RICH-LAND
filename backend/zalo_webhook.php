<?php
// backend/zalo_webhook.php
// Endpoint để nhận sự kiện từ Zalo Bot Platform

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/zalo_bot.php';

header("Content-Type: application/json");

// 1. Lấy cấu hình Secret Token từ DB
$stmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_webhook_secret' LIMIT 1");
$secretToken = '';
if ($stmt && $stmt->num_rows > 0) {
    $secretToken = $stmt->fetch_assoc()['setting_value'];
}

// 2. Xác thực Secret Token (nếu có cấu hình)
if (!empty($secretToken)) {
    $headerSecret = $_SERVER['HTTP_X_BOT_API_SECRET_TOKEN'] ?? '';
    if ($headerSecret !== $secretToken) {
        http_response_code(403);
        echo json_encode(["message" => "Unauthorized"]);
        exit;
    }
}

// 3. Đọc dữ liệu Payload từ Zalo
$rawBody = file_get_contents('php://input');

// BẬT LOG: Lưu toàn bộ payload Zalo gửi về vào file webhook_log.txt để debug
file_put_contents(__DIR__ . '/webhook_log.txt', date('[Y-m-d H:i:s]') . " PAYLOAD: " . $rawBody . "\n\n", FILE_APPEND);

$data = json_decode($rawBody, true);

if (!$data || !isset($data['event_name'])) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid payload"]);
    exit;
}
// TỐI ƯU HIỆU SUẤT: Lấy Bot Token một lần duy nhất từ DB
$stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
$botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

// TỐI ƯU HIỆU SUẤT: Đóng kết nối sớm (Early Termination) để Zalo Server không bị treo chờ
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

$eventName = $data['event_name'] ?? '';

if ($eventName === 'user_send_text' || $eventName === 'message.text.received') {
    // Hỗ trợ cả 2 định dạng (Zalo OA chuẩn và Zalo Mini App)
    $text = '';
    $chatId = '';
    
    if (isset($data['message']['text'])) {
        $text = trim($data['message']['text']);
        $chatId = $data['sender']['id'] ?? $data['message']['chat']['id'] ?? $data['message']['from']['id'] ?? '';
    } else if (isset($data['result']['message']['text'])) {
        $text = trim($data['result']['message']['text']);
        $chatId = $data['result']['message']['chat']['id'] ?? $data['result']['message']['from']['id'] ?? '';
    }
    
    $fromName = 'bạn'; // Zalo webhook user_send_text thường không kèm tên, dùng default

    if (!empty($text) && !empty($chatId)) {
        $textLower = strtolower(trim($text));

        // --- XỬ LÝ TEST COMMAND ---
        if ($textLower === 'test_data' || $textLower === 'test_data_admin') {
            if (!empty($botToken)) {
                if ($textLower === 'test_data') {
                    $zaloMsg = "[ THÔNG BÁO DATA MỚI ]\n\n"
                             . "Chào bạn, hệ thống vừa phân bổ một khách hàng mới:\n\n"
                             . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                             . "  • Tên KH: Nguyễn Khách Test\n"
                             . "  • Số ĐT: 0987 654 321\n"
                             . "  • Nguồn: Facebook Ads\n"
                             . "  • Loại: Quan tâm dịch vụ\n\n"
                             . "❖ GHI CHÚ:\n"
                             . "  Khách gọi cần tư vấn gấp vào buổi sáng.\n\n"
                             . "Báo lỗi Data tại đây: https://open.domation.net/...";
                    sendZaloMessage($botToken, $chatId, $zaloMsg);
                } else if ($textLower === 'test_data_admin') {
                    $zaloMsg = "[ YÊU CẦU DUYỆT TICKET ]\n\n"
                             . "Một nhân viên vừa gửi báo cáo lỗi Data:\n\n"
                             . "❖ THÔNG TIN BÁO CÁO:\n"
                             . "  • Sale báo cáo: Trần Sale Test\n"
                             . "  • Khách hàng: Nguyễn Khách Test (0987654321)\n\n"
                             . "❖ LÝ DO LỖI:\n"
                             . "  Khách thuê bao, gọi 3 lần không bắt máy.\n\n"
                             . "Vui lòng đăng nhập CRM để duyệt/từ chối Ticket này.";
                    sendZaloMessage($botToken, $chatId, $zaloMsg);
                }
            }
            
            // Xóa phần gửi phản hồi và thoát vì đã gửi early termination ở trên
            exit;
        }
        // --- KẾT THÚC TEST COMMAND ---

        // Cú pháp mới: [ID]-[Email] hoặc [ID] [Email]
        $cleanText = trim($text);
        if (strpos(strtolower($cleanText), '/start') === 0) {
            $cleanText = trim(substr($cleanText, 6));
        }
        
        $userId = 0;
        $email = '';
        
        if (preg_match('/^(\d+)[\-\s]+([^\s]+)$/', $cleanText, $matches)) {
            $userId = (int)$matches[1];
            $email = strtolower(trim($matches[2]));
        }

        if ($userId > 0 && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $linkedAny = false;
            $successMessages = [];

            // 1. Tìm trong hệ thống Sale (consultants)
            $stmtFind = $conn->prepare("SELECT id, name FROM consultants WHERE id = ? AND email = ? LIMIT 1");
            if ($stmtFind) {
                $stmtFind->bind_param("is", $userId, $email);
                $stmtFind->execute();
                $res = $stmtFind->get_result();
                
                if ($res->num_rows > 0) {
                    $sale = $res->fetch_assoc();
                    $stmtUpdate = $conn->prepare("UPDATE consultants SET zalo_chat_id = ? WHERE id = ?");
                    if ($stmtUpdate) {
                        $stmtUpdate->bind_param("si", $chatId, $sale['id']);
                        if ($stmtUpdate->execute()) {
                            $linkedAny = true;
                            $successMessages[] = "Tư vấn viên: " . $sale['name'];
                        }
                    }
                }
            }

            // 2. Tìm trong hệ thống Quản trị (accounts)
            $stmtAdmin = $conn->prepare("SELECT id, name FROM accounts WHERE id = ? AND email = ? LIMIT 1");
            if ($stmtAdmin) {
                $stmtAdmin->bind_param("is", $userId, $email);
                $stmtAdmin->execute();
                $resAdmin = $stmtAdmin->get_result();
                
                if ($resAdmin->num_rows > 0) {
                    $admin = $resAdmin->fetch_assoc();
                    $stmtUpdateAdmin = $conn->prepare("UPDATE accounts SET zalo_chat_id = ? WHERE id = ?");
                    if ($stmtUpdateAdmin) {
                        $stmtUpdateAdmin->bind_param("si", $chatId, $admin['id']);
                        if ($stmtUpdateAdmin->execute()) {
                            $linkedAny = true;
                            $adminName = $admin['name'] ?: 'Quản trị viên';
                            $successMessages[] = "Quản trị viên: " . $adminName;
                        }
                    }
                }
            }

            // Gửi phản hồi chung
            if ($linkedAny) {
                $msg = "[ HỆ THỐNG DOMATION CRM ]\n\n"
                     . "Liên kết Zalo thành công tài khoản:\n";
                foreach ($successMessages as $sm) {
                    $msg .= "  • $sm\n";
                }
                $msg .= "\nTừ bây giờ hệ thống sẽ tự động gửi thông báo qua Zalo này.";
                sendZaloMessage($botToken, $chatId, $msg);
            } else {
                $errMsg = "[ THÔNG BÁO LỖI ]\nKhông tìm thấy tài khoản (Sale/Admin) nào có ID=$userId và Email='$email' trong hệ thống. Vui lòng kiểm tra lại!";
                sendZaloMessage($botToken, $chatId, $errMsg);
            }
        } else if (filter_var(strtolower(trim($cleanText)), FILTER_VALIDATE_EMAIL)) {
            // Nhập đúng email nhưng thiếu ID
            $errMsg = "[ THÔNG BÁO LỖI ]\nSai cú pháp xác thực. Vui lòng nhập kèm ID của bạn theo định dạng:\n\n[ID]-[Email]\n(Ví dụ: 12-nguyenvana@gmail.com)";
            sendZaloMessage($botToken, $chatId, $errMsg);
        } else {
            // Tin nhắn không phải email, hướng dẫn lại
            $guideMsg = "[ HỆ THỐNG DOMATION CRM ]\n\n"
                      . "Chào $fromName!\n"
                      . "Để liên kết tài khoản nhận Data tự động, vui lòng soạn tin nhắn theo cú pháp:\n\n"
                      . "[ID của bạn]-[Email của bạn]\n\n"
                      . "Ví dụ: 12-nguyenvanan@gmail.com";
            sendZaloMessage($botToken, $chatId, $guideMsg);
        }
    }
}

// Luôn phản hồi 200 OK cho Webhook
echo json_encode(["message" => "Success"]);
exit;
