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

function sendLeadReminderEmailToSale($consultantEmail, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $ccEmailString = '', $roundName = '', $timeline = [], $leadId = 0)
{
    global $conn;

    $subject = "Khách hàng cũ đăng ký lại — " . $leadName;

    $fName = !empty($leadName) ? htmlspecialchars($leadName) : 'Không có';
    $fPhone = !empty($leadPhone) ? htmlspecialchars($leadPhone) : 'Không có';
    $fSource = !empty($leadSource) ? htmlspecialchars($leadSource) : 'Không có';
    $fRound = !empty($roundName) ? htmlspecialchars($roundName) : '';

    // Fetch additional fields (email, type) from DB to display completely
    $email = '';
    $type = '';
    if ($leadId > 0) {
        $stmt = $conn->prepare("SELECT email, type FROM leads WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $leadId);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $email = $row['email'] ?? '';
                $type = $row['type'] ?? '';
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
                $email = $row['email'] ?? '';
                $type = $row['type'] ?? '';
            }
            $stmt->close();
        }
    }

    // Parse leadNote for custom key-value fields
    $actualNote = '';
    $customFieldsHtml = '';
    if (!empty($leadNote)) {
        $normalizedNote = str_replace(["\r\n", "\r"], "\n", $leadNote);
        $lines = explode("\n", $normalizedNote);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;
            
            // Match custom fields key-value
            if ((preg_match('/^\[(.*?)\]:\s*(.*)$/', $line, $matches) || preg_match('/^(.*?):\s*(.*)$/', $line, $matches))
                && strlen(trim($matches[1])) <= 40 
                && !preg_match('/^(https?|ftp)$/i', trim($matches[1]))
            ) {
                $cKey = htmlspecialchars(trim($matches[1]));
                $cVal = htmlspecialchars(trim($matches[2]));
                $customFieldsHtml .= '
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b; vertical-align: top;">' . $cKey . ':</td>
                    <td style="padding: 8px 0; font-weight: 700; color: #0ea5e9; vertical-align: top;">' . $cVal . '</td>
                </tr>';
            } else {
                $actualNote .= htmlspecialchars($line) . '<br/>';
            }
        }
    }

    $roundRow = '';
    if (!empty($fRound)) {
        $roundRow = '
            <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #64748b; vertical-align: top;">Vòng:</td>
                <td style="padding: 8px 0; font-weight: 700; color: #0f172a; vertical-align: top;">' . $fRound . '</td>
            </tr>';
    }

    $historyBlock = '';
    if (!empty($timeline) && is_array($timeline)) {
        $historyBlock = '
            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #0f172a; font-size: 14px; margin: 0 0 12px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Lịch sử phân bổ gần nhất</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">';
        foreach ($timeline as $t) {
            $tRound = !empty($t['round_name']) ? ' | Vòng: ' . htmlspecialchars($t['round_name']) : '';
            $tSale = !empty($t['consultant_name']) ? ' | Sale: ' . htmlspecialchars($t['consultant_name']) : '';
            $historyBlock .= '
                <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 130px; vertical-align: top;">' . htmlspecialchars($t['received_at']) . '</td>
                    <td style="padding: 6px 0; vertical-align: top;">
                        <strong>' . htmlspecialchars($t['status']) . '</strong>' . $tRound . $tSale;
            if (!empty($t['message'])) {
                $historyBlock .= '<br/><span style="color: #64748b; font-size: 12px;">' . htmlspecialchars($t['message']) . '</span>';
            }
            $historyBlock .= '
                    </td>
                </tr>';
        }
        $historyBlock .= '
                </table>
            </div>';
    }

    $noteBlock = '';
    if (!empty(trim($actualNote))) {
        $noteBlock = '
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px 24px; border-radius: 0 12px 12px 0; margin-bottom: 32px;">
            <p style="color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Ghi chú mới</p>
            <p style="color: #0f172a; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 500;">' . $actualNote . '</p>
        </div>';
    }

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
                    <td style="padding: 8px 0; font-weight: 600; width: 140px; color: #64748b; vertical-align: top;">Tên KH:</td>
                    <td style="padding: 8px 0; font-weight: 700; color: #0f172a; vertical-align: top;">' . $fName . '</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b; vertical-align: top;">Số điện thoại:</td>
                    <td style="padding: 8px 0; font-weight: 700; color: #3b82f6; vertical-align: top;">' . $fPhone . '</td>
                </tr>
                ' . (!empty($email) ? '
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b; vertical-align: top;">Email:</td>
                    <td style="padding: 8px 0; font-weight: 700; color: #0f172a; vertical-align: top;">' . htmlspecialchars($email) . '</td>
                </tr>
                ' : '') . '
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b; vertical-align: top;">Nguồn:</td>
                    <td style="padding: 8px 0; color: #0f172a; vertical-align: top;">' . $fSource . '</td>
                </tr>
                ' . (!empty($type) && $type !== '-' ? '
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b; vertical-align: top;">Loại Data:</td>
                    <td style="padding: 8px 0; color: #0f172a; vertical-align: top;">' . htmlspecialchars($type) . '</td>
                </tr>
                ' : '') . 
                $roundRow . 
                $customFieldsHtml . '
            </table>
        </div>' . $historyBlock . 
        $noteBlock . '
        
        <div style="text-align: center;">
            <p style="color: #64748b; font-size: 14px; margin-bottom: 16px;">Vui lòng liên hệ lại với khách hàng sớm nhất có thể.</p>
        </div>
    ';

    sendEmailNotification($consultantEmail, $subject, '', $content, $ccEmailString);
}


function sendLeadAssignedEmailToSale($consultantEmail, $consultantName, $leadName, $leadPhone, $leadNote = '', $leadSource = '', $ccEmailString = '', $roundName = '', $leadId = 0, $consultantId = 0, $roundId = 0)
{
    global $conn;

    // Fetch additional fields (email, type, connection_id) from DB to display completely
    $email = '';
    $type = '';
    $connectionId = 0;
    if ($leadId > 0) {
        $stmt = $conn->prepare("SELECT email, type, connection_id FROM leads WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $leadId);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $email = $row['email'] ?? '';
                $type = $row['type'] ?? '';
                $connectionId = (int)($row['connection_id'] ?? 0);
            }
        }
    } else {
        // Fallback by phone if ID not provided
        $stmt = $conn->prepare("SELECT email, type, connection_id FROM leads WHERE phone = ?");
        if ($stmt) {
            $stmt->bind_param("s", $leadPhone);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $email = $row['email'] ?? '';
                $type = $row['type'] ?? '';
                $connectionId = (int)($row['connection_id'] ?? 0);
            }
        }
    }

    $emailTemplate = '';
    if ($connectionId > 0) {
        $stmtTpl = $conn->prepare("SELECT email_template FROM sheet_connections WHERE id = ?");
        if ($stmtTpl) {
            $stmtTpl->bind_param("i", $connectionId);
            $stmtTpl->execute();
            $resTpl = $stmtTpl->get_result();
            if ($resTpl->num_rows > 0) {
                $emailTemplate = $resTpl->fetch_assoc()['email_template'] ?? '';
            }
        }
    }

    $roundStr = !empty($roundName) ? " vòng {$roundName}" : "";
    $subject = "Bạn vừa nhận được Lead {$leadName}{$roundStr}";

    // Format values nicely for HTML, converting newlines (\n) to <br/> tags
    $formattedSource = !empty($leadSource) ? nl2br(htmlspecialchars($leadSource)) : '<em>Không có</em>';
    $formattedType = !empty($type) ? nl2br(htmlspecialchars($type)) : '<em>Không có</em>';
    $formattedEmail = !empty($email) ? htmlspecialchars($email) : '<em>Không có</em>';

    $detailBlock = '';
    if (!empty($emailTemplate)) {
        // Replace templates
        $replacements = [
            '{name}' => htmlspecialchars($leadName),
            '{phone}' => htmlspecialchars($leadPhone),
            '{email}' => htmlspecialchars($email),
            '{source}' => htmlspecialchars($leadSource),
            '{type}' => htmlspecialchars($type),
            '{assigned_to}' => htmlspecialchars($consultantName),
        ];

        $actualNote = '';
        if (!empty($leadNote)) {
            $lines = explode("\n", $leadNote);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line)) continue;
                
                $matchedPlaceholder = false;
                // Matches [Custom Key]: Value or Custom Key: Value
                if ((preg_match('/^\[(.*?)\]:\s*(.*)$/', $line, $matches) || preg_match('/^(.*?):\s*(.*)$/', $line, $matches))
                    && strlen(trim($matches[1])) <= 40
                    && !preg_match('/^(https?|ftp)$/i', trim($matches[1]))
                ) {
                    $cKey = trim($matches[1]);
                    $cVal = trim($matches[2]);
                    $lowerKey = strtolower($cKey);
                    
                    // Only treat as placeholder if it is actually used in the custom template
                    if (strpos(strtolower($emailTemplate), '{' . $lowerKey . '}') !== false) {
                        $replacements['{' . $lowerKey . '}'] = htmlspecialchars($cVal);
                        $replacements['{' . $cKey . '}'] = htmlspecialchars($cVal);
                        $matchedPlaceholder = true;
                    }
                }
                
                if (!$matchedPlaceholder) {
                    $actualNote .= htmlspecialchars($line) . "\n";
                }
            }
        }
        $replacements['{note}'] = nl2br(trim($actualNote));

        $renderedTemplate = $emailTemplate;
        // Auto-append {source} if not present in custom template to ensure consistency
        if (strpos(strtolower($renderedTemplate), '{source}') === false && !empty($leadSource)) {
            if (preg_match('/- Ghi Chú:/i', $renderedTemplate)) {
                $renderedTemplate = preg_replace('/(- Ghi Chú:)/i', "- Nguồn Data: {source}\n$1", $renderedTemplate);
            } else {
                $renderedTemplate .= "\n- Nguồn Data: {source}";
            }
        }
        foreach ($replacements as $placeholder => $value) {
            $renderedTemplate = str_replace($placeholder, $value, $renderedTemplate);
        }
        // Remove empty placeholders
        $renderedTemplate = preg_replace('/\{[a-zA-Z0-9_-]+\}/', '', $renderedTemplate);

        $detailBlock = '<div style="font-size: 15px; line-height: 1.6; color: #334155;">' . nl2br($renderedTemplate) . '</div>';
    } else {
        // Fallback to table representation (original default)
        $actualNote = '';
        $customFieldsHtml = '';
        if (!empty($leadNote)) {
            $lines = explode("\n", $leadNote);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line)) continue;
                // Matches [Custom Key]: Value
                if (preg_match('/^\[(.*?)\]:\s*(.*)$/', $line, $matches)) {
                    $cKey = htmlspecialchars(trim($matches[1]));
                    $cVal = htmlspecialchars(trim($matches[2]));
                    $customFieldsHtml .= '
                    <tr>
                        <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">' . $cKey . ':</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0ea5e9; vertical-align: top;">' . $cVal . '</td>
                    </tr>';
                } else {
                    $actualNote .= htmlspecialchars($line) . '<br/>';
                }
            }
        }

        $detailBlock = '
            <table style="width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.6; color: #334155;">
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; width: 140px; vertical-align: top; color: #64748b;">Họ và Tên:</td>
                    <td style="padding: 6px 0; font-weight: 700; color: #0f172a; vertical-align: top;">' . htmlspecialchars($leadName) . '</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Số điện thoại:</td>
                    <td style="padding: 6px 0; font-weight: 700; color: #d97706; vertical-align: top;">' . htmlspecialchars($leadPhone) . '</td>
                </tr>
                ' . (!empty($email) ? '
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Email:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . htmlspecialchars($email) . '</td>
                </tr>
                ' : '') . '
                ' . (!empty($leadSource) ? '
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Nguồn Data:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . nl2br(htmlspecialchars($leadSource)) . '</td>
                </tr>
                ' : '') . '
                ' . (!empty($type) ? '
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Loại Data:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . nl2br(htmlspecialchars($type)) . '</td>
                </tr>
                ' : '') . '
                ' . (!empty($actualNote) ? '
                <tr>
                    <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Ghi chú / Khác:</td>
                    <td style="padding: 6px 0; color: #0f172a; vertical-align: top; line-height: 1.5;">' . $actualNote . '</td>
                </tr>
                ' : '') . 
                $customFieldsHtml . '
            </table>';
    }

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
    $portalUrl = $frontendUrl . "/sale-portal";

    $content = '
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
            Chào <strong>' . htmlspecialchars($consultantName) . '</strong>,<br><br>
            Hệ thống vừa phân bổ tự động cho bạn 1 khách hàng mới từ ' . (!empty($roundName) ? 'vòng ' . htmlspecialchars($roundName) : 'chiến dịch Inbound') . '.
        </p>
        
        <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 24px; margin: 30px 0; border-radius: 0 12px 12px 0;">
            <p style="color: #0f172a; font-size: 16px; margin: 0 0 15px 0; font-weight: bold; line-height: 1.6; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                Thông tin chi tiết Khách hàng:
            </p>
            ' . $detailBlock . '
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
        </div>

        <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px dashed #cbd5e1; padding-bottom: 24px; border-bottom: 1px dashed #cbd5e1;">
            <p style="color: #64748b; font-size: 14px; margin-bottom: 12px;">Xem danh sách dữ liệu và báo cáo hiệu suất của bạn tại Trang Tư vấn viên:</p>
            <a href="' . $portalUrl . '" style="display: inline-block; background-color: #4f46e5; color: white; text-decoration: none; padding: 9px 24px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); margin-bottom: 8px;">
                TRANG XEM DATA CỦA BẠN
            </a>
        </div>

        <div style="text-align: center; margin-top: 24px;">
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
    string $ccEmailString = '',
    string $leadEmail = '',
    string $leadSource = '',
    string $leadType = '',
    string $leadNote = ''
) {
    $subject = '🎫 Ticket Mới: Sale BÁO CÁO DATA — ' . $leadName;
    $roundStr = !empty($roundName) ? htmlspecialchars($roundName) : 'Không rõ';
    $fReason = nl2br(htmlspecialchars($reason));
    $fConsult = htmlspecialchars($consultantName ?: 'Không rõ');
    $fLead = htmlspecialchars($leadName ?: 'Khách hàng ẩn danh');
    $fPhone = htmlspecialchars($leadPhone ?: 'Không có');
    $fAdmin = htmlspecialchars($toAdminName);
    $fEmail = htmlspecialchars($leadEmail ?: 'Không có');
    $fSource = htmlspecialchars($leadSource ?: 'Không có');
    $fType = htmlspecialchars($leadType ?: 'Không có');
    $fNote = nl2br(htmlspecialchars($leadNote ?: 'Không có'));

    $content = '<p style="color:#475569;font-size:16px;line-height:1.7;margin-bottom:24px;">Xin chào <strong>' . $fAdmin . '</strong>,<br><br>Một nhân viên tư vấn vừa gửi <strong>BÁO CÁO DATA</strong> (Ticket) và cần bạn xem xét.</p>'
        . '<div style="text-align:center;margin-bottom:28px;"><span style="display:inline-block;background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #f59e0b;color:#92400e;padding:8px 22px;border-radius:20px;font-size:13px;font-weight:700;">TICKET CHỜ DUYỆT</span></div>'
        . '<div style="background:linear-gradient(135deg,#fefce8,#fffbeb);border-left:4px solid #eab308;padding:24px;margin:0 0 24px;border-radius:0 12px 12px 0;">'
        . '<p style="color:#0f172a;font-size:15px;margin:0 0 16px;font-weight:700;border-bottom:1px solid #fde68a;padding-bottom:10px;">Chi tiết Ticket</p>'
        . '<table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">'
        . '<tr><td style="padding:7px 0;font-weight:600;width:160px;color:#64748b;vertical-align:top;">Nhân viên báo cáo:</td><td style="padding:7px 0;font-weight:700;color:#7c3aed;vertical-align:top;">' . $fConsult . '</td></tr>'
        . '<tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Vòng phân bổ:</td><td style="padding:7px 0;color:#0f172a;vertical-align:top;">' . $roundStr . '</td></tr>'
        . '<tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Tên khách hàng:</td><td style="padding:7px 0;font-weight:700;color:#0f172a;vertical-align:top;">' . $fLead . '</td></tr>'
        . '<tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Số điện thoại:</td><td style="padding:7px 0;font-weight:700;color:#d97706;vertical-align:top;">' . $fPhone . '</td></tr>'
        . '<tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Email khách hàng:</td><td style="padding:7px 0;color:#0f172a;vertical-align:top;">' . $fEmail . '</td></tr>'
        . '<tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Nguồn Data:</td><td style="padding:7px 0;color:#0f172a;vertical-align:top;">' . $fSource . '</td></tr>'
        . '<tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Loại Data:</td><td style="padding:7px 0;color:#0f172a;vertical-align:top;">' . $fType . '</td></tr>'
        . '<tr><td style="padding:7px 0;font-weight:600;color:#64748b;vertical-align:top;">Ghi Chú:</td><td style="padding:7px 0;color:#0f172a;vertical-align:top;line-height:1.5;">' . $fNote . '</td></tr>'
        . '</table>'
        . '</div>'
        . '<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:20px 24px;border-radius:0 12px 12px 0;margin-bottom:28px;">'
        . '<p style="color:#991b1b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Lý do báo cáo</p>'
        . '<p style="color:#0f172a;font-size:15px;line-height:1.7;margin:0;font-weight:500;">' . $fReason . '</p>'
        . '</div>'
        . '<div style="text-align:center;">'
        . '<p style="color:#64748b;font-size:14px;margin-bottom:12px;">Vui lòng đăng nhập hệ thống để xem xét và xử lý ticket này.</p>'
        . '<div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:12px 20px;display:inline-block;font-size:13px;color:#475569;">Vào mục <strong style="color:#7c3aed;">Quản lý Ticket</strong> để Duyệt hoặc Từ chối báo cáo</div>'
        . '</div>';

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
    int $totalTicket,
    int $totalReminder = 0
) {
    global $conn;

    $subject = 'Báo cáo Tổng kết Ngày - ' . date('d/m/Y');
    $fName = htmlspecialchars($adminName ?: 'Quản trị viên');

    // Lấy frontend_url từ settings, tránh dùng HTTP_HOST (trỏ tới backend)
    $frontendUrl = '';
    if (isset($conn) && $conn) {
        $urlRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key='frontend_url' LIMIT 1");
        if ($urlRes && $urlRes->num_rows > 0) {
            $frontendUrl = rtrim($urlRes->fetch_assoc()['setting_value'], '/');
        }
    }
    if (empty($frontendUrl)) {
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $frontendUrl = $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    $titleSuffix = $totalData . ' data';
    if ($totalReminder > 0) {
        $titleSuffix = 'Tổng: ' . ($totalData + $totalReminder) . ' (Chia số: ' . $totalData . ', Nhắc lại: ' . $totalReminder . ')';
    }

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #fef08a; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">&#128202;</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Dưới đây là Báo cáo tổng kết ngày hôm nay của hệ thống Domation DATA.</p>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <div style="padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0; color: #0f172a; font-size: 16px;">Phân bổ Data mới (' . $titleSuffix . ')</h3>
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
            <a href="' . $frontendUrl . '/" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0068ff; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">
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

function sendWeeklyReportEmailToSale(
    string $saleEmail,
    string $saleName,
    int $totalData,
    string $roundDetailsHtml,
    int $totalTickets,
    int $approvedTickets,
    int $rejectedTickets,
    int $pendingTickets,
    int $totalCompReceived,
    int $totalCompOwed,
    string $windowStart,
    string $windowEnd
) {
    global $conn;

    $subject = '[Báo cáo tuần] Thống kê nhận data và ticket đền bù';
    $fName = htmlspecialchars($saleName ?: 'Tư vấn viên');

    $frontendUrl = '';
    if (isset($conn) && $conn) {
        $urlRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key='frontend_url' LIMIT 1");
        if ($urlRes && $urlRes->num_rows > 0) {
            $frontendUrl = rtrim($urlRes->fetch_assoc()['setting_value'], '/');
        }
    }
    if (empty($frontendUrl)) {
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $frontendUrl = $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    $content = '
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #e0e7ff; border-radius: 50%; display: inline-block; text-align: center; line-height: 64px; margin-bottom: 16px; vertical-align: middle;">
                <span style="font-size: 32px; line-height: 64px; vertical-align: middle;">📅</span>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Chào ' . $fName . '</h2>
            <p style="color: #64748b; font-size: 15px; margin: 0;">Dưới đây là báo cáo tổng kết hiệu suất của bạn từ <strong>' . $windowStart . '</strong> đến <strong>' . $windowEnd . '</strong>.</p>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <div style="padding: 16px 20px; background: #e0e7ff; border-bottom: 1px solid #c7d2fe;">
                <h3 style="margin: 0; color: #4338ca; font-size: 16px;">❖ Số Data Đã Nhận (' . $totalData . ')</h3>
            </div>
            <div style="padding: 20px;">
                <ul style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.6;">
                    ' . $roundDetailsHtml . '
                </ul>
            </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <div style="padding: 16px 20px; background: #f0fdf4; border-bottom: 1px solid #bbf7d0;">
                <h3 style="margin: 0; color: #166534; font-size: 16px;">❖ Báo Cáo Lỗi</h3>
            </div>
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse; color: #334155; line-height: 1.6;">
                    <tr>
                        <td style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">Tổng số ticket đã tạo:</td>
                        <td style="padding: 6px 0; font-weight: bold; text-align: right; border-bottom: 1px solid #f1f5f9;">' . $totalTickets . '</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">Thành công (Được duyệt):</td>
                        <td style="padding: 6px 0; font-weight: bold; color: #16a34a; text-align: right; border-bottom: 1px solid #f1f5f9;">' . $approvedTickets . '</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">Thất bại (Từ chối):</td>
                        <td style="padding: 6px 0; font-weight: bold; color: #dc2626; text-align: right; border-bottom: 1px solid #f1f5f9;">' . $rejectedTickets . '</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0;">Chờ duyệt:</td>
                        <td style="padding: 6px 0; font-weight: bold; color: #d97706; text-align: right;">' . $pendingTickets . '</td>
                    </tr>
                </table>
            </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <div style="padding: 16px 20px; background: #fffbeb; border-bottom: 1px solid #fef3c7;">
                <h3 style="margin: 0; color: #b45309; font-size: 16px;">❖ Thông Tin Đền Bù</h3>
            </div>
            <div style="padding: 20px;">
                <ul style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.6;">
                    <li>Số lượt đã đền bù trong tuần này: <strong>' . $totalCompReceived . '</strong> lượt</li>
                    <li>Số lượt hiện đang chờ đền bù tiếp theo: <strong>' . $totalCompOwed . '</strong> lượt</li>
                </ul>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
            <a href="' . $frontendUrl . '/sale-portal" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                TRUY CẬP TRANG NHẬN DATA & BÁO LỖI
            </a>
        </div>
    ';

    return sendEmailNotification($saleEmail, $subject, '[ BÁO CÁO TỔNG KẾT TUẦN ]', $content, '', false);
}