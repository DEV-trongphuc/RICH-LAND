<?php
// mailer.php

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function _getBaseHtml($title, $subtitle, $contentHtml)
{
    $headerSub = !empty($title) ? mb_strtoupper($title, 'UTF-8') : 'DATA ROUTING ENGINE';

    return '
    <div style="background-color: #f8fafc; padding: 40px 0; font-family: \'Inter\', Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #eab308, #ea580c); padding: 40px 20px; text-align: center;">
                <div style="margin-bottom: 16px; text-align: center;">
                    <div style="display: inline-block; background: rgba(255,255,255,0.25); border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; vertical-align: middle;">
                        <img src="https://open.domation.net/sale_data/Compress_ICON.png" alt="Domation Logo" style="width: 32px; height: 32px; vertical-align: middle; display: inline-block; border-radius: 50%;" />
                    </div>
                </div>
                <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 900; letter-spacing: 2px; text-align: center;">DOMATION</h1>
                <p style="color: rgba(255,255,255,0.95); font-size: 14px; margin: 8px 0 0; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; text-align: center;">' . $headerSub . '</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
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

function sendEmailNotification($to, $subject, $title, $content, $ccEmailString = '', $sync = false)
{
    global $conn;

    $htmlBody = _getBaseHtml($title, "", $content);

    if (!$sync) {
        // Xóa tính năng gửi đồng bộ để chống kẹt tiến trình (Bottleneck)
        // Thay vào đó, lưu vào bảng mail_queue để tiến trình ngầm (cron_mailer.php) xử lý
        $stmt = $conn->prepare("INSERT INTO mail_queue (to_email, cc_email, subject, body_html, status) VALUES (?, ?, ?, ?, 'pending')");
        if ($stmt) {
            $stmt->bind_param("ssss", $to, $ccEmailString, $subject, $htmlBody);
            $result = $stmt->execute();
            $stmt->close();
            return $result;
        }
        return false;
    }

    // --- SYNCHRONOUS SEND (For test_email ONLY) ---
    // Fetch settings globally using cached function to prevent N+1 queries
    $settings = get_system_setting($conn);
    $provider = $settings['email_provider'] ?? 'appscript';

    if ($provider === 'appscript') {
        $url = $settings['appscript_webhook_url'] ?? '';
        if (empty($url))
            return false;

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
        $result = curl_exec($ch);
        curl_close($ch);
        return true;
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
            $mail->Timeout = 15;

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
            return true;
        } catch (Exception $e) {
            error_log("Message could not be sent. Mailer Error: {$mail->ErrorInfo}");
            return false;
        }
    }
    return false;
}

function sendLeadReminderEmailToSale($consultantEmail, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '')
{
    $subject = "Khách hàng cũ đăng ký lại — " . $leadName;

    $fName = !empty($leadName) ? htmlspecialchars($leadName) : 'Không có';
    $fPhone = !empty($leadPhone) ? htmlspecialchars($leadPhone) : 'Không có';
    $fSource = !empty($leadSource) ? htmlspecialchars($leadSource) : 'Không có';
    $fNote = !empty($leadNote) ? nl2br(htmlspecialchars($leadNote)) : 'Không có';

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #e0e7ff; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">🔄</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Khách hàng đăng ký lại</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Chào <strong>' . htmlspecialchars($consultantName) . '</strong>, một khách hàng cũ của bạn vừa đăng ký lại trên hệ thống.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #0f172a; font-size: 15px; margin: 0 0 16px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">Thông tin khách hàng</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; width: 140px; color: #64748b;">Tên KH:</td>
                    <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">' . $fName . '</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Số điện thoại:</td>
                    <td style="padding: 8px 0; font-weight: 700; color: #3b82f6;">' . $fPhone . '</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Nguồn:</td>
                    <td style="padding: 8px 0;">' . $fSource . '</td>
                </tr>
            </table>
        </div>

        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px 24px; border-radius: 0 12px 12px 0; margin-bottom: 32px;">
            <p style="color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Ghi chú mới</p>
            <p style="color: #0f172a; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 500;">' . $fNote . '</p>
        </div>
        
        <div style="text-align: center;">
            <p style="color: #64748b; font-size: 14px; margin-bottom: 16px;">Vui lòng liên hệ lại với khách hàng sớm nhất có thể.</p>
        </div>
    ';

    sendEmailNotification($consultantEmail, $subject, '', $content, '');
}


function sendLeadAssignedEmailToSale($consultantEmail, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $ccEmailString = '', $roundName = '', $leadId = 0, $consultantId = 0, $roundId = 0)
{
    global $conn;

    // Fetch additional fields (email, type) from DB to display completely
    $email = '';
    $type = '';
    if ($leadId > 0) {
        $stmt = $conn->prepare("SELECT email, type FROM leads WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $leadId);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $email = $row['email'] ?? '';
                $type = $row['type'] ?? '';
            }
        }
    } else {
        // Fallback by phone if ID not provided
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
    }

    $roundStr = !empty($roundName) ? " vòng {$roundName}" : "";
    $subject = "Bạn vừa nhận được Lead {$leadName}{$roundStr}";

    // Format values nicely for HTML, converting newlines (\n) to <br/> tags
    $formattedNote = !empty($leadNote) ? nl2br(htmlspecialchars($leadNote)) : '<em>Không có ghi chú</em>';
    $formattedSource = !empty($leadSource) ? nl2br(htmlspecialchars($leadSource)) : '<em>Không có</em>';
    $formattedType = !empty($type) ? nl2br(htmlspecialchars($type)) : '<em>Không có</em>';
    $formattedEmail = !empty($email) ? htmlspecialchars($email) : '<em>Không có</em>';

    // BUG-02 fix: Build report URL dynamically from system_settings or server vars
    $frontendUrl = '';
    // 1. Try system_settings table first
    $urlSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key='frontend_url' LIMIT 1");
    if ($urlSetting && $urlSetting->num_rows > 0) {
        $frontendUrl = rtrim($urlSetting->fetch_assoc()['setting_value'], '/');
    }
    // 2. Fallback: construct from current server HTTP_HOST
    if (empty($frontendUrl)) {
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        // Strip /backend suffix to get root frontend URL
        $frontendUrl = $proto . '://' . preg_replace('/\/backend.*$/', '', $host);
    }
    $reportUrl = $frontendUrl . "/report-data?lead_id={$leadId}&sale_id={$consultantId}&round_id={$roundId}";

    $content = '
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
            Chào <strong>' . htmlspecialchars($consultantName) . '</strong>,<br><br>
            Hệ thống vừa phân bổ tự động cho bạn 1 khách hàng mới từ chiến dịch Inbound.
        </p>
        
        <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 24px; margin: 30px 0; border-radius: 0 12px 12px 0;">
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
                    <td style="padding: 6px 0; font-weight: 700; color: #d97706; vertical-align: top;">' . htmlspecialchars($leadPhone) . '</td>
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

            </table>
        </div>


        <div style="text-align: center; margin-bottom: 32px;">
            <p style="color: #64748b; font-size: 14px; margin-bottom: 12px; font-weight: 500;">Quét mã QR bằng điện thoại để gọi nhanh</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=tel:' . urlencode($leadPhone) . '" alt="QR Call" style="border-radius: 12px; border: 1px solid #e2e8f0; padding: 6px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);" width="130" height="130" />
        </div>

        <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px dashed #cbd5e1;">
            <p style="color: #64748b; font-size: 14px; margin-bottom: 12px;">Nếu Data này bị sai SĐT, Spam hoặc trùng lặp, vui lòng nhấn nút bên dưới để báo cáo và nhận Data bù.</p>
            <a href="' . $reportUrl . '" style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 7px 22px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
                BÁO CÁO DATA
            </a>
        </div>
    ';

    sendEmailNotification($consultantEmail, $subject, "Có Data Mới Về!", $content, $ccEmailString);
}


/**
 * sendTicketNotificationToAdmins
 * Gui email thong bao cho admin khi sale bao cao data loi (Ticket)
 */
function sendTicketNotificationToAdmins(
    string $toEmail,
    string $toAdminName,
    string $leadName,
    string $leadPhone,
    string $reason,
    string $consultantName,
    string $roundName = '',
    string $ccEmailString = ''
) {
    $subject = '🎫 Ticket Mới: Sale BÁO CÁO DATA — ' . $leadName;
    $roundStr = !empty($roundName) ? htmlspecialchars($roundName) : 'Không rõ';
    $fReason = nl2br(htmlspecialchars($reason));
    $fConsult = htmlspecialchars($consultantName ?: 'Không rõ');
    $fLead = htmlspecialchars($leadName ?: 'Khách hàng ẩn danh');
    $fPhone = htmlspecialchars($leadPhone ?: 'Không có');
    $fAdmin = htmlspecialchars($toAdminName);

    $content = '<p style="color:#475569;font-size:16px;line-height:1.7;margin-bottom:24px;">Xin chào <strong>' . $fAdmin . '</strong>,<br><br>Một nhân viên tư vấn vừa gửi <strong>BÁO CÁO DATA</strong> (Ticket) và cần bạn xem xét.</p><div style="text-align:center;margin-bottom:28px;"><span style="display:inline-block;background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #f59e0b;color:#92400e;padding:8px 22px;border-radius:20px;font-size:13px;font-weight:700;">TICKET CHỜ DUYỆT</span></div><div style="background:linear-gradient(135deg,#fefce8,#fffbeb);border-left:4px solid #eab308;padding:24px;margin:0 0 24px;border-radius:0 12px 12px 0;"><p style="color:#0f172a;font-size:15px;margin:0 0 16px;font-weight:700;border-bottom:1px solid #fde68a;padding-bottom:10px;">Chi tiết Ticket</p><table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;"><tr><td style="padding:7px 0;font-weight:600;width:160px;color:#64748b;vertical-align:top;">Nhân viên báo cáo:</td><td style="padding:7px 0;font-weight:700;color:#7c3aed;vertical-align:top;">' . $fConsult . '</td></tr><tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Vòng phân bổ:</td><td style="padding:7px 0;color:#0f172a;vertical-align:top;">' . $roundStr . '</td></tr><tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Tên khách hàng:</td><td style="padding:7px 0;font-weight:700;color:#0f172a;vertical-align:top;">' . $fLead . '</td></tr><tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Số điện thoại:</td><td style="padding:7px 0;font-weight:700;color:#d97706;vertical-align:top;">' . $fPhone . '</td></tr></table></div><div style="background:#fef2f2;border-left:4px solid #ef4444;padding:20px 24px;border-radius:0 12px 12px 0;margin-bottom:28px;"><p style="color:#991b1b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Lý do báo cáo</p><p style="color:#0f172a;font-size:15px;line-height:1.7;margin:0;font-weight:500;">' . $fReason . '</p></div><div style="text-align:center;"><p style="color:#64748b;font-size:14px;margin-bottom:12px;">Vui lòng đăng nhập hệ thống để xem xét và xử lý ticket này.</p><div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:12px 20px;display:inline-block;font-size:13px;color:#475569;">Vào mục <strong style="color:#7c3aed;">Quản lý Ticket</strong> để Duyệt hoặc Từ chối báo cáo</div></div>';

    sendEmailNotification($toEmail, $subject, '🎫 Có Ticket Mới Cần Xử Lý!', $content, $ccEmailString);
}

/**
 * sendWelcomeEmailToSale
 * Gui email chao mung va huong dan xac thuc Zalo Bot khi them Sale moi
 */
function sendWelcomeEmailToSale(
    int $consultantId,
    string $consultantEmail,
    string $consultantName,
    string $zaloBotLink,
    bool $sync = false
) {
    $subject = '🎉 Chào mừng bạn gia nhập Hệ thống Domation DATA';
    $fName = htmlspecialchars($consultantName ?: 'Bạn');

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #eff6ff; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">👋</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào mừng ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Tài khoản của bạn đã được thêm vào DATA ROUTING ENGINE.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Để có thể <strong>nhận thông báo ngay lập tức qua Zalo</strong> mỗi khi có Data mới được phân bổ cho bạn, vui lòng thực hiện xác thực Zalo Bot theo 2 bước đơn giản:
            </p>
            <ol style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Bấm vào nút <strong>"Xác thực Zalo Bot"</strong> bên dưới.</li>
                <li>Gửi tin nhắn cho Bot với mã số ID của bạn: <br/><strong style="color: #0068ff; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; letter-spacing: 0.5px; font-family: monospace; font-size: 16px;">' . $consultantId . '</strong></li>
                <li style="margin-top: 8px; font-size: 13px; color: #64748b; list-style-type: none; margin-left: -20px;"><em>(💡Chỉ cần copy mã ID ở trên và gửi thẳng cho Zalo Bot)</em></li>
            </ol>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
            <a href="' . htmlspecialchars($zaloBotLink) . '" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #0068ff, #005ce6); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 104, 255, 0.2), 0 2px 4px -1px rgba(0, 104, 255, 0.1);">
                BẤM VÀO ĐÂY ĐỂ XÁC THỰC ZALO
            </a>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 12px;">Hoặc copy link này: <br/><span style="color: #0068ff;">' . htmlspecialchars($zaloBotLink) . '</span></p>
        </div>
        
        <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0; padding-top: 16px; border-top: 1px dashed #cbd5e1;">
            Nếu bạn không hiểu yêu cầu này, vui lòng liên hệ Admin để được hỗ trợ.
        </p>
    ';

    sendEmailNotification($consultantEmail, $subject, '', $content, '', $sync);
}

/**
 * sendWelcomeEmailToAdminTicket
 * Gui email moi Admin xac thuc Zalo Bot khi ho duoc chon nhan thong bao Ticket
 */
function sendWelcomeEmailToAdminTicket(
    int $adminId,
    string $adminEmail,
    string $adminName,
    string $zaloBotLink,
    bool $sync = false
) {
    $subject = '🎫 Yêu cầu xác thực Zalo Bot';
    $fName = htmlspecialchars($adminName ?: 'Quản trị viên');

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #fffbeb; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">🛡️</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Bạn vừa được thiết lập để nhận thông báo từ hệ thống quản trị DOMATION.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Để có thể <strong>nhận thông báo tức thì qua Zalo</strong> (tin nhắn lỗi, cảnh báo, fallback data), vui lòng thực hiện xác thực Zalo Bot theo 2 bước đơn giản:
            </p>
            <ol style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Bấm vào nút <strong>"Xác thực Zalo Bot"</strong> bên dưới.</li>
                <li>Gửi tin nhắn cho Bot với mã xác thực của bạn: <br/><strong style="color: #d97706; background: #fef3c7; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; letter-spacing: 0.5px; font-family: monospace; font-size: 16px;">A' . $adminId . '</strong></li>
                <li style="margin-top: 8px; font-size: 13px; color: #64748b; list-style-type: none; margin-left: -20px;"><em>(💡Chỉ cần copy mã xác thực ở trên và gửi thẳng cho Zalo Bot)</em></li>
            </ol>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
            <a href="' . htmlspecialchars($zaloBotLink) . '" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #0068ff, #005ce6); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 104, 255, 0.2), 0 2px 4px -1px rgba(0, 104, 255, 0.1);">
                BẤM VÀO ĐÂY ĐỂ XÁC THỰC ZALO
            </a>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 12px;">Hoặc copy link này: <br/><span style="color: #0068ff;">' . htmlspecialchars($zaloBotLink) . '</span></p>
        </div>
    ';

    sendEmailNotification($adminEmail, $subject, '', $content, '', $sync);
}

/**
 * sendAdminConfirmationEmail
 */
function sendAdminConfirmationEmail(
    string $adminEmail,
    string $adminName,
    string $confirmLink
) {
    $subject = 'Vui lòng xác nhận Email để kích hoạt tài khoản Admin';
    $fName = htmlspecialchars($adminName ?: 'Quản trị viên');

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #ecfdf5; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">✉️</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Tài khoản Admin của bạn đã được tạo trên hệ thống Domation DATA.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Vui lòng click vào nút bên dưới để xác nhận địa chỉ Email của bạn:
            </p>
            <a href="' . htmlspecialchars($confirmLink) . '" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #0f172a, #334155); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">
                XÁC NHẬN EMAIL
            </a>
        </div>
    ';

    sendEmailNotification($adminEmail, $subject, '', $content, '', true);
}

/**
 * sendAdminAddedToTicketEmail
 */
function sendAdminAddedToTicketEmail(
    string $adminEmail,
    string $adminName
) {
    $subject = 'Bạn đã được thêm quyền xử lý Ticket';
    $fName = htmlspecialchars($adminName ?: 'Quản trị viên');

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #fffbeb; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">🎫</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Bạn vừa được cấp quyền xử lý Báo cáo lỗi (Ticket) từ hệ thống.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
                Từ bây giờ, hệ thống sẽ gửi thông báo mỗi khi có Ticket mới chờ duyệt tới Email và Zalo Bot của bạn.
            </p>
        </div>
    ';

    sendEmailNotification($adminEmail, $subject, 'Phân quyền Ticket', $content, '');
}

/**
 * sendQuickMessageEmailToSale
 */
function sendQuickMessageEmailToSale(
    string $consultantEmail,
    string $consultantName,
    string $message
) {
    $subject = 'Tin nhắn từ Quản trị viên';
    $fName = htmlspecialchars($consultantName ?: 'Tư vấn viên');
    $safeMsg = nl2br(htmlspecialchars($message));

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #e0e7ff; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">💬</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Bạn có một tin nhắn mới từ Quản trị viên.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: left;">
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
                ' . $safeMsg . '
            </p>
        </div>
    ';

    sendEmailNotification($consultantEmail, $subject, '', $content, '');
}

/**
 * sendDailyReportEmailToAdmins
 */
function sendDailyReportEmailToAdmins(
    string $adminEmail,
    string $adminName,
    int $totalData,
    string $saleStatsHtml,
    int $totalTicket
) {
    $subject = 'Báo cáo Tổng kết Ngày - ' . date('d/m/Y');
    $fName = htmlspecialchars($adminName ?: 'Quản trị viên');

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #fef08a; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">📊</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Dưới đây là Báo cáo tổng kết ngày hôm nay của hệ thống Domation DATA.</p>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <div style="padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0; color: #0f172a; font-size: 16px;">Phân bổ Data mới (' . $totalData . ')</h3>
            </div>
            <div style="padding: 20px;">
                <ul style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.6;">
                    ' . $saleStatsHtml . '
                </ul>
            </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <div style="padding: 16px 20px; background: #fff1f2; border-bottom: 1px solid #ffe4e6;">
                <h3 style="margin: 0; color: #9f1239; font-size: 16px;">Báo cáo lỗi / Ticket mới (' . $totalTicket . ')</h3>
            </div>
            <div style="padding: 20px;">
                <p style="margin: 0; color: #334155;">Hôm nay hệ thống ghi nhận có <strong>' . $totalTicket . '</strong> Ticket báo lỗi cần được xử lý.</p>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
            <a href="https://' . ($_SERVER['HTTP_HOST'] ?? '') . '/" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0068ff; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">
                TRUY CẬP HỆ THỐNG
            </a>
        </div>
    ';

    sendEmailNotification($adminEmail, $subject, 'Báo Cáo Hàng Ngày', $content, '');
}

function sendCompensationAddedEmailToSale($consultantEmail, $consultantName, $roundName, $amount) {
    if (empty($consultantEmail)) return;

    $subject = "[Domation DATA] Thông báo Bù Data - Vòng: $roundName";
    $title = "BẠN VỪA ĐƯỢC BÙ DATA";
    
    $content = '
        <div style="background: #e0e7ff; padding: 12px; border-radius: 8px; border-left: 4px solid #4f46e5; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #3730a3;"><strong>THÔNG BÁO TỪ QUẢN TRỊ VIÊN</strong></p>
            <p style="margin: 8px 0 0 0; font-size: 15px; color: #1e1b4b;">
                Xin chào <strong>' . htmlspecialchars($consultantName) . '</strong>,
            </p>
            <p style="margin: 8px 0 0 0; font-size: 15px; color: #1e1b4b;">
                Quản trị viên vừa cập nhật bù thêm <strong>' . (int)$amount . ' data</strong> cho bạn tại vòng: <strong>' . htmlspecialchars($roundName) . '</strong>.
            </p>
            <p style="margin: 8px 0 0 0; font-size: 15px; color: #1e1b4b;">
                Khi hệ thống nhận được khách hàng mới thỏa mãn điều kiện của vòng này, data sẽ được ưu tiên phân bổ thêm cho bạn để bù lại số lượng trên.
            </p>
        </div>
    ';

    sendEmailNotification($consultantEmail, $subject, $title, $content, '');
}