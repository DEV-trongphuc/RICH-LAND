<?php
// mailer.php

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function _getBaseHtml($title, $subtitle, $contentHtml) {
    return '
    <div style="background-color: #f8fafc; padding: 40px 0; font-family: \'Inter\', Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #eab308, #ea580c); padding: 40px 20px; text-align: center;">
                <div style="margin-bottom: 16px; text-align: center;">
                    <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 50%; padding: 12px; width: 48px; height: 48px;">
                        <img src="https://automation.ideas.edu.vn/imgs/ICON.png" alt="Domation Logo" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));" />
                    </div>
                </div>
                <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 900; letter-spacing: 2px; text-align: center;">DOMATION</h1>
                <p style="color: rgba(255,255,255,0.95); font-size: 13px; margin: 8px 0 0; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">Hệ Thống Phân Bổ Data Tự Động</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
                <h2 style="color: #0f172a; font-size: 22px; margin-top: 0; margin-bottom: 24px;">' . $title . '</h2>
                <div style="color: #475569; font-size: 15px; line-height: 1.6;">
                    ' . $contentHtml . '
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.6;">
                    © ' . date("Y") . ' Domation Ecosystem. All rights reserved.<br/>
                    Email này được gửi tự động từ hệ thống quản trị DOMATION.
                </p>
            </div>
        </div>
    </div>
    ';
}

function sendEmailNotification($to, $subject, $title, $content, $ccEmailString = '') {
    global $conn;
    
    // Fetch settings
    $res = $conn->query("SELECT * FROM system_settings");
    $settings = [];
    while($row = $res->fetch_assoc()) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }

    $provider = $settings['email_provider'] ?? 'appscript';

    $htmlBody = _getBaseHtml($title, "", $content);

    if ($provider === 'appscript') {
        $url = $settings['appscript_webhook_url'] ?? '';
        if (empty($url)) return false;

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
        $result = curl_exec($ch);
        curl_close($ch);
        return true;
    } else if ($provider === 'ses') {
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host       = $settings['ses_host'] ?? '';
            $mail->SMTPAuth   = true;
            $mail->Username   = $settings['ses_username'] ?? '';
            $mail->Password   = $settings['ses_password'] ?? '';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';

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
            $mail->Body    = $htmlBody;

            $mail->send();
            return true;
        } catch (Exception $e) {
            error_log("Message could not be sent. Mailer Error: {$mail->ErrorInfo}");
            return false;
        }
    }
    return false;
}

function sendLeadAssignedEmailToSale($consultantEmail, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $ccEmailString = '') {
    global $conn;
    
    // Fetch additional fields (email, type) from DB to display completely
    $email = '';
    $type = '';
    $stmt = $conn->prepare("SELECT email, type FROM leads WHERE phone = ?");
    if ($stmt) {
        $stmt->bind_param("s", $leadPhone);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $email = $row['email'] ?? '';
            $type = $row['type'] ?? '';
        }
    }
    
    $subject = "DOMATION - Bạn có 1 Data mới được phân bổ!";
    
    // Format values nicely for HTML, converting newlines (\n) to <br/> tags
    $formattedNote = !empty($leadNote) ? nl2br(htmlspecialchars($leadNote)) : '<em>Không có ghi chú</em>';
    $formattedSource = !empty($leadSource) ? nl2br(htmlspecialchars($leadSource)) : '<em>Không có</em>';
    $formattedType = !empty($type) ? nl2br(htmlspecialchars($type)) : '<em>Không có</em>';
    $formattedEmail = !empty($email) ? htmlspecialchars($email) : '<em>Không có</em>';
    
    $content = '
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
            Chào <strong>' . htmlspecialchars($consultantName) . '</strong>,<br><br>
            Hệ thống vừa phân bổ tự động cho bạn 1 khách hàng mới từ chiến dịch Inbound.
        </p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #7c3aed; padding: 24px; margin: 30px 0; border-radius: 0 12px 12px 0;">
            <p style="color: #0f172a; font-size: 16px; margin: 0 0 15px 0; font-weight: bold; line-height: 1.6; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                Thông tin chi tiết Khách hàng:
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.6; color: #334155;">
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; width: 140px; vertical-align: top; color: #64748b;">Họ và Tên:</td>
                    <td style="padding: 6px 0; font-weight: 700; color: #0f172a; vertical-align: top;">' . htmlspecialchars($leadName) . '</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Số điện thoại:</td>
                    <td style="padding: 6px 0; font-weight: 700; color: #2563eb; vertical-align: top;">' . htmlspecialchars($leadPhone) . '</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Email:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . $formattedEmail . '</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Nguồn Data:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . $formattedSource . '</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Loại Data:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . $formattedType . '</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Ghi chú / Khác:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top; line-height: 1.5;">' . $formattedNote . '</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Trạng thái:</td>
                    <td style="padding: 6px 0; font-weight: 700; color: #ef4444; vertical-align: top;">Chưa tư vấn</td>
                </tr>
            </table>
        </div>
        
        <p style="color: #64748b; font-size: 15px; line-height: 1.7;">
            Vui lòng nhanh chóng liên hệ với khách hàng để đảm bảo tỷ lệ chốt Sales cao nhất nhé!
        </p>
        
        <div style="text-align: center; margin-top: 40px;">
            <a href="https://open.domation.net/sale_data/" target="_blank" style="background-color: #7c3aed; background-image: linear-gradient(to right, #7c3aed, #4f46e5); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(124,58,237,0.3);">
                Đăng nhập CRM
            </a>
        </div>
    ';
    
    sendEmailNotification($consultantEmail, $subject, "Có Data Mới Về!", $content, $ccEmailString);
}

