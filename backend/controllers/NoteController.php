<?php
// NoteController — Threaded notes with @mentions on contacts, companies, deals
class NoteController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    private function checkEntityAccess(array $auth, string $type, int $id): bool {
        $table = $type === 'contact' ? 'contacts' : ($type === 'company' ? 'companies' : ($type === 'deal' ? 'deals' : null));
        if (!$table) return true; // Generic types or non-existing tables

        $sql = "SELECT id FROM $table WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND owner_id=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        return (bool)$stmt->fetch();
    }

    public function index(array $auth, string $type, int $entityId): void {
        if (!$this->checkEntityAccess($auth, $type, $entityId)) {
            respond(403, null, 'Bạn không có quyền xem ghi chú này', false);
        }

        $salesFilter = "";
        $mainParams = [$auth['tenant_id'], $type, $entityId];
        if ($auth['role'] === 'sales') {
            $salesFilter = " AND (n.user_id = ? OR u.role != 'sales' OR u.role IS NULL)";
            $mainParams[] = $auth['user_id'];
        }

        $stmt = $this->db->prepare("
            SELECT n.*, u.full_name as author_name, u.full_name as user_name, u.avatar_url as author_avatar,
                   p.full_name as parent_author
            FROM notes n
            LEFT JOIN users u ON n.user_id = u.id
            LEFT JOIN notes np ON n.parent_id = np.id
            LEFT JOIN users p ON np.user_id = p.id
            WHERE n.tenant_id=? AND n.entity_type=? AND n.entity_id=? AND n.parent_id IS NULL $salesFilter
            ORDER BY n.is_pinned DESC, n.created_at DESC
        ");
        $stmt->execute($mainParams);
        $notes = $stmt->fetchAll();

        // Fetch replies for all these notes in a single query
        if (!empty($notes)) {
            $noteIds = array_column($notes, 'id');
            $in = str_repeat('?,', count($noteIds) - 1) . '?';
            
            $replySalesFilter = "";
            $replyParams = array_merge([$auth['tenant_id']], $noteIds);
            if ($auth['role'] === 'sales') {
                $replySalesFilter = " AND (n.user_id = ? OR u.role != 'sales' OR u.role IS NULL)";
                $replyParams[] = $auth['user_id'];
            }

            $repliesStmt = $this->db->prepare("
                SELECT n.*, u.full_name as author_name, u.full_name as user_name, u.avatar_url as author_avatar
                FROM notes n LEFT JOIN users u ON n.user_id=u.id
                WHERE n.tenant_id=? AND n.parent_id IN ($in) $replySalesFilter ORDER BY n.created_at ASC
            ");
            $repliesStmt->execute($replyParams);
            $allReplies = $repliesStmt->fetchAll();

            $repliesByParent = [];
            foreach ($allReplies as $reply) {
                $repliesByParent[$reply['parent_id']][] = $reply;
            }

            foreach ($notes as &$note) {
                $note['replies'] = $repliesByParent[$note['id']] ?? [];
            }
        }
        respond(200, $notes);
    }

    public function store(array $auth, string $type, int $entityId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền tạo ghi chú', false);
        if (!$this->checkEntityAccess($auth, $type, $entityId)) {
            respond(403, null, 'Bạn không có quyền thêm ghi chú cho mục này', false);
        }

        $b = getBody();
        if (empty($b['body'])) respond(422, null, 'Nội dung ghi chú là bắt buộc', false);
        $this->db->prepare("
            INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type, parent_id, is_pinned)
            VALUES (?,?,?,?,?,?,?,?)
        ")->execute([
            $auth['tenant_id'], $auth['user_id'], $type, $entityId,
            $b['body'], $b['type'] ?? 'internal',
            $b['parent_id'] ?? null, $b['is_pinned'] ?? 0
        ]);
        $id = (int)$this->db->lastInsertId();

        // 1. Extract mentions from body text (@Full_Name_With_Underscores)
        $mentions = $b['mentions'] ?? [];
        if (empty($mentions)) {
            preg_match_all('/@([a-zA-Z0-9_\u00C0-\u1EF9]+)/u', $b['body'], $matches);
            if (!empty($matches[1])) {
                foreach ($matches[1] as $nameWithUnderscores) {
                    $fullName = str_replace('_', ' ', $nameWithUnderscores);
                    $stmt = $this->db->prepare("SELECT id FROM users WHERE tenant_id=? AND full_name=?");
                    $stmt->execute([$auth['tenant_id'], $fullName]);
                    $uid = $stmt->fetchColumn();
                    if ($uid) $mentions[] = (int)$uid;
                }
            }
        }
        $mentions = array_unique($mentions);

        // 2. Process mentions
        if (!empty($mentions)) {
            $ins = $this->db->prepare("INSERT IGNORE INTO note_mentions (note_id, user_id) VALUES (?,?)");
            $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
            
            foreach ($mentions as $uid) {
                $uid = (int)$uid;
                $ins->execute([$id, $uid]);
                
                // Don't notify self
                if ($uid !== (int)$auth['user_id']) {
                    $notif->execute([
                        $uid, $auth['tenant_id'], 
                        'Bạn được nhắc tên', 
                        $auth['full_name'] . ' đã nhắc tên bạn trong một ghi chú.',
                        'mention', 
                        "/notes/{$id}"
                    ]);
                }
            }
        }
        respond(201, ['id' => $id], 'Đã thêm ghi chú');
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật ghi chú', false);
        $b = getBody();
        if (empty($b['body'])) respond(422, null, 'Nội dung là bắt buộc', false);
        $this->db->prepare("UPDATE notes SET body=?, is_pinned=?, updated_at=NOW() WHERE id=? AND user_id=? AND tenant_id=?")
            ->execute([$b['body'], $b['is_pinned'] ?? 0, $id, $auth['user_id'], $auth['tenant_id']]);
        respond(200, null, 'Đã cập nhật ghi chú');
    }

    public function destroy(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xóa ghi chú', false);
        // 1. Verify existence and permission
        $check = $this->db->prepare("SELECT id FROM notes WHERE id=? AND tenant_id=?" . (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true) ? " AND user_id=?" : ""));
        $cp = [$id, $auth['tenant_id']];
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) $cp[] = $auth['user_id'];
        $check->execute($cp);
        if (!$check->fetch()) respond(404, null, 'Không tìm thấy ghi chú hoặc không có quyền', false);

        $this->db->beginTransaction();
        try {
            // 2. Delete the note
            $this->db->prepare("DELETE FROM notes WHERE id=?")->execute([$id]);
            
            // 3. Delete associated notifications
            $this->db->prepare("DELETE FROM notifications WHERE tenant_id=? AND link LIKE ?")
                 ->execute([$auth['tenant_id'], "%/notes/$id%"]);

            $this->db->commit();
            respond(200, null, 'Đã xóa ghi chú và các thông báo liên quan');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }
}
