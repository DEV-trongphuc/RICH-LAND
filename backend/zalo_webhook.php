<?php
// backend/zalo_webhook.php
// Endpoint để nhận sự kiện từ Zalo Bot Platform

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/zalo_bot.php';
require_once __DIR__ . '/webhook_logic.php';

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
        if ($textLower === 'test_data' || $textLower === 'test_data_admin' || $textLower === 'test_report') {
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
                } else if ($textLower === 'test_report') {
                    $reportTime = get_system_setting($conn, 'zalo_daily_report_time') ?: '17:00';
                    $reportTimeDisplay = date('H:i', strtotime($reportTime));
                    $zaloMsg = "📊 [ BÁO CÁO TỔNG KẾT NGÀY ]\n"
                             . "⏱️ Kỳ báo cáo: {$reportTimeDisplay} " . date('d/m/Y', strtotime('-1 day')) . " → {$reportTimeDisplay} " . date('d/m/Y') . "\n\n"
                             . "📥 TỔNG QUAN CHIA SỐ:\n"
                             . "   (Tổng cộng: 5 | Chia số: 4 | Nhắc lại: 1)\n"
                             . "------------------------------\n"
                             . "  👤 Nguyễn Văn A: 3 data\n"
                             . "  👤 Trần Thị B: 2 data (Chia số: 1 | Nhắc lại: 1)\n\n"
                             . "🎫 BÁO CÁO LỖI (TICKET):\n"
                             . "  • Tổng ticket phát sinh: 2 ⚠️\n"
                             . "    (Đã duyệt: 1 | Từ chối: 0 | Chờ duyệt: 1)\n\n"
                             . "-------------------\n"
                             . "💡 Gõ /report dd/mm hoặc /report dd/mm to dd/mm để xem báo cáo.\n"
                             . "💡 Gõ /tools để xem thêm các câu lệnh nhanh.";
                    sendZaloMessage($botToken, $chatId, $zaloMsg);
                }
            }
            
            // Xóa phần gửi phản hồi và thoát vì đã gửi early termination ở trên
            exit;
        }
        // --- KẾT THÚC TEST COMMAND ---

        // --- XỬ LÝ COMMANDS BÁO CÁO NHANH (ADMIN ONLY) ---
        if (strpos($textLower, '/tools') === 0 || strpos($textLower, '/report') === 0 || strpos($textLower, '/ticket') === 0 || strpos($textLower, '/sales') === 0 || strpos($textLower, '/accept') === 0 || strpos($textLower, '/reject') === 0 || strpos($textLower, '/round') === 0 || strpos($textLower, '/check') === 0) {
            // Kiểm tra phân quyền Admin
            $isAdmin = false;
            $adminName = '';
            $adminAccountId = 0;
            $stmtCheck = $conn->prepare("SELECT id, name FROM accounts WHERE zalo_chat_id = ? LIMIT 1");
            if ($stmtCheck) {
                $stmtCheck->bind_param("s", $chatId);
                $stmtCheck->execute();
                $resCheck = $stmtCheck->get_result();
                if ($resCheck && $rowCheck = $resCheck->fetch_assoc()) {
                    $isAdmin = true;
                    $adminName = $rowCheck['name'] ?: 'Quản trị viên';
                    $adminAccountId = (int)$rowCheck['id'];
                }
                $stmtCheck->close();
            }

            if (!$isAdmin) {
                sendZaloMessage($botToken, $chatId, "⚠️ Lỗi: Câu lệnh này chỉ dành cho Quản trị viên đã xác thực Zalo trên hệ thống.");
                exit;
            }

            if (strpos($textLower, '/tools') === 0) {
                $reportTime = get_system_setting($conn, 'zalo_daily_report_time') ?: '17:00';
                $reportTimeDisplay = date('H:i', strtotime($reportTime));

                $toolsMsg = "🛠️ [ DANH SÁCH LỆNH BÁO CÁO NHANH ]\n\n"
                          . "Chào $adminName, dưới đây là các câu lệnh bạn có thể sử dụng:\n\n"
                          . "📈 1. Báo cáo phân bổ:\n\n"
                          . "  • [/report] hoặc [/report homnay]: Báo cáo từ {$reportTimeDisplay} hôm qua đến hiện tại.\n\n"
                          . "  • [/report homqua]: Báo cáo của ngày hôm qua ({$reportTimeDisplay} hôm kia → {$reportTimeDisplay} hôm qua).\n\n"
                          . "  • [/report dd/mm]: Báo cáo nguyên ngày dd/mm (00:00 → 23:59).\n\n"
                          . "  • [/report dd/mm to dd/mm]: Báo cáo khoảng ngày.\n\n"
                          . "  • [/check sdt_hoặc_email]: Kiểm tra thông tin Lead (vòng, sale, ghi chú...).\n\n\n"
                          . "🎫 2. Quản lý Ticket (Báo lỗi):\n\n"
                          . "  • [/ticket pending]: Xem danh sách ticket đang chờ duyệt.\n\n"
                          . "  • [/ticket homnay]: Thống kê ticket phát sinh trong ngày.\n\n"
                          . "  • [/accept mã_ticket lý_do]: Duyệt nhanh ticket lỗi kèm lý do tùy chọn (Ví dụ: [/accept 12 Duyệt trùng]).\n\n"
                          . "  • [/reject mã_ticket lý_do]: Từ chối nhanh ticket lỗi kèm lý do bắt buộc (Ví dụ: [/reject 12 Khách vẫn nghe máy]).\n\n\n"
                          . "👥 3. Quản lý nhân sự:\n\n"
                          . "  • [/sales]: Xem trạng thái hoạt động của các tư vấn viên.\n\n"
                          . "  • [/round]: Xem các vòng phân bổ đang hoạt động và Sale tiếp theo nhận số.";
                sendZaloMessage($botToken, $chatId, $toolsMsg);
                exit;
            }

            if (strpos($textLower, '/report') === 0) {
                $cmdArg = trim(substr($text, 7)); // Bỏ qua "/report"
                $startTimestamp = '';
                $endTimestamp = '';
                $windowLabel = '';

                // Lấy giờ báo cáo hàng ngày từ cài đặt hệ thống
                $reportTime = get_system_setting($conn, 'zalo_daily_report_time') ?: '17:00';

                if (empty($cmdArg) || $cmdArg === 'homnay' || $cmdArg === 'today') {
                    // Từ $reportTime ngày hôm trước (hoặc ngày hiện tại nếu trước $reportTime) đến hiện tại
                    $today = date('Y-m-d');
                    $currentTime = date('H:i');
                    if ($currentTime >= $reportTime) {
                        $startTimestamp = date('Y-m-d H:i:s', strtotime('today ' . $reportTime));
                    } else {
                        $startTimestamp = date('Y-m-d H:i:s', strtotime('yesterday ' . $reportTime));
                    }
                    $endTimestamp = date('Y-m-d H:i:s');
                    $windowLabel = date('H:i d/m/Y', strtotime($startTimestamp)) . " → Hiện tại";
                } else if ($cmdArg === 'homqua' || $cmdArg === 'yesterday') {
                    // Từ $reportTime hôm kia đến $reportTime hôm qua
                    $startTimestamp = date('Y-m-d H:i:s', strtotime('yesterday -1 day ' . $reportTime));
                    $endTimestamp = date('Y-m-d H:i:s', strtotime('yesterday ' . $reportTime));
                    $windowLabel = date('H:i d/m/Y', strtotime($startTimestamp)) . " → " . date('H:i d/m/Y', strtotime($endTimestamp));
                } else {
                    // Parse date range dd/mm hoặc dd/mm to dd/mm
                    $range = parseReportDateRange($cmdArg);
                    if ($range) {
                        $startTimestamp = $range['start'];
                        $endTimestamp = $range['end'];
                        $windowLabel = $range['label'];
                    }
                }

                if (empty($startTimestamp) || empty($endTimestamp)) {
                    sendZaloMessage($botToken, $chatId, "⚠️ Cú pháp ngày tháng không hợp lệ. Vui lòng gõ theo mẫu:\n- `/report 21/05` hoặc `/report 20/05 to 21/05`.\n- Hoặc gõ `/tools` để xem tất cả các lệnh.");
                    exit;
                }

                $reportMsg = getReportByTimeWindow($conn, $startTimestamp, $endTimestamp, $windowLabel);
                sendZaloMessage($botToken, $chatId, $reportMsg);
                exit;
            }

            if (strpos($textLower, '/ticket') === 0) {
                $cmdArg = trim(substr($text, 7)); // Bỏ qua "/ticket"
                if ($cmdArg === 'pending') {
                    // Truy vấn ticket đang chờ duyệt
                    $stmtTick = $conn->query("
                        SELECT dr.id, c.name as sale_name, l.name as lead_name, dr.reason, dr.created_at 
                        FROM data_reports dr 
                        JOIN consultants c ON dr.consultant_id = c.id 
                        JOIN leads l ON dr.lead_id = l.id 
                        WHERE dr.status = 'pending' 
                        ORDER BY dr.created_at ASC 
                        LIMIT 5
                    ");
                    $tickMsg = "🎫 [ DANH SÁCH TICKET CHỜ DUYỆT ]\n\n";
                    if ($stmtTick && $stmtTick->num_rows > 0) {
                        $count = 1;
                        while ($rowTick = $stmtTick->fetch_assoc()) {
                            $tickMsg .= "$count. 🎫 Mã ticket: #" . $rowTick['id'] . "\n"
                                     . "   👤 Sale: " . $rowTick['sale_name'] . "\n"
                                     . "   👤 KH: " . $rowTick['lead_name'] . "\n"
                                     . "   📝 Lý do: " . $rowTick['reason'] . "\n"
                                     . "   🕒 Thời gian: " . date('d/m H:i', strtotime($rowTick['created_at'])) . "\n"
                                     . "   👉 Duyệt: Gõ `/accept " . $rowTick['id'] . "`\n\n";
                            $count++;
                        }
                        $tickMsg .= "💡 Duyệt nhanh bằng cách gõ `/accept [mã_ticket]` (Ví dụ: `/accept 12`).";
                    } else {
                        $tickMsg .= "✅ Hiện không có ticket nào đang chờ duyệt.";
                    }
                    sendZaloMessage($botToken, $chatId, $tickMsg);
                    exit;
                } else if ($cmdArg === 'homnay' || $cmdArg === 'today') {
                    // Thống kê ticket hôm nay từ 00:00 đến nay
                    $todayStart = date('Y-m-d 00:00:00');
                    $todayEnd = date('Y-m-d 23:59:59');
                    
                    $stmtStats = $conn->prepare("
                        SELECT status, COUNT(*) as count 
                        FROM data_reports 
                        WHERE created_at >= ? AND created_at <= ? 
                        GROUP BY status
                    ");
                    $statsMsg = "🎫 [ THỐNG KÊ TICKET HÔM NAY ]\n"
                              . "🕒 Thời gian: " . date('d/m/Y') . "\n\n";
                    if ($stmtStats) {
                        $stmtStats->bind_param("ss", $todayStart, $todayEnd);
                        $stmtStats->execute();
                        $resStats = $stmtStats->get_result();
                        
                        $pending = 0;
                        $approved = 0;
                        $rejected = 0;
                        while ($row = $resStats->fetch_assoc()) {
                            if ($row['status'] === 'pending') $pending = $row['count'];
                            if ($row['status'] === 'approved') $approved = $row['count'];
                            if ($row['status'] === 'rejected') $rejected = $row['count'];
                        }
                        $stmtStats->close();
                        
                        $total = $pending + $approved + $rejected;
                        $statsMsg .= "📊 Tổng ticket phát sinh: $total\n"
                                  . "  ⏳ Chờ duyệt: $pending\n"
                                  . "  ✅ Đã duyệt: $approved\n"
                                  . "  ❌ Đã từ chối: $rejected";
                    } else {
                        $statsMsg .= "⚠️ Lỗi truy vấn dữ liệu ticket.";
                    }
                    sendZaloMessage($botToken, $chatId, $statsMsg);
                    exit;
                } else {
                    sendZaloMessage($botToken, $chatId, "⚠️ Vui lòng sử dụng `/ticket pending` hoặc `/ticket homnay`.");
                    exit;
                }
            }

            if (strpos($textLower, '/accept') === 0) {
                $cmdArg = trim(substr($text, 7));
                $ticketId = 0;
                $customReason = '';
                if (preg_match('/^#?(\d+)(?:\s+(.+))?$/s', $cmdArg, $matches)) {
                    $ticketId = (int)$matches[1];
                    $customReason = isset($matches[2]) ? trim($matches[2]) : '';
                }

                if ($ticketId <= 0) {
                    sendZaloMessage($botToken, $chatId, "⚠️ Vui lòng cung cấp mã ticket hợp lệ. Ví dụ: `/accept 12 [lý do]`.");
                    exit;
                }

                $conn->begin_transaction();
                try {
                    // 1. Lấy thông tin report và CC email của vòng
                    $stmt = $conn->prepare("
                        SELECT r.lead_id, r.consultant_id, r.round_id, r.reason, r.status, dr.cc_emails
                        FROM data_reports r
                        LEFT JOIN distribution_rounds dr ON r.round_id = dr.id
                        WHERE r.id = ? FOR UPDATE
                    ");
                    if (!$stmt) {
                        throw new Exception("Lỗi truy vấn DB.");
                    }
                    $stmt->bind_param("i", $ticketId);
                    $stmt->execute();
                    $report = $stmt->get_result()->fetch_assoc();
                    $stmt->close();

                    if (!$report) {
                        throw new Exception("Không tìm thấy ticket lỗi mã #$ticketId.");
                    }
                    if ($report['status'] !== 'pending') {
                        throw new Exception("Ticket #$ticketId đã được xử lý từ trước (Trạng thái hiện tại: " . $report['status'] . ").");
                    }

                    // Lý do duyệt nhanh qua Zalo
                    if (!empty($customReason)) {
                        $approval_reason = htmlspecialchars($customReason) . " (Duyệt qua Zalo bởi " . $adminName . ")";
                    } else {
                        $approval_reason = "Được duyệt nhanh qua Zalo bởi " . $adminName;
                    }

                    // 2. Cập nhật status báo cáo thành approved kèm lý do
                    $updRep = $conn->prepare("UPDATE data_reports SET status='approved', approval_reason=?, resolved_at=NOW() WHERE id=?");
                    if (!$updRep) {
                        throw new Exception("Lỗi chuẩn bị truy vấn cập nhật.");
                    }
                    $updRep->bind_param("si", $approval_reason, $ticketId);
                    $updRep->execute();
                    $updRep->close();

                    // 3. Cập nhật ghi chú của Lead và đánh dấu phân bổ lỗi
                    $faultyMsg = "[LỖI - ĐÃ DUYỆT QUA ZALO]: " . $report['reason'] . " | Lý do duyệt: " . $approval_reason;
                    $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
                    if (!$updLead) {
                        throw new Exception("Lỗi cập nhật Lead.");
                    }
                    $updLead->bind_param("si", $faultyMsg, $report['lead_id']);
                    $updLead->execute();
                    $updLead->close();

                    // Đánh dấu distribution_logs là error
                    $updLog = $conn->prepare("UPDATE distribution_logs SET status='error' WHERE lead_id=? AND assigned_to=? AND round_id=?");
                    if (!$updLog) {
                        throw new Exception("Lỗi cập nhật Distribution Logs.");
                    }
                    $updLog->bind_param("iii", $report['lead_id'], $report['consultant_id'], $report['round_id']);
                    $updLog->execute();
                    $updLog->close();

                    // 4. Cộng thêm 1 lượt đền bù cho consultant trong vòng đó
                    $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id=? AND consultant_id=?");
                    if (!$updComp) {
                        throw new Exception("Lỗi cập nhật Round Consultants.");
                    }
                    $updComp->bind_param("ii", $report['round_id'], $report['consultant_id']);
                    $updComp->execute();
                    $updComp->close();

                    // Ghi log hành động admin
                    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Zalo Bot';
                    $detailsJson = json_encode([
                        'report_id' => $ticketId, 
                        'lead_id' => $report['lead_id'], 
                        'consultant_id' => $report['consultant_id'], 
                        'round_id' => $report['round_id'],
                        'approval_reason' => $approval_reason
                    ], JSON_UNESCAPED_UNICODE);
                    $stmtLog = $conn->prepare("INSERT INTO admin_logs (account_id, action, details, ip_address) VALUES (?, 'APPROVE_REPORT_ZALO', ?, ?)");
                    if ($stmtLog) {
                        $stmtLog->bind_param("iss", $adminAccountId, $detailsJson, $ip);
                        $stmtLog->execute();
                        $stmtLog->close();
                        pruneAdminLogs($conn);
                    }

                    $conn->commit();
                } catch (Exception $ex) {
                    $conn->rollback();
                    sendZaloMessage($botToken, $chatId, "❌ Lỗi: " . $ex->getMessage());
                    exit;
                }

                // Gửi thông báo ngoài giao dịch DB
                try {
                    // Lấy thông tin Sale & Lead để gửi thông báo
                    $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
                    $consultant = null;
                    if ($consultStmt) {
                        $consultStmt->bind_param("i", $report['consultant_id']);
                        $consultStmt->execute();
                        $consultant = $consultStmt->get_result()->fetch_assoc();
                        $consultStmt->close();
                    }

                    $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
                    $lead = null;
                    if ($leadStmt) {
                        $leadStmt->bind_param("i", $report['lead_id']);
                        $leadStmt->execute();
                        $lead = $leadStmt->get_result()->fetch_assoc();
                        $leadStmt->close();
                    }

                    $cName = $consultant['name'] ?? 'Tư vấn viên';
                    $lName = $lead['name'] ?? 'Khách hàng';
                    $lPhone = $lead['phone'] ?? 'Không rõ';

                    // Lấy danh sách Ticket Admins nhận thông báo
                    $adminEmails = [];
                    $resTickAdmins = $conn->query("
                        SELECT a.id, a.name, a.email, a.zalo_chat_id 
                        FROM ticket_notify_settings tns
                        JOIN accounts a ON tns.account_id = a.id
                    ");
                    if ($resTickAdmins && $resTickAdmins->num_rows > 0) {
                        while ($row = $resTickAdmins->fetch_assoc()) {
                            $adminEmails[] = $row;
                        }
                    } else {
                        // Fallback: role = 'admin' or id = 1
                        $resTickAdminsFallback = $conn->query("SELECT id, name, email, zalo_chat_id FROM accounts WHERE role = 'admin' OR id = 1");
                        if ($resTickAdminsFallback) {
                            while ($row = $resTickAdminsFallback->fetch_assoc()) {
                                $adminEmails[] = $row;
                            }
                        }
                    }

                    // Gửi thông báo xác nhận thành công cho Admin duyệt qua Zalo
                    try {
                        $successAdminMsg = "✅ Đã duyệt thành công ticket #$ticketId của Sale $cName.\n"
                                         . "• Khách hàng: $lName ($lPhone)\n"
                                         . "• Lý do lỗi: {$report['reason']}\n"
                                         . "• Hệ thống đã ghi nhận 1 lượt bù data cho Sale này.";
                        sendZaloMessage($botToken, $chatId, $successAdminMsg);
                    } catch (Exception $zAdminSuccessEx) {
                        error_log("Error sending Zalo success message to admin: " . $zAdminSuccessEx->getMessage());
                    }

                    // Thông báo Zalo cho các Ticket Admins khác (tránh gửi lại cho admin thực hiện lệnh)
                    if (!empty($botToken) && !empty($adminEmails)) {
                        $adminChatIds = [];
                        foreach ($adminEmails as $adm) {
                            if (!empty($adm['zalo_chat_id']) && $adm['zalo_chat_id'] !== $chatId) {
                                $adminChatIds[] = $adm['zalo_chat_id'];
                            }
                        }
                        if (!empty($adminChatIds)) {
                            try {
                                $zaloAdminMsg = "[ THÔNG BÁO TICKET ĐÃ DUYỆT ]\n\n"
                                    . "Admin $adminName đã duyệt nhanh ticket #$ticketId của Sale $cName qua Zalo.\n\n"
                                    . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                                    . "  • Khách hàng: $lName ($lPhone)\n"
                                    . "  • Lỗi báo cáo: {$report['reason']}\n\n"
                                    . "❖ LÝ DO DUYỆT:\n"
                                    . "  $approval_reason\n\n"
                                    . "Lượt đền bù đã được ghi nhận cho Sale.";
                                sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg);
                            } catch (Exception $zEx2) {
                                error_log("Error sending Zalo message to multiple admins in zalo_webhook: " . $zEx2->getMessage());
                            }
                        }
                    }

                    // Thông báo qua Zalo Bot cho Sale
                    if ($consultant && !empty($consultant['zalo_chat_id'])) {
                        try {
                            $zaloMsg = "[ TICKET ĐÃ ĐƯỢC DUYỆT ]\n\n"
                                . "Chào $cName, báo cáo lỗi Data của bạn đã ĐƯỢC PHÊ DUYỆT bởi $adminName.\n\n"
                                . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                                . "  • Khách hàng: $lName ($lPhone)\n"
                                . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                                . "❖ LÝ DO DUYỆT:\n"
                                . "  $approval_reason\n\n"
                                . "Hệ thống đã ghi nhận 1 lượt đền bù. Bạn sẽ nhận được Data mới vào lần phân bổ tiếp theo.";
                            sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
                        } catch (Exception $zSaleEx) {
                            error_log("Error sending Zalo message to sale in zalo_webhook: " . $zSaleEx->getMessage());
                        }
                    }

                    // Thông báo qua Email cho Sale (kèm CC)
                    if ($consultant && !empty($consultant['email'])) {
                        try {
                            require_once __DIR__ . '/mailer.php';
                            
                            // Gom danh sách CC (Round CC + Ticket Admins, lọc trùng và loại bỏ email của Sale nhận số)
                            $ccEmailsArr = [];
                            if (!empty($report['cc_emails'])) {
                                $parts = explode(',', $report['cc_emails']);
                                foreach ($parts as $p) {
                                    $p = trim($p);
                                    if (!empty($p) && filter_var($p, FILTER_VALIDATE_EMAIL)) {
                                        $ccEmailsArr[] = strtolower($p);
                                    }
                                }
                            }
                            foreach ($adminEmails as $adm) {
                                if (!empty($adm['email'])) {
                                    $email = trim($adm['email']);
                                    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                                        $ccEmailsArr[] = strtolower($email);
                                    }
                                }
                            }
                            $ccEmailsArr = array_unique($ccEmailsArr);
                            $saleEmail = strtolower(trim($consultant['email']));
                            $ccEmailsArr = array_filter($ccEmailsArr, fn($e) => $e !== $saleEmail);
                            $ccString = implode(',', $ccEmailsArr);

                            $emailSubj = "[Domation DATA] Ticket Lỗi Data Đã Được Duyệt - $lName";
                            $emailBody = "<h3>Báo cáo lỗi Data được phê duyệt</h3>
                                          <p>Chào $cName,</p>
                                          <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã được Quản trị viên <strong>$adminName</strong> duyệt thành công qua Zalo.</p>
                                          <p><strong>Lý do duyệt:</strong> $approval_reason</p>
                                          <p>Hệ thống đã tự động cộng 1 lượt đền bù cho bạn trong vòng phân bổ hiện tại.</p>";
                            sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, $ccString);
                        } catch (Exception $emailEx) {
                            error_log("Error sending email in zalo_webhook /accept: " . $emailEx->getMessage());
                        }
                    }
                } catch (Exception $notifyOuterEx) {
                    error_log("Outer notification error in zalo_webhook /accept: " . $notifyOuterEx->getMessage());
                }
                exit;
            }

            if (strpos($textLower, '/reject') === 0) {
                $cmdArg = trim(substr($text, 7));
                $ticketId = 0;
                $rejectReason = '';
                if (preg_match('/^#?(\d+)(?:\s+(.+))?$/s', $cmdArg, $matches)) {
                    $ticketId = (int)$matches[1];
                    $rejectReason = isset($matches[2]) ? trim($matches[2]) : '';
                }

                if ($ticketId <= 0 || empty($rejectReason)) {
                    sendZaloMessage($botToken, $chatId, "⚠️ Vui lòng cung cấp mã ticket và lý do từ chối. Cú pháp: `/reject <mã_ticket> <lý do từ chối>` (Ví dụ: `/reject 12 Khách vẫn đổ chuông`).");
                    exit;
                }

                $conn->begin_transaction();
                try {
                    // 1. Lấy thông tin report và CC email của vòng
                    $stmt = $conn->prepare("
                        SELECT r.lead_id, r.consultant_id, r.round_id, r.reason, r.status, dr.cc_emails
                        FROM data_reports r
                        LEFT JOIN distribution_rounds dr ON r.round_id = dr.id
                        WHERE r.id = ? FOR UPDATE
                    ");
                    if (!$stmt) {
                        throw new Exception("Lỗi truy vấn DB.");
                    }
                    $stmt->bind_param("i", $ticketId);
                    $stmt->execute();
                    $report = $stmt->get_result()->fetch_assoc();
                    $stmt->close();

                    if (!$report) {
                        throw new Exception("Không tìm thấy ticket lỗi mã #$ticketId.");
                    }
                    if ($report['status'] !== 'pending') {
                        throw new Exception("Ticket #$ticketId đã được xử lý từ trước (Trạng thái hiện tại: " . $report['status'] . ").");
                    }

                    // Lý do từ chối qua Zalo
                    $fullRejectReason = htmlspecialchars($rejectReason) . " (Từ chối qua Zalo bởi " . $adminName . ")";

                    // 2. Cập nhật status báo cáo thành rejected kèm lý do
                    $updRep = $conn->prepare("UPDATE data_reports SET status='rejected', reject_reason=?, resolved_at=NOW() WHERE id=?");
                    if (!$updRep) {
                        throw new Exception("Lỗi chuẩn bị truy vấn cập nhật.");
                    }
                    $updRep->bind_param("si", $fullRejectReason, $ticketId);
                    $updRep->execute();
                    $updRep->close();

                    // 3. Cập nhật ghi chú của Lead và ghi log từ chối
                    $faultyMsg = "[LỖI - ĐÃ TỪ CHỐI QUA ZALO]: " . $report['reason'] . " | Lý do từ chối: " . $fullRejectReason;
                    $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
                    if (!$updLead) {
                        throw new Exception("Lỗi cập nhật Lead.");
                    }
                    $updLead->bind_param("si", $faultyMsg, $report['lead_id']);
                    $updLead->execute();
                    $updLead->close();

                    // Ghi log hành động admin
                    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Zalo Bot';
                    $detailsJson = json_encode([
                        'report_id' => $ticketId, 
                        'lead_id' => $report['lead_id'], 
                        'consultant_id' => $report['consultant_id'], 
                        'round_id' => $report['round_id'],
                        'reject_reason' => $fullRejectReason
                    ], JSON_UNESCAPED_UNICODE);
                    $stmtLog = $conn->prepare("INSERT INTO admin_logs (account_id, action, details, ip_address) VALUES (?, 'REJECT_REPORT_ZALO', ?, ?)");
                    if ($stmtLog) {
                        $stmtLog->bind_param("iss", $adminAccountId, $detailsJson, $ip);
                        $stmtLog->execute();
                        $stmtLog->close();
                        pruneAdminLogs($conn);
                    }

                    $conn->commit();
                } catch (Exception $ex) {
                    $conn->rollback();
                    sendZaloMessage($botToken, $chatId, "❌ Lỗi: " . $ex->getMessage());
                    exit;
                }

                // Gửi thông báo ngoài giao dịch DB
                try {
                    // Lấy thông tin Sale & Lead để gửi thông báo
                    $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
                    $consultant = null;
                    if ($consultStmt) {
                        $consultStmt->bind_param("i", $report['consultant_id']);
                        $consultStmt->execute();
                        $consultant = $consultStmt->get_result()->fetch_assoc();
                        $consultStmt->close();
                    }

                    $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
                    $lead = null;
                    if ($leadStmt) {
                        $leadStmt->bind_param("i", $report['lead_id']);
                        $leadStmt->execute();
                        $lead = $leadStmt->get_result()->fetch_assoc();
                        $leadStmt->close();
                    }

                    $cName = $consultant['name'] ?? 'Tư vấn viên';
                    $lName = $lead['name'] ?? 'Khách hàng';
                    $lPhone = $lead['phone'] ?? 'Không rõ';

                    // Lấy danh sách Ticket Admins nhận thông báo
                    $adminEmails = [];
                    $resTickAdmins = $conn->query("
                        SELECT a.id, a.name, a.email, a.zalo_chat_id 
                        FROM ticket_notify_settings tns
                        JOIN accounts a ON tns.account_id = a.id
                    ");
                    if ($resTickAdmins && $resTickAdmins->num_rows > 0) {
                        while ($row = $resTickAdmins->fetch_assoc()) {
                            $adminEmails[] = $row;
                        }
                    } else {
                        // Fallback: role = 'admin' or id = 1
                        $resTickAdminsFallback = $conn->query("SELECT id, name, email, zalo_chat_id FROM accounts WHERE role = 'admin' OR id = 1");
                        if ($resTickAdminsFallback) {
                            while ($row = $resTickAdminsFallback->fetch_assoc()) {
                                $adminEmails[] = $row;
                            }
                        }
                    }

                    // Gửi thông báo xác nhận thành công cho Admin từ chối qua Zalo
                    try {
                        $successAdminMsg = "❌ Đã từ chối ticket #$ticketId của Sale $cName.\n"
                                         . "• Khách hàng: $lName ($lPhone)\n"
                                         . "• Lỗi báo cáo: {$report['reason']}\n"
                                         . "• Lý do từ chối: $fullRejectReason";
                        sendZaloMessage($botToken, $chatId, $successAdminMsg);
                    } catch (Exception $zAdminSuccessEx) {
                        error_log("Error sending Zalo success message to admin: " . $zAdminSuccessEx->getMessage());
                    }

                    // Thông báo Zalo cho các Ticket Admins khác (tránh gửi lại cho admin thực hiện lệnh)
                    if (!empty($botToken) && !empty($adminEmails)) {
                        $adminChatIds = [];
                        foreach ($adminEmails as $adm) {
                            if (!empty($adm['zalo_chat_id']) && $adm['zalo_chat_id'] !== $chatId) {
                                $adminChatIds[] = $adm['zalo_chat_id'];
                            }
                        }
                        if (!empty($adminChatIds)) {
                            try {
                                $zaloAdminMsg = "[ THÔNG BÁO TICKET ĐÃ TỪ CHỐI ]\n\n"
                                    . "Admin $adminName đã TỪ CHỐI ticket #$ticketId của Sale $cName qua Zalo.\n\n"
                                    . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                                    . "  • Khách hàng: $lName ($lPhone)\n"
                                    . "  • Lỗi báo cáo: {$report['reason']}\n\n"
                                    . "❖ LÝ DO TỪ CHỐI:\n"
                                    . "  $fullRejectReason";
                                sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg);
                            } catch (Exception $zEx2) {
                                error_log("Error sending Zalo message to multiple admins in zalo_webhook /reject: " . $zEx2->getMessage());
                            }
                        }
                    }

                    // Thông báo qua Zalo Bot cho Sale
                    if ($consultant && !empty($consultant['zalo_chat_id'])) {
                        try {
                            $zaloMsg = "[ TICKET ĐÃ BỊ TỪ CHỐI ]\n\n"
                                . "Chào $cName, báo cáo lỗi Data của bạn đã BỊ TỪ CHỐI bởi $adminName.\n\n"
                                . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                                . "  • Khách hàng: $lName ($lPhone)\n"
                                . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                                . "❖ LÝ DO TỪ CHỐI:\n"
                                . "  $fullRejectReason\n\n"
                                . "Lượt đền bù KHÔNG được ghi nhận cho báo cáo này.";
                            sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
                        } catch (Exception $zSaleEx) {
                            error_log("Error sending Zalo message to sale in zalo_webhook /reject: " . $zSaleEx->getMessage());
                        }
                    }

                    // Thông báo qua Email cho Sale (kèm CC)
                    if ($consultant && !empty($consultant['email'])) {
                        try {
                            require_once __DIR__ . '/mailer.php';
                            
                            $ccEmailsArr = [];
                            if (!empty($report['cc_emails'])) {
                                $parts = explode(',', $report['cc_emails']);
                                foreach ($parts as $p) {
                                    $p = trim($p);
                                    if (!empty($p) && filter_var($p, FILTER_VALIDATE_EMAIL)) {
                                        $ccEmailsArr[] = strtolower($p);
                                    }
                                }
                            }
                            foreach ($adminEmails as $adm) {
                                if (!empty($adm['email'])) {
                                    $email = trim($adm['email']);
                                    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                                        $ccEmailsArr[] = strtolower($email);
                                    }
                                }
                            }
                            $ccEmailsArr = array_unique($ccEmailsArr);
                            $saleEmail = strtolower(trim($consultant['email']));
                            $ccEmailsArr = array_filter($ccEmailsArr, fn($e) => $e !== $saleEmail);
                            $ccString = implode(',', $ccEmailsArr);

                            $emailSubj = "[Domation DATA] Ticket Lỗi Data Đã Bị Từ Chối - $lName";
                            $emailBody = "<h3>Báo cáo lỗi Data bị từ chối</h3>
                                          <p>Chào $cName,</p>
                                          <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã bị Quản trị viên <strong>$adminName</strong> TỪ CHỐI qua Zalo.</p>
                                          <p><strong>Lý do từ chối:</strong> $fullRejectReason</p>
                                          <p>Hệ thống không đền bù data cho báo cáo này.</p>";
                            sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, $ccString);
                        } catch (Exception $emailEx) {
                            error_log("Error sending email in zalo_webhook /reject: " . $emailEx->getMessage());
                        }
                    }
                } catch (Exception $notifyOuterEx) {
                    error_log("Outer notification error in zalo_webhook /reject: " . $notifyOuterEx->getMessage());
                }
                exit;
            }

            if (strpos($textLower, '/sales') === 0) {
                // Liệt kê các TVV đang hoạt động/off/leave
                $resSales = $conn->query("
                    SELECT name, status, leave_start, leave_end 
                    FROM consultants 
                    ORDER BY status ASC, name ASC
                ");
                $salesMsg = "👥 [ TRẠNG THÁI TƯ VẤN VIÊN ]\n\n";
                if ($resSales && $resSales->num_rows > 0) {
                    while ($rowS = $resSales->fetch_assoc()) {
                        $statusStr = '';
                        if ($rowS['status'] === 'active') {
                            $statusStr = '🟢 Đang nhận số';
                        } else if ($rowS['status'] === 'leave') {
                            $leaveInfo = '';
                            if (!empty($rowS['leave_start']) && !empty($rowS['leave_end'])) {
                                $leaveInfo = ' (' . date('d/m', strtotime($rowS['leave_start'])) . ' → ' . date('d/m', strtotime($rowS['leave_end'])) . ')';
                            }
                            $statusStr = '🔴 Nghỉ phép' . $leaveInfo;
                        } else {
                            $statusStr = '⚪ Tạm ngưng';
                        }
                        $salesMsg .= "  👤 " . $rowS['name'] . ": $statusStr\n";
                    }
                } else {
                    $salesMsg .= "❌ Không tìm thấy tư vấn viên nào trên hệ thống.";
                }
                sendZaloMessage($botToken, $chatId, $salesMsg);
                exit;
            }

            if (strpos($textLower, '/round') === 0) {
                // Liệt kê các vòng phân bổ đang hoạt động
                $resRounds = $conn->query("
                    SELECT id, round_name 
                    FROM distribution_rounds 
                    WHERE is_active = 1 
                    ORDER BY id ASC
                ");
                
                $roundMsg = "🔄 [ TRẠNG THÁI VÒNG PHÂN BỔ ]\n\n";
                
                if ($resRounds && $resRounds->num_rows > 0) {
                    $roundCount = 1;
                    while ($rowR = $resRounds->fetch_assoc()) {
                        $roundId = (int)$rowR['id'];
                        $roundName = $rowR['round_name'];
                        
                        // Lấy Sale tiếp theo dự kiến bằng hàm mô phỏng không ghi DB
                        $nextSale = simulateNextConsultantInRound($conn, $roundId);
                        
                        $roundMsg .= "$roundCount. Vòng: $roundName\n";
                        
                        if ($nextSale) {
                            $reason = 'Lượt xoay vòng';
                            $details = '';
                            if (intval($nextSale['compensation_count']) > 0) {
                                $reason = 'Đền bù data lỗi';
                                $details = ' (còn ' . $nextSale['compensation_count'] . ' lượt)';
                            } else if (intval($nextSale['current_turn_remaining']) > 0) {
                                $reason = 'Đang nhận số';
                                $details = ' (còn ' . $nextSale['current_turn_remaining'] . ' data)';
                            } else {
                                $ratio = max(1, (int)($nextSale['receive_ratio'] ?? 1));
                                $skip = (int)($nextSale['skip_count'] ?? 0);
                                if ($ratio > 1) {
                                    $details = " (Tỉ lệ: 1/{$ratio}, Bỏ qua: {$skip}/" . ($ratio - 1) . ")";
                                } else {
                                    $details = " (Tỉ lệ: 1/1)";
                                }
                            }
                            $roundMsg .= "   ↳ Sale sắp tới: " . $nextSale['name'] . " - " . $reason . $details . "\n\n";
                        } else {
                            $roundMsg .= "   ↳ Sale sắp tới: Không có Sale hoạt động trong vòng này! ⚠️\n\n";
                        }
                        
                        $roundCount++;
                    }
                    $roundMsg = rtrim($roundMsg);
                } else {
                    $roundMsg .= "✅ Hiện không có vòng phân bổ nào đang hoạt động.";
                }
                
                sendZaloMessage($botToken, $chatId, $roundMsg);
                exit;
            }

            if (strpos($textLower, '/check') === 0) {
                $cmdArg = trim(substr($text, 6)); // Bỏ qua "/check"
                if (empty($cmdArg)) {
                    sendZaloMessage($botToken, $chatId, "⚠️ Vui lòng nhập số điện thoại hoặc email để kiểm tra. Ví dụ:\n- `/check 0987654321`\n- `/check mail@example.com`\n- Gõ `/tools` để xem tất cả câu lệnh.");
                    exit;
                }
                
                // Chuẩn hóa sđt hoặc email
                $normalizedPhone = normalizePhone($cmdArg);
                $emailSearch = $cmdArg;
                
                // Truy vấn thông tin Lead và Sale
                $stmtLead = $conn->prepare("
                    SELECT l.id, l.phone, l.email, l.name, l.source, l.type, l.note, l.created_at, 
                           c.name as sale_name
                    FROM leads l 
                    LEFT JOIN consultants c ON l.assigned_to = c.id 
                    WHERE (l.phone = ? AND l.phone IS NOT NULL AND l.phone != '') 
                       OR (l.email = ? AND l.email IS NOT NULL AND l.email != '')
                    LIMIT 1
                ");
                
                if ($stmtLead) {
                    $stmtLead->bind_param("ss", $normalizedPhone, $emailSearch);
                    $stmtLead->execute();
                    $resLead = $stmtLead->get_result();
                    
                    if ($resLead && $rowLead = $resLead->fetch_assoc()) {
                        $leadId = (int)$rowLead['id'];
                        
                        // Lấy thông tin vòng phân bổ từ log phân bổ gần nhất
                        $roundName = 'Chưa xác định';
                        $distStatus = '';
                        $receivedAt = '';
                        $stmtLog = $conn->prepare("
                            SELECT dr.round_name, dl.status, dl.received_at 
                            FROM distribution_logs dl 
                            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id 
                            WHERE dl.lead_id = ? 
                            ORDER BY dl.id DESC 
                            LIMIT 1
                        ");
                        if ($stmtLog) {
                            $stmtLog->bind_param("i", $leadId);
                            $stmtLog->execute();
                            $resLog = $stmtLog->get_result();
                            if ($resLog && $rowLog = $resLog->fetch_assoc()) {
                                $roundName = $rowLog['round_name'];
                                $distStatus = $rowLog['status'];
                                $receivedAt = $rowLog['received_at'];
                                
                                if (empty($roundName) || $roundName === 'Chưa xác định') {
                                    if ($distStatus === 'reminder') {
                                        $roundName = 'Nhắc lại (Trùng số)';
                                    } elseif ($distStatus === 'silent') {
                                        $roundName = 'Đồng bộ ẩn (Không định tuyến)';
                                    } elseif ($distStatus === 'assigned') {
                                        $roundName = 'Chỉ định trực tiếp';
                                    } elseif ($distStatus === 'no_consultant') {
                                        $roundName = 'Không tìm thấy Sale';
                                    }
                                }
                            }
                            $stmtLog->close();
                        }
                        
                        $checkMsg = "🔍 [ THÔNG TIN LEAD ]\n\n"
                                  . "👤 Khách hàng: " . ($rowLead['name'] ?: 'Chưa có tên') . "\n"
                                  . "📞 Số điện thoại: " . ($rowLead['phone'] ?: 'Không có') . "\n"
                                  . "✉️ Email: " . ($rowLead['email'] ?: 'Không có') . "\n"
                                  . "🌐 Nguồn: " . ($rowLead['source'] ?: 'Không có') . "\n"
                                  . "🏷️ Loại: " . ($rowLead['type'] ?: 'Không có') . "\n"
                                  . "🕒 Ngày tạo: " . date('d/m/Y H:i', strtotime($rowLead['created_at'])) . "\n\n"
                                  . "🔄 PHÂN BỔ:\n"
                                  . "  • Vòng: " . $roundName . "\n"
                                  . "  • Sale nhận: " . ($rowLead['sale_name'] ?: 'Chưa giao') . "\n";
                        
                        if (!empty($receivedAt)) {
                            $checkMsg .= "  • Thời gian nhận: " . date('d/m/Y H:i:s', strtotime($receivedAt)) . "\n";
                        }
                        
                        if (!empty($distStatus)) {
                            $statusMap = [
                                'success' => '✅ Thành công',
                                'error' => '❌ Lỗi',
                                'reminder' => '🔄 Nhắc lại',
                                'silent' => '🔇 Đồng bộ ẩn',
                                'assigned' => '👤 Chỉ định trực tiếp',
                                'no_consultant' => '⚠️ Không có Sale nhận',
                                'pending_work_hours' => '⏳ Chờ ngoài giờ'
                            ];
                            $statusEmoji = $statusMap[$distStatus] ?? $distStatus;
                            $checkMsg .= "  • Trạng thái: " . $statusEmoji . "\n";
                        }
                        
                        $checkMsg .= "\n📝 GHI CHÚ:\n" . ($rowLead['note'] ?: 'Không có ghi chú.');
                        
                        sendZaloMessage($botToken, $chatId, $checkMsg);
                    } else {
                        sendZaloMessage($botToken, $chatId, "❌ Không tìm thấy Lead nào trong hệ thống khớp với thông tin: \"$cmdArg\"");
                    }
                    $stmtLead->close();
                } else {
                    sendZaloMessage($botToken, $chatId, "❌ Lỗi hệ thống khi kiểm tra dữ liệu.");
                }
                exit;
            }
        }

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
