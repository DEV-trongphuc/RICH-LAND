<?php
// backend/controllers/AuthController.php

class AuthController {
    private PDO $db;

    public function __construct(PDO $db) { $this->db = $db; }

    private function validatePasswordStrength(string $password): ?string {
        if (strlen($password) < 6) {
            return 'Mật khẩu phải có ít nhất 6 ký tự';
        }
        if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
            return 'Mật khẩu phải bao gồm cả chữ cái và chữ số';
        }
        return null;
    }

    public function login(): void {
        $body = getBody();
        $account  = trim($body['email'] ?? $body['username'] ?? $body['account'] ?? '');
        $password = trim($body['password'] ?? '');

        if (!$account || !$password) respond(422, null, 'Email / Tên đăng nhập và mật khẩu là bắt buộc', false);

        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        
        // 1. Brute force check: Limit to 10 failed attempts per 15 mins per IP
        $stmtLimit = $this->db->prepare("
            SELECT COUNT(*) FROM login_attempts 
            WHERE ip_address = ? AND is_successful = 0 AND attempt_time > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        ");
        $stmtLimit->execute([$ip]);
        if ((int)$stmtLimit->fetchColumn() >= 10) {
            respond(429, null, 'Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng quay lại sau 15 phút.', false);
        }

        $stmt = $this->db->prepare(
            'SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.logo_url as tenant_logo
             FROM users u JOIN tenants t ON u.tenant_id = t.id
             WHERE (LOWER(TRIM(u.email)) = LOWER(?) OR LOWER(TRIM(u.username)) = LOWER(?)) 
               AND u.is_active = 1 AND t.is_active = 1 LIMIT 1'
        );
        $stmt->execute([$account, $account]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            // Record failed attempt
            $this->db->prepare("INSERT INTO login_attempts (ip_address, email, is_successful) VALUES (?, ?, 0)")
                 ->execute([$ip, $account]);
            
            // Log for security audit
            $tenantId = $user ? $user['tenant_id'] : null;
            logActivity($this->db, $tenantId, null, 'LOGIN_FAIL', 'auth', null, "Thất bại: $account từ IP $ip");

            respond(401, null, 'Email / Tên đăng nhập hoặc mật khẩu không đúng', false);
        }

        // Record successful attempt & Clear old failures for this IP
        $this->db->prepare("INSERT INTO login_attempts (ip_address, email, is_successful) VALUES (?, ?, 1)")
             ->execute([$ip, $account]);
        $this->db->prepare("DELETE FROM login_attempts WHERE ip_address = ? AND attempt_time < NOW()")->execute([$ip]);

        $rememberMe = !empty($body['remember_me']);

        // 2FA Check
        if (!empty($user['two_factor_enabled']) && (int)$user['two_factor_enabled'] === 1) {
            $twoFactorType = $user['two_factor_type'] ?? 'email';
            $tempPayload = [
                'user_id' => $user['id'],
                'email' => $user['email'],
                'is_2fa_pending' => true,
                'remember_me' => $rememberMe,
                'two_factor_type' => $twoFactorType,
                'exp' => time() + 300 // 5 mins
            ];
            $tempToken = JWT::encode($tempPayload);

            if ($twoFactorType === 'email') {
                $otpCode = str_pad((string)random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
                $this->db->prepare("INSERT INTO email_otps (user_id, email, otp_code, type, expires_at) VALUES (?, ?, ?, '2fa', DATE_ADD(NOW(), INTERVAL 5 MINUTE))")
                     ->execute([$user['id'], $user['email'], $otpCode]);

                try {
                    require_once __DIR__ . '/../mailer.php';
                    $bodyHtml = "
                        <p>Kính gửi <b>" . htmlspecialchars($user['full_name']) . "</b>,</p>
                        <p>Mã xác thực 2 yếu tố (2FA OTP) để đăng nhập vào hệ thống Rich Land của bạn là:</p>
                        <div style='text-align: center; margin: 20px 0;'>
                            <span style='font-size: 28px; font-weight: 800; color: #BD1D2D; letter-spacing: 6px; padding: 10px 24px; background: #fff1f2; border: 1px dashed #f43f5e; border-radius: 10px; display: inline-block;'>" . $otpCode . "</span>
                        </div>
                        <p style='color: #64748b; font-size: 13px;'>Mã OTP này có hiệu lực trong <b>5 phút</b>. Không chia sẻ mã này cho bất kỳ ai.</p>
                    ";
                    sendEmailNotification($user['email'], 'Mã xác thực 2FA đăng nhập Rich Land', 'Xác thực 2 yếu tố (2FA)', $bodyHtml, '', true);
                } catch (Exception $e) {
                    error_log("Failed to send 2FA OTP Email: " . $e->getMessage());
                }
            }

            $parts = explode('@', $user['email']);
            $maskedEmail = (strlen($parts[0]) > 2 ? substr($parts[0], 0, 2) . str_repeat('*', strlen($parts[0]) - 2) : $parts[0]) . '@' . ($parts[1] ?? '');

            respond(200, [
                'requires_2fa' => true,
                'two_factor_type' => $twoFactorType,
                'temp_token' => $tempToken,
                'masked_email' => $maskedEmail
            ], 'Vui lòng nhập mã xác thực 2 yếu tố để hoàn tất đăng nhập');
            return;
        }

        $this->issueFullTokens($user, $rememberMe);
    }

    public function verify2FA(): void {
        $body = getBody();
        $tempToken = trim($body['temp_token'] ?? '');
        $otpCode   = trim($body['otp_code']   ?? '');

        if (!$tempToken || !$otpCode) {
            respond(422, null, 'Mã xác thực và token là bắt buộc', false);
        }

        $decoded = null;
        try {
            $decoded = JWT::decode($tempToken);
        } catch (Exception $e) {
            respond(401, null, 'Phiên xác thực đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.', false);
        }

        if (empty($decoded['is_2fa_pending']) || empty($decoded['user_id'])) {
            respond(401, null, 'Token xác thực không hợp lệ', false);
        }

        $userId = (int)$decoded['user_id'];
        $stmt = $this->db->prepare(
            'SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.logo_url as tenant_logo
             FROM users u JOIN tenants t ON u.tenant_id = t.id
             WHERE u.id = ? AND u.is_active = 1 AND t.is_active = 1 LIMIT 1'
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            respond(404, null, 'Tài khoản không tồn tại hoặc đã bị khóa', false);
        }

        $type = $user['two_factor_type'] ?? 'email';
        $verified = false;

        // Check backup codes
        if (!empty($user['two_factor_backup_codes'])) {
            $backupCodes = json_decode($user['two_factor_backup_codes'], true) ?: [];
            if (in_array($otpCode, $backupCodes, true)) {
                $verified = true;
                $updatedCodes = array_values(array_filter($backupCodes, fn($c) => $c !== $otpCode));
                $this->db->prepare("UPDATE users SET two_factor_backup_codes = ? WHERE id = ?")
                     ->execute([json_encode($updatedCodes), $userId]);
            }
        }

        if (!$verified) {
            if ($type === 'email') {
                $stmtOtp = $this->db->prepare("
                    SELECT id FROM email_otps 
                    WHERE user_id = ? AND otp_code = ? AND type = '2fa' AND is_used = 0 AND expires_at > NOW() 
                    ORDER BY id DESC LIMIT 1
                ");
                $stmtOtp->execute([$userId, $otpCode]);
                $otpRow = $stmtOtp->fetch();
                if ($otpRow) {
                    $verified = true;
                    $this->db->prepare("UPDATE email_otps SET is_used = 1 WHERE id = ?")->execute([$otpRow['id']]);
                }
            } else if ($type === 'totp') {
                require_once __DIR__ . '/../utils/TOTP.php';
                if (!empty($user['two_factor_secret']) && TOTP::verifyCode($user['two_factor_secret'], $otpCode)) {
                    $verified = true;
                }
            }
        }

        if (!$verified) {
            respond(401, null, 'Mã xác thực không đúng hoặc đã hết hạn', false);
        }

        $rememberMe = !empty($decoded['remember_me']);
        $this->issueFullTokens($user, $rememberMe);
    }

    public function forgotPasswordRequest(): void {
        $body = getBody();
        $account = trim($body['email'] ?? $body['username'] ?? $body['account'] ?? '');
        if (!$account) {
            respond(422, null, 'Vui lòng nhập Email hoặc Tên đăng nhập', false);
        }

        $stmt = $this->db->prepare("
            SELECT id, full_name, email, username 
            FROM users 
            WHERE (LOWER(TRIM(email)) = LOWER(?) OR LOWER(TRIM(username)) = LOWER(?)) 
              AND is_active = 1 
            LIMIT 1
        ");
        $stmt->execute([$account, $account]);
        $user = $stmt->fetch();

        $maskedEmail = '';
        if ($user && !empty($user['email'])) {
            $userEmail = trim($user['email']);
            $otpCode = str_pad((string)random_int(100000, 999999), 6, '0', STR_PAD_LEFT);

            // Invalidate prior unused forgot-password OTPs for this user
            $this->db->prepare("UPDATE email_otps SET is_used = 1 WHERE user_id = ? AND type = 'forgot_password'")
                 ->execute([$user['id']]);

            $this->db->prepare("
                INSERT INTO email_otps (user_id, email, otp_code, type, expires_at) 
                VALUES (?, ?, ?, 'forgot_password', DATE_ADD(NOW(), INTERVAL 10 MINUTE))
            ")->execute([$user['id'], $userEmail, $otpCode]);

            try {
                require_once __DIR__ . '/../mailer.php';
                $bodyHtml = "
                    <p>Kính gửi <b>" . htmlspecialchars($user['full_name']) . "</b>,</p>
                    <p>Bạn đã gửi yêu cầu đặt lại mật khẩu cho tài khoản hệ thống <b>Rich Land CRM</b>.</p>
                    <p>Mã xác nhận OTP của bạn là:</p>
                    <div style='text-align: center; margin: 25px 0;'>
                        <span style='font-size: 32px; font-weight: 800; color: #BD1D2D; letter-spacing: 8px; padding: 12px 30px; background: #fff1f2; border: 2px dashed #f43f5e; border-radius: 12px; display: inline-block;'>" . $otpCode . "</span>
                    </div>
                    <p style='color: #64748b; font-size: 13px;'>Mã xác nhận này có hiệu lực trong <b>10 phút</b>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai khác.</p>
                ";
                sendEmailNotification($userEmail, 'Mã OTP Đặt lại Mật khẩu Rich Land', 'Đặt lại mật khẩu', $bodyHtml, '', true);
            } catch (Exception $e) {
                error_log("Failed to send forgot password email: " . $e->getMessage());
            }

            $parts = explode('@', $userEmail);
            $namePart = $parts[0];
            $domainPart = $parts[1] ?? '';
            $maskedName = strlen($namePart) > 2 
                ? substr($namePart, 0, 2) . str_repeat('*', min(4, strlen($namePart) - 2)) . substr($namePart, -1)
                : $namePart . '**';
            $maskedEmail = $maskedName . '@' . $domainPart;
        }

        respond(200, [
            'masked_email' => $maskedEmail
        ], 'Mã xác thực OTP đã được gửi đến email đăng ký. Vui lòng kiểm tra hộp thư (kể cả thư rác / Spam).');
    }

    public function forgotPasswordReset(): void {
        $body = getBody();
        $account = trim($body['email'] ?? $body['account'] ?? $body['username'] ?? '');
        $otpCode = trim($body['otp_code'] ?? '');
        $newPassword = trim($body['new_password'] ?? '');

        if (!$account || !$otpCode || !$newPassword) {
            respond(422, null, 'Vui lòng điền đầy đủ thông tin tài khoản, mã OTP và mật khẩu mới', false);
        }

        $pwdErr = $this->validatePasswordStrength($newPassword);
        if ($pwdErr) {
            respond(422, null, $pwdErr, false);
        }

        // Find user by email or username
        $userStmt = $this->db->prepare("
            SELECT id, tenant_id, email, full_name FROM users 
            WHERE (LOWER(TRIM(email)) = LOWER(?) OR LOWER(TRIM(username)) = LOWER(?)) 
              AND is_active = 1 
            LIMIT 1
        ");
        $userStmt->execute([$account, $account]);
        $user = $userStmt->fetch();

        if (!$user) {
            respond(400, null, 'Tài khoản không tồn tại trong hệ thống', false);
        }

        $stmtOtp = $this->db->prepare("
            SELECT id, user_id FROM email_otps 
            WHERE user_id = ? AND otp_code = ? AND type = 'forgot_password' AND is_used = 0 AND expires_at > NOW() 
            ORDER BY id DESC LIMIT 1
        ");
        $stmtOtp->execute([$user['id'], $otpCode]);
        $otpRow = $stmtOtp->fetch();

        if (!$otpRow) {
            respond(400, null, 'Mã OTP không đúng hoặc đã hết hạn (10 phút)', false);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $this->db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$passwordHash, $user['id']]);
        $this->db->prepare("UPDATE email_otps SET is_used = 1 WHERE id = ?")->execute([$otpRow['id']]);

        // Revoke all existing sessions for security
        $this->db->prepare("DELETE FROM refresh_tokens WHERE user_id = ?")->execute([$user['id']]);

        logActivity($this->db, $user['tenant_id'], $user['id'], 'RESET_PASSWORD', 'auth', $user['id'], "Người dùng {$user['full_name']} đã đặt lại mật khẩu qua OTP");

        respond(200, [
            'email' => $user['email']
        ], 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại bằng mật khẩu mới.');
    }

    public function changePassword(array $auth): void {
        $body = getBody();
        $oldPassword = trim($body['old_password'] ?? '');
        $newPassword = trim($body['new_password'] ?? '');

        if (!$oldPassword || !$newPassword) {
            respond(422, null, 'Mật khẩu cũ và mật khẩu mới là bắt buộc', false);
        }

        $pwdErr = $this->validatePasswordStrength($newPassword);
        if ($pwdErr) {
            respond(422, null, $pwdErr, false);
        }

        $stmt = $this->db->prepare("SELECT id, tenant_id, full_name, password_hash FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$auth['user_id']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($oldPassword, $user['password_hash'])) {
            respond(400, null, 'Mật khẩu hiện tại không chính xác', false);
        }

        if ($oldPassword === $newPassword || password_verify($newPassword, $user['password_hash'])) {
            respond(422, null, 'Mật khẩu mới không được trùng với mật khẩu hiện tại', false);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $this->db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$newHash, $auth['user_id']]);

        // Revoke old refresh tokens for security
        $this->db->prepare("DELETE FROM refresh_tokens WHERE user_id = ?")->execute([$auth['user_id']]);

        logActivity($this->db, $user['tenant_id'], $auth['user_id'], 'CHANGE_PASSWORD', 'auth', $auth['user_id'], "Người dùng {$user['full_name']} đã đổi mật khẩu");

        respond(200, null, 'Đổi mật khẩu thành công! Vui lòng sử dụng mật khẩu mới cho các lần đăng nhập sau.');
    }

    private function issueFullTokens(array $user, bool $rememberMe = false): void {
        $this->db->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);

        $consultantId = null;
        if ($user['role'] === 'sales' || $user['role'] === 'sale') {
            $stmtC = $this->db->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
            $stmtC->execute([$user['email']]);
            $cRow = $stmtC->fetch();
            if ($cRow) {
                $consultantId = (int)$cRow['id'];
            }
        }

        $durationSeconds = $rememberMe ? (90 * 86400) : (defined('JWT_EXPIRE_ACCESS') ? JWT_EXPIRE_ACCESS : 86400);

        $payload = [
            'id'        => $user['id'],
            'user_id'   => $user['id'],
            'tenant_id' => $user['tenant_id'],
            'email'     => $user['email'],
            'role'       => $user['role'],
            'full_name'  => $user['full_name'],
            'consultant_id' => $consultantId,
            'remember_me' => $rememberMe,
            'exp'       => time() + $durationSeconds,
        ];

        $accessToken = JWT::encode($payload);

        $refreshToken = bin2hex(random_bytes(40));
        $hash = hash('sha256', $refreshToken);

        $refreshDays = $rememberMe ? 90 : 30;

        $this->db->beginTransaction();
        try {
            $this->db->prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()')->execute([$user['id']]);
            $this->db->prepare(
                'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))'
            )->execute([$user['id'], $hash, $refreshDays]);
            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
        }

        logActivity($this->db, $user['tenant_id'], $user['id'], 'login', 'auth', $user['id'], "Người dùng {$user['full_name']} đã đăng nhập thành công từ {$_SERVER['REMOTE_ADDR']}");

        respond(200, [
            'access_token'  => $accessToken,
            'refresh_token' => $refreshToken,
            'remember_me'   => $rememberMe,
            'expires_in'    => $durationSeconds,
            'user' => [
                'id'          => $user['id'],
                'user_id'     => $user['id'],
                'consultant_id' => $consultantId,
                'email'       => $user['email'],
                'full_name'   => $user['full_name'],
                'role'        => $user['role'],
                'job_title'   => $user['job_title'] ?? null,
                'avatar_url'  => $user['avatar_url'],
                'signature_url' => $user['signature_url'] ?? null,
                'two_factor_enabled' => (int)($user['two_factor_enabled'] ?? 0),
                'two_factor_type' => $user['two_factor_type'] ?? 'email',
                'tenant_id'   => $user['tenant_id'],
                'tenant_name' => $user['tenant_name'],
                'tenant_slug' => $user['tenant_slug'],
                'tenant_logo' => $user['tenant_logo'],
            ]
        ], 'Đăng nhập thành công');
    }

    public function refresh(): void {
        $body = getBody();
        $refreshToken = $body['refresh_token'] ?? '';
        if (!$refreshToken) respond(401, null, 'Thiếu refresh token', false);

        $hash = hash('sha256', $refreshToken);
        $stmt = $this->db->prepare(
            'SELECT rt.*, u.email, u.role, u.full_name, u.tenant_id, u.is_active
             FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
             WHERE rt.token_hash = ? AND rt.expires_at > NOW() AND u.is_active = 1 LIMIT 1'
        );
        $stmt->execute([$hash]);
        $row = $stmt->fetch();
        if (!$row) respond(401, null, 'Refresh token không hợp lệ hoặc đã hết hạn', false);

        $payload = [
            'user_id'   => $row['user_id'],
            'tenant_id' => $row['tenant_id'],
            'email'     => $row['email'],
            'role'       => $row['role'],
            'full_name'  => $row['full_name'],
        ];
        $newAccess = JWT::encode($payload);

        $newRefresh = bin2hex(random_bytes(40));
        $newHash = hash('sha256', $newRefresh);
        
        $this->db->beginTransaction();
        try {
            $this->db->prepare('DELETE FROM refresh_tokens WHERE id = ?')->execute([$row['id']]);
            $this->db->prepare(
                'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))'
            )->execute([$row['user_id'], $newHash, 30]);
            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Không thể tạo token mới', false);
        }

        respond(200, [
            'access_token'  => $newAccess,
            'refresh_token' => $newRefresh
        ], 'Token làm mới thành công');
    }

    public function logout(): void {
        $body = getBody();
        $refreshToken = $body['refresh_token'] ?? '';
        if ($refreshToken) {
            $hash = hash('sha256', $refreshToken);
            $this->db->prepare('DELETE FROM refresh_tokens WHERE token_hash = ?')->execute([$hash]);
        }
        respond(200, null, 'Đăng xuất thành công');
    }

    public function me(array $auth): void {
        $stmt = $this->db->prepare(
            'SELECT u.id, u.email, u.full_name, u.role, u.job_title, u.avatar_url, u.signature_url, u.phone, u.two_factor_enabled, u.two_factor_type, u.manager_behavior_mode,
                    u.tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.logo_url as tenant_logo
             FROM users u JOIN tenants t ON u.tenant_id = t.id
             WHERE u.id = ? AND u.is_active = 1'
        );
        $stmt->execute([$auth['user_id']]);
        $user = $stmt->fetch();
        if (!$user) respond(404, null, 'Người dùng không tồn tại', false);
        respond(200, $user);
    }
}
