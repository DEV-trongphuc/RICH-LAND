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
}
