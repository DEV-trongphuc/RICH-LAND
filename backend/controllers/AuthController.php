<?php
// f:\CRM\backend\controllers\AuthController.php

class AuthController {
    private PDO $db;

    public function __construct(PDO $db) { $this->db = $db; }

    public function login(): void {
        $body = getBody();
        $email    = trim($body['email']    ?? '');
        $password = trim($body['password'] ?? '');

        if (!$email || !$password) respond(422, null, 'Email và mật khẩu là bắt buộc', false);

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
             WHERE u.email = ? AND u.is_active = 1 AND t.is_active = 1 LIMIT 1'
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            // Record failed attempt
            $this->db->prepare("INSERT INTO login_attempts (ip_address, email, is_successful) VALUES (?, ?, 0)")
                 ->execute([$ip, $email]);
            
            // Log for security audit
            $tenantId = $user ? $user['tenant_id'] : null;
            logActivity($this->db, $tenantId, null, 'LOGIN_FAIL', 'auth', null, "Thất bại: $email từ IP $ip");

            respond(401, null, 'Email hoặc mật khẩu không đúng', false);
        }

        // Record successful attempt & Clear old failures for this IP
        $this->db->prepare("INSERT INTO login_attempts (ip_address, email, is_successful) VALUES (?, ?, 1)")
             ->execute([$ip, $email]);
        $this->db->prepare("DELETE FROM login_attempts WHERE ip_address = ? AND attempt_time < NOW()")->execute([$ip]);

        // Update last login
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

        $payload = [
            'id'        => $user['id'],
            'user_id'   => $user['id'],
            'tenant_id' => $user['tenant_id'],
            'email'     => $user['email'],
            'role'       => $user['role'],
            'full_name'  => $user['full_name'],
            'consultant_id' => $consultantId,
        ];

        $accessToken = JWT::encode($payload);

        // Refresh token (random, store hash)
        $refreshToken = bin2hex(random_bytes(40));
        $hash = hash('sha256', $refreshToken);

        $this->db->beginTransaction();
        try {
            // Clean up old expired tokens for this user
            $this->db->prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()')->execute([$user['id']]);

            $this->db->prepare(
                'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))'
            )->execute([$user['id'], $hash, 30]);
            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            // Proceed anyway, login still works
        }

        // Log activity
        logActivity($this->db, $user['tenant_id'], $user['id'], 'login', 'auth', $user['id'], "Người dùng {$user['full_name']} đã đăng nhập thành công từ {$_SERVER['REMOTE_ADDR']}");

        respond(200, [
            'access_token'  => $accessToken,
            'refresh_token' => $refreshToken,
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

        // Rotate refresh token
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
            'SELECT u.id, u.email, u.full_name, u.role, u.job_title, u.avatar_url, u.signature_url, u.phone, u.manager_behavior_mode,
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
