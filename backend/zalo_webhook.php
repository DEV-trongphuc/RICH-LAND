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

        // Cú pháp mới: hỗ trợ [ID] hoặc [Email] hoặc [ID]-[Email] / [ID] [Email]
        $cleanText = trim($text);
        if (strpos(strtolower($cleanText), '/start') === 0) {
            $cleanText = trim(substr($cleanText, 6));
        }
        
        $userId = 0;
        $email = '';
        $targetType = ''; // 'admin', 'sale', or ''
        
        if (preg_match('/^(a|admin|ad)[\-\s]*(\d+)$/i', $cleanText, $matches)) {
            $targetType = 'admin';
            $userId = (int)$matches[2];
        } else if (preg_match('/^(s|sale|tvv)[\-\s]*(\d+)$/i', $cleanText, $matches)) {
            $targetType = 'sale';
            $userId = (int)$matches[2];
        } else if (preg_match('/^(\d+)[\-\s]+([^\s]+)$/', $cleanText, $matches)) {
            $userId = (int)$matches[1];
            $email = strtolower(trim($matches[2]));
        } else if (preg_match('/^\d+$/', $cleanText)) {
            $userId = (int)$cleanText;
            $targetType = 'sale'; // Mặc định nếu chỉ nhập số thì dành cho Sale
        } else if (filter_var($cleanText, FILTER_VALIDATE_EMAIL)) {
            $email = strtolower($cleanText);
        }

        if ($userId > 0 || !empty($email)) {
            $linkedAny = false;
            $successMessages = [];
            $errorMsg = '';

            // Lấy thông tin Zalo hiện tại của bot xem đã được liên kết với ai chưa
            $existingSaleOwner = null;
            $stmt = $conn->prepare("SELECT id, name, email FROM consultants WHERE zalo_chat_id = ? LIMIT 1");
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
            $stmt = $conn->prepare("SELECT id, name, email FROM accounts WHERE zalo_chat_id = ? LIMIT 1");
            if ($stmt) {
                $stmt->bind_param("s", $chatId);
                $stmt->execute();
                $res = $stmt->get_result();
                if ($res && $res->num_rows > 0) {
                    $existingAdminOwner = $res->fetch_assoc();
                }
                $stmt->close();
            }

            // 1. Tìm trong hệ thống Sale (consultants)
            $sale = null;
            if ($targetType === '' || $targetType === 'sale') {
                $stmtFind = null;
                if ($userId > 0 && !empty($email)) {
                    $stmtFind = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM consultants WHERE id = ? AND email = ? LIMIT 1");
                    if ($stmtFind) $stmtFind->bind_param("is", $userId, $email);
                } else if ($userId > 0) {
                    $stmtFind = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
                    if ($stmtFind) $stmtFind->bind_param("i", $userId);
                } else {
                    $stmtFind = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM consultants WHERE email = ? LIMIT 1");
                    if ($stmtFind) $stmtFind->bind_param("s", $email);
                }
                
                if ($stmtFind && $stmtFind->execute()) {
                    $res = $stmtFind->get_result();
                    if ($res && $res->num_rows > 0) {
                        $sale = $res->fetch_assoc();
                    }
                }
                if ($stmtFind) $stmtFind->close();
            }

            // 2. Tìm trong hệ thống Quản trị (accounts)
            $admin = null;
            if ($targetType === '' || $targetType === 'admin') {
                $stmtAdmin = null;
                if ($userId > 0 && !empty($email)) {
                    $stmtAdmin = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND email = ? LIMIT 1");
                    if ($stmtAdmin) $stmtAdmin->bind_param("is", $userId, $email);
                } else if ($userId > 0) {
                    $stmtAdmin = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? LIMIT 1");
                    if ($stmtAdmin) $stmtAdmin->bind_param("i", $userId);
                } else {
                    $stmtAdmin = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE email = ? LIMIT 1");
                    if ($stmtAdmin) $stmtAdmin->bind_param("s", $email);
                }
                
                if ($stmtAdmin && $stmtAdmin->execute()) {
                    $resAdmin = $stmtAdmin->get_result();
                    if ($resAdmin && $resAdmin->num_rows > 0) {
                        $admin = $resAdmin->fetch_assoc();
                    }
                }
                if ($stmtAdmin) $stmtAdmin->close();
            }

            // Xử lý trùng lặp Email giữa Sale và Admin
            if ($sale && $admin && $targetType === '') {
                $errorMsg = "[ HỆ THỐNG DOMATION DATA ]\n\nEmail này đang được dùng cho cả tài khoản Quản trị viên và Tư vấn viên.\nĐể đảm bảo chính xác, vui lòng sử dụng Mã ID thay vì Email để xác thực:\n\n- Nếu bạn muốn liên kết Admin: Gửi A + Mã ID (Ví dụ: A" . $admin['id'] . ")\n- Nếu bạn muốn liên kết Tư vấn viên: Gửi Mã ID (Ví dụ: " . $sale['id'] . ")";
                sendZaloMessage($botToken, $chatId, $errorMsg);
                exit;
            }

            if (!$sale && !$admin) {
                $info = $userId > 0 ? "ID: $userId" : "";
                if (!empty($email)) {
                    $info .= ($info ? " hoặc " : "") . "Email: $email";
                }
                $errorMsg = "[ THÔNG BÁO LỖI ]\nKhông tìm thấy tài khoản (Sale/Admin) phù hợp với thông tin ($info) trong hệ thống. Vui lòng kiểm tra lại!";
            } else {
                // Xử lý liên kết cho Sale
                if ($sale) {
                    if (!empty($sale['zalo_chat_id'])) {
                        if ($sale['zalo_chat_id'] === $chatId) {
                            $successMessages[] = "Tư vấn viên: " . $sale['name'] . " (" . $sale['email'] . ") - Đã liên kết từ trước.";
                            $linkedAny = true;
                        } else {
                            $errorMsg .= "[ THÔNG BÁO LỖI ]\nTài khoản Sale này (" . $sale['name'] . " - " . $sale['email'] . ") đã được liên kết với một Zalo khác rồi. Vui lòng báo Admin hỗ trợ hủy liên kết cũ để thực hiện lại.\n\n";
                        }
                    } else {
                        // Kiểm tra xem Zalo này đã liên kết với ai chưa
                        if ($existingSaleOwner) {
                            $errorMsg .= "[ THÔNG BÁO LỖI ]\nTài khoản Zalo này đã được liên kết với một Tư vấn viên khác trên hệ thống (" . $existingSaleOwner['name'] . " - " . $existingSaleOwner['email'] . "). Vui lòng báo Admin để hỗ trợ.\n\n";
                        } else if ($existingAdminOwner) {
                            $errorMsg .= "[ THÔNG BÁO LỖI ]\nTài khoản Zalo này đã được liên kết với một Quản trị viên khác trên hệ thống (" . $existingAdminOwner['name'] . " - " . $existingAdminOwner['email'] . "). Vui lòng báo Admin để hỗ trợ.\n\n";
                        } else {
                            $stmtUpdate = $conn->prepare("UPDATE consultants SET zalo_chat_id = ? WHERE id = ?");
                            if ($stmtUpdate) {
                                $stmtUpdate->bind_param("si", $chatId, $sale['id']);
                                if ($stmtUpdate->execute()) {
                                    $linkedAny = true;
                                    $successMessages[] = "Tư vấn viên: " . $sale['name'] . " - Email: " . $sale['email'];
                                    // Cập nhật existing owner ảo để tránh xử lý trùng nếu trùng ID/email giữa sale và admin
                                    $existingSaleOwner = $sale;
                                }
                                $stmtUpdate->close();
                            }
                        }
                    }
                }

                // Xử lý liên kết cho Admin
                if ($admin) {
                    if (!empty($admin['zalo_chat_id'])) {
                        if ($admin['zalo_chat_id'] === $chatId) {
                            $successMessages[] = "Quản trị viên: " . $admin['name'] . " (" . $admin['email'] . ") - Đã liên kết từ trước.";
                            $linkedAny = true;
                        } else {
                            $errorMsg .= "[ THÔNG BÁO LỖI ]\nTài khoản Admin này (" . $admin['name'] . " - " . $admin['email'] . ") đã được liên kết với một Zalo khác rồi. Vui lòng báo Admin hỗ trợ hủy liên kết cũ để thực hiện lại.\n\n";
                        }
                    } else {
                        // Kiểm tra xem Zalo này đã liên kết với ai chưa
                        if ($existingSaleOwner && (!$sale || $existingSaleOwner['id'] !== $sale['id'])) {
                            $errorMsg .= "[ THÔNG BÁO LỖI ]\nTài khoản Zalo này đã được liên kết với một Tư vấn viên khác trên hệ thống (" . $existingSaleOwner['name'] . " - " . $existingSaleOwner['email'] . "). Vui lòng báo Admin để hỗ trợ.\n\n";
                        } else if ($existingAdminOwner && $existingAdminOwner['id'] !== $admin['id']) {
                            $errorMsg .= "[ THÔNG BÁO LỖI ]\nTài khoản Zalo này đã được liên kết với một Quản trị viên khác trên hệ thống (" . $existingAdminOwner['name'] . " - " . $existingAdminOwner['email'] . "). Vui lòng báo Admin để hỗ trợ.\n\n";
                        } else {
                            $stmtUpdateAdmin = $conn->prepare("UPDATE accounts SET zalo_chat_id = ? WHERE id = ?");
                            if ($stmtUpdateAdmin) {
                                $stmtUpdateAdmin->bind_param("si", $chatId, $admin['id']);
                                if ($stmtUpdateAdmin->execute()) {
                                    $linkedAny = true;
                                    $adminName = $admin['name'] ?: 'Quản trị viên';
                                    $successMessages[] = "Quản trị viên: " . $adminName . " - Email: " . $admin['email'];
                                }
                                $stmtUpdateAdmin->close();
                            }
                        }
                    }
                }
            }

            if ($linkedAny) {
                $msg = "[ HỆ THỐNG DOMATION DATA ]\n\n"
                     . "Chúc mừng bạn đã xác thực hệ thống thành công:\n";
                foreach ($successMessages as $sm) {
                    $msg .= "  • $sm\n";
                }
                $msg .= "\nTừ bây giờ hệ thống sẽ tự động gửi thông báo qua Zalo này.";
                if (!empty($errorMsg)) {
                    $msg .= "\n\nLưu ý thêm:\n" . trim($errorMsg);
                }
                sendZaloMessage($botToken, $chatId, $msg);
            } else {
                sendZaloMessage($botToken, $chatId, trim($errorMsg));
            }
        } else {
            // Hướng dẫn lại
            $guideMsg = "[ HỆ THỐNG DOMATION DATA ]\n\n"
                      . "Chào $fromName!\n"
                      . "Để liên kết tài khoản nhận dữ liệu tự động, vui lòng soạn tin nhắn theo cú pháp đơn giản:\n\n"
                      . "- Nhập mã ID của bạn (Ví dụ: 12)\n"
                      . "- Hoặc nhập địa chỉ Email của bạn (Ví dụ: nguyenvanan@gmail.com)\n\n"
                      . "Chúc bạn làm việc hiệu quả!";
            sendZaloMessage($botToken, $chatId, $guideMsg);
        }
    }
}

// Luôn phản hồi 200 OK cho Webhook
echo json_encode(["message" => "Success"]);
exit;
