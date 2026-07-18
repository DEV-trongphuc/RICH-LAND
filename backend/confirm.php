<?php
require_once 'db_connect.php';

$token = $_GET['token'] ?? '';

if (empty($token)) {
    die("Token không hợp lệ.");
}

// 1. Kiểm tra token có hợp lệ không trong bảng accounts
$stmt = $conn->prepare("SELECT id, name, email FROM accounts WHERE confirm_token = ? LIMIT 1");
$stmt->bind_param("s", $token);
$stmt->execute();
$res = $stmt->get_result();
$stmt->close();

if ($res->num_rows === 0) {
    die("Token không tồn tại hoặc đã hết hạn xác thực.");
}

$admin = $res->fetch_assoc();
$error = '';
$success = false;
$frontendUrl = './';

// 2. Xử lý POST khi người dùng lưu mật khẩu mới
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = $_POST['password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';

    if (strlen($password) < 6) {
        $error = "Mật khẩu mới phải dài tối thiểu 6 ký tự.";
    } elseif ($password !== $confirm_password) {
        $error = "Xác nhận mật khẩu mới không khớp.";
    } else {
        // Mã hóa mật khẩu mới theo chuẩn PASSWORD_DEFAULT tương thích hệ thống
        $hash = password_hash($password, PASSWORD_DEFAULT);
        
        // Kích hoạt tài khoản, cập nhật hash mật khẩu và xóa token
        $updateStmt = $conn->prepare("UPDATE accounts SET is_confirmed = 1, password_hash = ?, confirm_token = NULL WHERE id = ?");
        $updateStmt->bind_param("si", $hash, $admin['id']);
        $dbSuccess = $updateStmt->execute();
        $updateStmt->close();

        if ($dbSuccess) {
            $success = true;

            // Lấy thông tin link trang chủ và link zalo bot
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

            // Gửi Zalo Welcome Email tự động nếu có cấu hình Bot Link
            if (!empty($botLink)) {
                require_once 'mailer.php';
                sendWelcomeEmailToAdminTicket($admin['id'], $admin['email'] ?? '', $admin['name'], $botLink, true);
            }
        } else {
            $error = "Lỗi hệ thống khi cập nhật dữ liệu. Vui lòng thử lại.";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $success ? "Kích Hoạt Tài Khoản Thành Công" : "Đổi Mật Khẩu & Kích Hoạt Tài Khoản"; ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --color-brand-red: #BD1D2D;
            --color-brand-dark: #8C111E;
            --color-text-dark: #0f172a;
            --color-text-muted: #64748b;
            --color-bg: #f8fafc;
            --color-border: #e2e8f0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background-color: var(--color-bg);
            color: var(--color-text-dark);
            padding: 20px;
            box-sizing: border-box;
        }

        .card {
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            border: 1px solid var(--color-border);
            max-width: 440px;
            width: 100%;
            overflow: hidden;
            transition: all 0.3s ease;
        }

        .header {
            background: linear-gradient(135deg, var(--color-brand-red) 0%, var(--color-brand-dark) 100%);
            padding: 32px 24px;
            text-align: center;
            border-bottom: 4px solid var(--color-brand-red);
        }

        .header img {
            max-height: 48px;
            max-width: 220px;
            object-fit: contain;
            margin-bottom: 8px;
        }

        .header h2 {
            color: #ffffff;
            font-size: 1.1rem;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin: 0;
            font-weight: 700;
        }

        .content {
            padding: 32px 24px;
        }

        .success-icon {
            width: 60px;
            height: 60px;
            background: #d1fae5;
            color: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: bold;
            margin: 0 auto 20px;
        }

        .title {
            font-size: 1.5rem;
            font-weight: 700;
            text-align: center;
            margin: 0 0 10px 0;
            color: var(--color-text-dark);
        }

        .subtitle {
            font-size: 0.9rem;
            color: var(--color-text-muted);
            text-align: center;
            line-height: 1.5;
            margin: 0 0 24px 0;
        }

        .alert-error {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
            color: #b91c1c;
            padding: 12px;
            border-radius: 6px;
            font-size: 0.85rem;
            margin-bottom: 20px;
            font-weight: 500;
        }

        .form-group {
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
        }

        .form-group label {
            font-size: 0.85rem;
            font-weight: 600;
            color: #475569;
            margin-bottom: 6px;
        }

        .form-control {
            font-family: inherit;
            padding: 12px 14px;
            font-size: 0.95rem;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            outline: none;
            transition: all 0.2s ease;
        }

        .form-control:focus {
            border-color: var(--color-brand-red);
            box-shadow: 0 0 0 3px rgba(189, 29, 45, 0.15);
        }

        .btn-submit {
            font-family: inherit;
            background: linear-gradient(135deg, var(--color-brand-red) 0%, var(--color-brand-dark) 100%);
            color: #ffffff;
            border: none;
            padding: 14px;
            font-size: 0.95rem;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s ease;
            box-shadow: 0 4px 6px -1px rgba(189, 29, 45, 0.2);
            text-align: center;
            text-decoration: none;
            display: inline-block;
            box-sizing: border-box;
        }

        .btn-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 12px -1px rgba(189, 29, 45, 0.3);
            opacity: 0.95;
        }

        .btn-submit:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <img src="https://rich-land.vercel.app/imgs/logo-rich-land-viet-nam-trang.webp" alt="Rich Land Logo">
            <h2>Hệ Thống CRM</h2>
        </div>
        <div class="content">
            <?php if ($success): ?>
                <div class="success-icon">✓</div>
                <h1 class="title">Xác nhận thành công!</h1>
                <p class="subtitle">Chào mừng <strong><?php echo htmlspecialchars($admin['name']); ?></strong>! Tài khoản của bạn đã được xác nhận và cập nhật mật khẩu mới thành công.</p>
                <a href="<?php echo htmlspecialchars($frontendUrl); ?>" class="btn-submit">Đăng nhập vào CRM</a>
            <?php else: ?>
                <h1 class="title">Kích hoạt tài khoản</h1>
                <p class="subtitle">Xin chào <strong><?php echo htmlspecialchars($admin['name']); ?></strong>, vui lòng thiết lập mật khẩu mới bên dưới để hoàn tất việc xác nhận kích hoạt tài khoản.</p>

                <?php if (!empty($error)): ?>
                    <div class="alert-error">
                        <?php echo htmlspecialchars($error); ?>
                    </div>
                <?php endif; ?>

                <form method="POST" action="confirm.php?token=<?php echo urlencode($token); ?>" onsubmit="return validateForm()">
                    <div class="form-group">
                        <label for="password">Mật khẩu mới</label>
                        <input type="password" id="password" name="password" class="form-control" placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label for="confirm_password">Xác nhận mật khẩu mới</label>
                        <input type="password" id="confirm_password" name="confirm_password" class="form-control" placeholder="Nhập lại mật khẩu mới" required minlength="6">
                    </div>
                    <button type="submit" class="btn-submit">Kích hoạt tài khoản</button>
                </form>
            <?php endif; ?>
        </div>
    </div>

    <script>
        function validateForm() {
            var password = document.getElementById("password").value;
            var confirmPassword = document.getElementById("confirm_password").value;
            if (password.length < 6) {
                alert("Mật khẩu phải dài tối thiểu 6 ký tự.");
                return false;
            }
            if (password !== confirmPassword) {
                alert("Xác nhận mật khẩu không khớp.");
                return false;
            }
            return true;
        }
    </script>
</body>
</html>
