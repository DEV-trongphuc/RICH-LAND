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
$lockFp = fopen($lockFile, 'w');
if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] Another instance of cron_mailer.php is already running. Exiting.\n";
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
    $res = $conn->query("SELECT id, to_email, cc_email, subject, body_html, attempts FROM mail_queue WHERE status = 'pending' OR (status = 'failed' AND attempts < 3) ORDER BY id ASC LIMIT 50");
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
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
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

                $senderEmail = $settings['ses_sender_email'] ?? 'no-reply@domation.net';
                $senderName = $settings['ses_sender_name'] ?? 'DOMATION TEAM';

                $mail->setFrom($senderEmail, $senderName);
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
            $lastErrorMsg = "Invalid email provider configuration: " . $provider;
        }

        // Cập nhật kết quả vào DB
        if ($isSent) {
            $updSuccessStmt->bind_param("i", $mailId);
            $updSuccessStmt->execute();
            $successCount++;
        } else {
            $updFailStmt->bind_param("si", $lastErrorMsg, $mailId);
            $updFailStmt->execute();
            $failCount++;
        }
        
        // Nghỉ 100ms giữa các email để tránh bị rate limit (spam block) từ Amazon SES hoặc Google
        usleep(100000); 
    }

    $updSuccessStmt->close();
    $updFailStmt->close();
    echo "[" . date('Y-m-d H:i:s') . "] Processed $successCount sent, $failCount failed.\n";
}

// Nếu gọi trực tiếp từ CLI hoặc Cron
if (php_sapi_name() === 'cli' || isset($_GET['run'])) {
    runMailerCron($conn);
    $conn->close();
}
?>
