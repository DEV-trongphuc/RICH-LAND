<?php
// backend/cron_mailer.php
// Tiến trình chạy ngầm (Worker) để gửi Email bất đồng bộ từ bảng mail_queue

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Đặt thời gian thực thi không giới hạn
set_time_limit(0);

// --- PREVENT CONCURRENT EXECUTION (CHỐNG XUNG ĐỘT) ---
$lockFile = __DIR__ . '/cron_mailer.lock';
$lockFp = @fopen($lockFile, 'w');
if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] Another instance of cron_mailer.php is already running or lock file is not writable. Exiting.\n";
    exit(0);
}
// --- END PREVENT CONCURRENT EXECUTION ---

function runMailerCron($conn) {
    // 1. Kéo cài đặt email từ DB
    $settings = [];
    $settingRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('email_provider', 'appscript_webhook_url', 'ses_host', 'ses_username', 'ses_password', 'ses_sender_email', 'ses_sender_name')");
    if ($settingRes) {
        while ($row = $settingRes->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    $provider = $settings['email_provider'] ?? 'appscript';

    // 2. Kéo tối đa 50 email đang chờ gửi hoặc bị lỗi dưới 3 lần
    $res = $conn->query("SELECT id, to_email, cc_email, subject, body_html, attempts, lead_id FROM mail_queue WHERE status = 'pending' OR (status = 'failed' AND attempts < 3) ORDER BY id ASC LIMIT 50");
    if (!$res || $res->num_rows === 0) {
        echo "[" . date('Y-m-d H:i:s') . "] No pending or retryable emails to send.\n";
        return;
    }

    echo "[" . date('Y-m-d H:i:s') . "] Found " . $res->num_rows . " emails to process. Processing...\n";

    $successCount = 0;
    $failCount = 0;

    // Chuẩn bị các statement cập nhật trạng thái
    $updSuccessStmt = $conn->prepare("UPDATE mail_queue SET status = 'sent', sent_at = NOW(), attempts = attempts + 1, last_error = NULL WHERE id = ?");
    $updFailStmt = $conn->prepare("UPDATE mail_queue SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?");
    
    // Tối ưu hóa: chuẩn bị statement cập nhật leads ở ngoài vòng lặp
    $updLeadSuccessStmt = $conn->prepare("UPDATE leads SET email_notify_status = 'sent', email_notify_sent_at = NOW() WHERE id = ?");
    $updLeadFailStmt = $conn->prepare("UPDATE leads SET email_notify_status = 'failed' WHERE id = ?");

    // Khởi tạo PHPMailer một lần duy nhất bên ngoài vòng lặp nếu sử dụng SES
    $mail = null;
    if ($provider === 'ses') {
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $settings['ses_host'] ?? '';
            $mail->SMTPAuth = true;
            $mail->Username = $settings['ses_username'] ?? '';
            $mail->Password = $settings['ses_password'] ?? '';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = 587;
            $mail->CharSet = 'UTF-8';
            $mail->Timeout = 10;
            $mail->SMTPKeepAlive = true; // Giữ kết nối SMTP sống để tái sử dụng

            $senderEmail = $settings['ses_sender_email'] ?? 'no-reply@domation.net';
            $senderName = $settings['ses_sender_name'] ?? 'DOMATION TEAM';

            $mail->setFrom($senderEmail, $senderName);
        } catch (Exception $e) {
            error_log("Failed to initialize SMTP connection settings: " . $e->getMessage());
        }
    }

    while ($row = $res->fetch_assoc()) {
        $mailId = $row['id'];
        $to = $row['to_email'];
        $ccEmailString = $row['cc_email'];
        $subject = $row['subject'];
        $htmlBody = $row['body_html'];
        
        $isSent = false;
        $lastErrorMsg = null;

        if ($provider === 'appscript') {
            $url = $settings['appscript_webhook_url'] ?? '';
            if (!empty($url)) {
                $payload = json_encode([
                    "type" => "custom",
                    "email" => $to,
                    "cc" => $ccEmailString,
                    "subject" => $subject,
                    "htmlBody" => $htmlBody
                ]);

                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
                curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type:application/json'));
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 15);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                $result = curl_exec($ch);
                
                if ($result === false) {
                    $err = curl_error($ch);
                    $isSent = false;
                    $lastErrorMsg = "AppScript cURL Error: " . $err;
                } else {
                    $isSent = true;
                }
                curl_close($ch);
            } else {
                $lastErrorMsg = "AppScript Webhook URL is empty.";
            }
        } else if ($provider === 'ses') {
            if ($mail) {
                try {
                    // Dọn dẹp thông tin người nhận cũ trước khi gán mới
                    $mail->clearAddresses();
                    $mail->clearCCs();
                    $mail->clearBCCs();
                    $mail->clearAttachments();

                    $mail->addAddress($to);

                    if (!empty($ccEmailString)) {
                        $ccList = explode(',', $ccEmailString);
                        foreach ($ccList as $cc) {
                            $cc = trim($cc);
                            if (!empty($cc) && filter_var($cc, FILTER_VALIDATE_EMAIL)) {
                                $mail->addCC($cc);
                            }
                        }
                    }

                    $mail->isHTML(true);
                    $mail->Subject = $subject;
                    $mail->Body = $htmlBody;

                    $mail->send();
                    $isSent = true;
                } catch (Exception $e) {
                    $isSent = false;
                    $lastErrorMsg = "PHPMailer Error: " . $mail->ErrorInfo . " | " . $e->getMessage();
                    error_log("Cron Mailer Error for ID $mailId: " . $lastErrorMsg);
                }
            } else {
                $isSent = false;
                $lastErrorMsg = "PHPMailer object was not initialized successfully.";
            }
        } else {
            $lastErrorMsg = "Invalid email provider configuration: " . $provider;
        }

        $leadId = isset($row['lead_id']) ? (int)$row['lead_id'] : 0;

        try {
            // Cập nhật kết quả vào DB
            if ($isSent) {
                if ($updSuccessStmt) {
                    $updSuccessStmt->bind_param("i", $mailId);
                    $updSuccessStmt->execute();
                }
                $successCount++;

                if ($leadId > 0 && $updLeadSuccessStmt) {
                    $updLeadSuccessStmt->bind_param("i", $leadId);
                    $updLeadSuccessStmt->execute();
                }
            } else {
                if ($updFailStmt) {
                    $updFailStmt->bind_param("si", $lastErrorMsg, $mailId);
                    $updFailStmt->execute();
                }
                $failCount++;

                if ($leadId > 0 && $updLeadFailStmt) {
                    $updLeadFailStmt->bind_param("i", $leadId);
                    $updLeadFailStmt->execute();
                }
            }
        } catch (Throwable $dbEx) {
            error_log("Database write failed for mail item $mailId: " . $dbEx->getMessage());
        }
        
        // Nghỉ 100ms giữa các email để tránh bị rate limit (spam block) từ Amazon SES hoặc Google
        usleep(100000); 
    }

    // Đóng kết nối SMTP nếu đã mở
    if ($provider === 'ses' && $mail) {
        try {
            $mail->smtpClose();
        } catch (Exception $e) {
            // Bỏ qua lỗi đóng kết nối SMTP
        }
    }

    if ($updSuccessStmt) $updSuccessStmt->close();
    if ($updFailStmt) $updFailStmt->close();
    if ($updLeadSuccessStmt) $updLeadSuccessStmt->close();
    if ($updLeadFailStmt) $updLeadFailStmt->close();

    // 3. Dọn dẹp cả bản ghi đã gửi và lỗi cũ sau 30 ngày tránh đầy bảng
    try {
        $conn->query("DELETE FROM mail_queue WHERE (status = 'sent' OR status = 'failed') AND (sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY) OR (sent_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)))");
    } catch (Exception $e) {
        error_log("Failed to prune mail queue: " . $e->getMessage());
    }

    echo "[" . date('Y-m-d H:i:s') . "] Processed $successCount sent, $failCount failed.\n";
}

function runZaloMailerCron($conn) {
    require_once __DIR__ . '/zalo_bot.php';

    // 1. Kéo tối đa 50 tin nhắn Zalo đang chờ gửi hoặc bị lỗi dưới 3 lần
    $res = $conn->query("SELECT id, bot_token, chat_id, body_text, attempts, lead_id FROM zalo_queue WHERE status = 'pending' OR (status = 'failed' AND attempts < 3) ORDER BY id ASC LIMIT 50");
    if (!$res || $res->num_rows === 0) {
        echo "[" . date('Y-m-d H:i:s') . "] No pending or retryable Zalo messages to send.\n";
        return;
    }

    echo "[" . date('Y-m-d H:i:s') . "] Found " . $res->num_rows . " Zalo messages to process. Processing...\n";

    $successCount = 0;
    $failCount = 0;

    $updSuccessStmt = $conn->prepare("UPDATE zalo_queue SET status = 'sent', sent_at = NOW(), attempts = attempts + 1, last_error = NULL WHERE id = ?");
    $updFailStmt = $conn->prepare("UPDATE zalo_queue SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?");

    while ($row = $res->fetch_assoc()) {
        $msgId = $row['id'];
        $botToken = $row['bot_token'];
        $chatId = $row['chat_id'];
        $text = $row['body_text'];
        $leadId = isset($row['lead_id']) ? (int)$row['lead_id'] : 0;

        // Gửi trực tiếp cURL bằng cách truyền $sync = true
        // Hàm sendZaloMessage() đã tự động cập nhật trạng thái của lead nên ta không cần chạy thêm SQL UPDATE ở đây.
        $isSent = sendZaloMessage($botToken, $chatId, $text, true, $leadId);

        try {
            if ($isSent) {
                if ($updSuccessStmt) {
                    $updSuccessStmt->bind_param("i", $msgId);
                    $updSuccessStmt->execute();
                }
                $successCount++;
            } else {
                $err = "Zalo API Send Failed (see zalo_send_log.txt for details)";
                if ($updFailStmt) {
                    $updFailStmt->bind_param("si", $err, $msgId);
                    $updFailStmt->execute();
                }
                $failCount++;
            }
        } catch (Throwable $dbEx) {
            error_log("Database write failed for Zalo item $msgId: " . $dbEx->getMessage());
        }

        // Nghỉ 100ms giữa các tin nhắn để tránh bị rate limit từ Zalo Bot API
        usleep(100000);
    }

    if ($updSuccessStmt) $updSuccessStmt->close();
    if ($updFailStmt) $updFailStmt->close();

    // 2. Dọn dẹp cả bản ghi đã gửi và lỗi cũ sau 30 ngày tránh đầy bảng
    try {
        $conn->query("DELETE FROM zalo_queue WHERE (status = 'sent' OR status = 'failed') AND (sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY) OR (sent_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)))");
    } catch (Exception $e) {
        error_log("Failed to prune Zalo queue: " . $e->getMessage());
    }

    echo "[" . date('Y-m-d H:i:s') . "] Zalo: Processed $successCount sent, $failCount failed.\n";
}

// Nếu gọi trực tiếp từ CLI hoặc Cron
if (php_sapi_name() === 'cli' || isset($_GET['run'])) {
    runMailerCron($conn);
    runZaloMailerCron($conn);
    $conn->close();
}
?>
