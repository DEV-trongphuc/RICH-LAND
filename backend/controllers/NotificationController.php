<?php
class NotificationController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }
    public function index(array $auth): void {
        $stmt=$this->db->prepare("SELECT * FROM notifications WHERE user_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 30");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        $unread=$this->db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id=? AND tenant_id=? AND is_read=0");
        $unread->execute([$auth['user_id'], $auth['tenant_id']]);
        respond(200,['items'=>$stmt->fetchAll(),'unread_count'=>(int)$unread->fetchColumn()]);
    }
    public function markRead(array $auth,int $id): void {
        $this->db->prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=? AND tenant_id=?")->execute([$id,$auth['user_id'],$auth['tenant_id']]);
        respond(200,null,'Đã đánh dấu đã đọc');
    }
    public function clearAll(array $auth): void {
        $this->db->prepare("DELETE FROM notifications WHERE user_id=? AND tenant_id=?")->execute([$auth['user_id'],$auth['tenant_id']]);
        respond(200,null,'Đã xóa tất cả thông báo');
    }
}
