<?php
require_once 'db_connect.php';

$token = $_GET['token'] ?? '';

if (empty($token)) {
    die("Token không hợp lệ.");
}

$stmt = $conn->prepare("SELECT id, name, email FROM accounts WHERE confirm_token = ? LIMIT 1");
$stmt->bind_param("s", $token);
$stmt->execute();
$res = $stmt->get_result();
$stmt->close();

if ($res->num_rows > 0) {
    $admin = $res->fetch_assoc();
    $updateStmt = $conn->prepare("UPDATE accounts SET is_confirmed = 1, confirm_token = NULL WHERE id = ?");
    $updateStmt->bind_param("i", $admin['id']);
    $success = $updateStmt->execute();
    $updateStmt->close();
    
    if ($success) {
        // Fetch settings
        $frontendUrl = './';
        $botLink = '';
        $settingsRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('frontend_url', 'zalo_bot_link')");
        if ($settingsRes) {
            while ($row = $settingsRes->fetch_assoc()) {
                if ($row['setting_key'] === 'frontend_url' && !empty($row['setting_value'])) {
                    $frontendUrl = rtrim($row['setting_value'], '/');
                }
                if ($row['setting_key'] === 'zalo_bot_link') {
                    $botLink = $row['setting_value'];
                }
            }
        }

        // Send Zalo Active Email immediately
        if (!empty($botLink)) {
            require_once 'mailer.php';
            sendWelcomeEmailToAdminTicket($admin['id'], $admin['email'] ?? '', $admin['name'], $botLink, true);
        }

        echo '<!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Xác nhận Email Thành Công</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155; }
                .container { background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; width: 100%; }
                .icon { width: 64px; height: 64px; background: #d1fae5; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 32px; color: #10b981; }
                h1 { margin: 0 0 10px; font-size: 24px; color: #0f172a; }
                p { margin: 0 0 24px; line-height: 1.5; color: #64748b; }
                a { display: inline-block; background: #0068ff; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; transition: background 0.2s; }
                a:hover { background: #005ce6; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✓</div>
                <h1>Xác nhận thành công!</h1>
                <p>Cảm ơn ' . htmlspecialchars($admin['name']) . '. Email của bạn đã được xác nhận. Bạn có thể đăng nhập vào CRM ngay bây giờ.</p>';
        
        $p = $_GET['p'] ?? '';
        if (!empty($p)) {
            $defaultPassword = base64_decode($p);
            echo '<div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: left;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">Mật khẩu mặc định của bạn là:</p>
                    <div style="font-size: 18px; font-family: monospace; font-weight: 700; color: #0f172a; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; margin-bottom: 12px;">' . htmlspecialchars($defaultPassword) . '</div>
                    <p style="margin: 0; font-size: 13px; color: #ef4444; font-weight: 600; text-align: center;">⚠ Vui lòng đổi mật khẩu ngay sau khi đăng nhập!</p>
                  </div>';
        }

        echo '  <a href="' . htmlspecialchars($frontendUrl) . '">Về trang Đăng nhập</a>
            </div>
        </body>
        </html>';
    } else {
        die("Lỗi khi cập nhật dữ liệu.");
    }
} else {
    die("Token không tồn tại hoặc đã được sử dụng.");
}

$conn->close();
?>
