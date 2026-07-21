<?php
class NotificationController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $stmt = $this->db->prepare("SELECT * FROM notifications WHERE user_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 100");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $unread = $this->db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id=? AND tenant_id=? AND is_read=0");
        $unread->execute([$auth['user_id'], $auth['tenant_id']]);
        
        $avatarsStmt = $this->db->query("SELECT name, avatar FROM accounts WHERE avatar IS NOT NULL AND avatar != ''");
        $avatars = $avatarsStmt->fetchAll(PDO::FETCH_KEY_PAIR);
        
        respond(200, [
            'items' => $items,
            'unread_count' => (int)$unread->fetchColumn(),
            'avatars' => $avatars
        ]);
    }

    public function update(array $auth, int $id): void {
        $b = getBody();
        $isRead = isset($b['is_read']) ? (int)$b['is_read'] : 1;
        
        $stmt = $this->db->prepare("UPDATE notifications SET is_read=? WHERE id=? AND user_id=? AND tenant_id=?");
        $stmt->execute([$isRead, $id, $auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Cập nhật trạng thái thông báo thành công');
    }

    public function markAllRead(array $auth): void {
        $stmt = $this->db->prepare("UPDATE notifications SET is_read=1 WHERE user_id=? AND tenant_id=?");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Đã đánh dấu tất cả thông báo là đã đọc');
    }

    public function destroy(array $auth, int $id): void {
        $stmt = $this->db->prepare("DELETE FROM notifications WHERE id=? AND user_id=? AND tenant_id=?");
        $stmt->execute([$id, $auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Đã xóa thông báo thành công');
    }

    public function clearAll(array $auth): void {
        $stmt = $this->db->prepare("DELETE FROM notifications WHERE user_id=? AND tenant_id=?");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Đã xóa tất cả thông báo');
    }

    public function getSettings(array $auth): void {
        // Ensure matrix_config column exists in user_notification_settings table
        try {
            $this->db->exec("ALTER TABLE user_notification_settings ADD COLUMN matrix_config LONGTEXT NULL");
        } catch (\Throwable $e) {}

        // Fetch user account linking information across users, accounts, and consultants
        $stmtUser = $this->db->prepare("
            SELECT 
                COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(a.email), ''), NULLIF(TRIM(c.email), '')) as email,
                COALESCE(NULLIF(TRIM(u.zalo_chat_id), ''), NULLIF(TRIM(a.zalo_chat_id), ''), NULLIF(TRIM(c.zalo_chat_id), '')) as zalo_chat_id,
                COALESCE(NULLIF(TRIM(u.telegram_chat_id), ''), NULLIF(TRIM(a.telegram_chat_id), ''), NULLIF(TRIM(c.telegram_chat_id), '')) as telegram_chat_id
            FROM users u
            LEFT JOIN accounts a ON u.id = a.id
            LEFT JOIN consultants c ON u.id = c.id
            WHERE u.id = ? LIMIT 1
        ");
        $stmtUser->execute([$auth['user_id']]);
        $userInfo = $stmtUser->fetch(PDO::FETCH_ASSOC) ?: [];

        $stmt = $this->db->prepare("SELECT * FROM user_notification_settings WHERE user_id = ? AND tenant_id = ?");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $matrixConfig = null;
        if (!empty($row['matrix_config'])) {
            $matrixConfig = json_decode($row['matrix_config'], true);
        }

        respond(200, [
            'settings' => $row ?: [],
            'matrix_config' => $matrixConfig,
            'user_info' => [
                'email' => $userInfo['email'] ?? '',
                'zalo_chat_id' => $userInfo['zalo_chat_id'] ?? '',
                'telegram_chat_id' => $userInfo['telegram_chat_id'] ?? '',
                'has_zalo' => !empty(trim((string)($userInfo['zalo_chat_id'] ?? ''))),
                'has_telegram' => !empty(trim((string)($userInfo['telegram_chat_id'] ?? ''))),
                'has_email' => !empty(trim((string)($userInfo['email'] ?? '')))
            ]
        ]);
    }

    public function updateSettings(array $auth): void {
        $b = getBody();

        // Ensure matrix_config column exists in user_notification_settings table
        try {
            $this->db->exec("ALTER TABLE user_notification_settings ADD COLUMN matrix_config LONGTEXT NULL");
        } catch (\Throwable $e) {}

        if (isset($b['matrix_config'])) {
            $matrixConfig = json_encode($b['matrix_config'], JSON_UNESCAPED_UNICODE);
            $stmt = $this->db->prepare("
                INSERT INTO user_notification_settings (user_id, tenant_id, matrix_config)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE matrix_config = VALUES(matrix_config)
            ");
            $stmt->execute([$auth['user_id'], $auth['tenant_id'], $matrixConfig]);
            respond(200, null, 'Cập nhật ma trận cấu hình thông báo thành công');
            return;
        }
        
        $email_warning = isset($b['email_warning']) ? (int)$b['email_warning'] : 1;
        $email_mention = isset($b['email_mention']) ? (int)$b['email_mention'] : 1;
        $email_approval_request = isset($b['email_approval_request']) ? (int)$b['email_approval_request'] : 1;
        $email_project_document = isset($b['email_project_document']) ? (int)$b['email_project_document'] : 0;
        $email_project_comment = isset($b['email_project_comment']) ? (int)$b['email_project_comment'] : 0;
        $email_project_roster = isset($b['email_project_roster']) ? (int)$b['email_project_roster'] : 0;
        $email_info = isset($b['email_info']) ? (int)$b['email_info'] : 0;

        $stmt = $this->db->prepare("INSERT INTO user_notification_settings 
            (user_id, tenant_id, email_warning, email_mention, email_approval_request, email_project_document, email_project_comment, email_project_roster, email_info)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                email_warning = VALUES(email_warning),
                email_mention = VALUES(email_mention),
                email_approval_request = VALUES(email_approval_request),
                email_project_document = VALUES(email_project_document),
                email_project_comment = VALUES(email_project_comment),
                email_project_roster = VALUES(email_project_roster),
                email_info = VALUES(email_info)");
        
        $stmt->execute([
            $auth['user_id'],
            $auth['tenant_id'],
            $email_warning,
            $email_mention,
            $email_approval_request,
            $email_project_document,
            $email_project_comment,
            $email_project_roster,
            $email_info
        ]);

        respond(200, null, 'Cập nhật cấu hình thông báo thành công');
    }
}
