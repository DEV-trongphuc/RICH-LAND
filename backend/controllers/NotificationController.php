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
        $stmt = $this->db->prepare("SELECT * FROM user_notification_settings WHERE user_id = ? AND tenant_id = ?");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        $settings = $stmt->fetch();
        
        if (!$settings) {
            $settings = [
                'email_warning' => 1,
                'email_mention' => 1,
                'email_approval_request' => 1,
                'email_project_document' => 0,
                'email_project_comment' => 0,
                'email_project_roster' => 0,
                'email_info' => 0
            ];
        } else {
            foreach ($settings as $k => $v) {
                if (str_starts_with($k, 'email_')) {
                    $settings[$k] = (int)$v;
                }
            }
        }
        respond(200, $settings);
    }

    public function updateSettings(array $auth): void {
        $b = getBody();
        
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
