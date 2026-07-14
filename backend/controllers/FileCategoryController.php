<?php

class FileCategoryController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        try {
            $this->db->exec("ALTER TABLE file_categories ADD COLUMN created_by INT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE file_categories ADD COLUMN visibility VARCHAR(50) DEFAULT 'shared'");
        } catch (Exception $e) {}
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $visibility = $_GET['visibility'] ?? 'shared';

        // Ensure default categories exist
        $this->ensureDefaults($tid);

        if ($visibility === 'personal') {
            $stmt = $this->db->prepare("
                SELECT id, label, icon_type, is_default, visibility, created_by 
                FROM file_categories 
                WHERE tenant_id = ? AND visibility = 'personal' AND created_by = ?
                ORDER BY created_at ASC
            ");
            $stmt->execute([$tid, $uid]);
        } else {
            $stmt = $this->db->prepare("
                SELECT id, label, icon_type, is_default, visibility, created_by 
                FROM file_categories 
                WHERE tenant_id = ? AND (visibility = 'shared' OR visibility IS NULL OR visibility = '')
                ORDER BY created_at ASC
            ");
            $stmt->execute([$tid]);
        }
        
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(200, $categories);
    }

    public function store(array $auth): void {
        $b = getBody();
        $visibility = trim($b['visibility'] ?? 'shared');

        if ($visibility !== 'personal') {
            if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
                respond(403, null, 'Quyền quản trị là bắt buộc để tạo thư mục dùng chung', false);
            }
        }

        if (empty($b['label'])) respond(400, null, 'Tên danh mục là bắt buộc', false);

        $id = 'cat_' . time() . '_' . bin2hex(random_bytes(2));
        $label = trim($b['label']);
        $icon = $b['icon_type'] ?? 'folder';

        $stmt = $this->db->prepare("
            INSERT INTO file_categories (id, tenant_id, label, icon_type, is_default, created_by, visibility) 
            VALUES (?, ?, ?, ?, 0, ?, ?)
        ");
        $stmt->execute([$id, $auth['tenant_id'], $label, $icon, $auth['user_id'], $visibility]);

        respond(200, [
            'id' => $id, 
            'label' => $label, 
            'icon_type' => $icon, 
            'is_default' => 0,
            'visibility' => $visibility,
            'created_by' => $auth['user_id']
        ], 'Đã tạo danh mục');
    }

    public function update(array $auth, string $id): void {
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        
        $stmt = $this->db->prepare("SELECT created_by, visibility FROM file_categories WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        $cat = $stmt->fetch();
        if (!$cat) respond(404, null, 'Không tìm thấy danh mục', false);

        $isOwner = ((int)($cat['created_by'] ?? 0)) === $uid;
        $isAdmin = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true);

        if ($cat['visibility'] === 'personal') {
            if (!$isOwner && !$isAdmin) respond(403, null, 'Bạn không có quyền chỉnh sửa danh mục cá nhân của người khác', false);
        } else {
            if (!$isAdmin) respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $b = getBody();
        if (empty($b['label'])) respond(400, null, 'Tên danh mục là bắt buộc', false);

        $stmt = $this->db->prepare("UPDATE file_categories SET label = ? WHERE id = ? AND tenant_id = ?");
        $stmt->execute([trim($b['label']), $id, $tid]);
        
        respond(200, null, 'Đã cập nhật danh mục');
    }

    public function destroy(array $auth, string $id): void {
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];

        $stmt = $this->db->prepare("SELECT is_default, created_by, visibility FROM file_categories WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        $cat = $stmt->fetch();

        if (!$cat) respond(404, null, 'Không tìm thấy danh mục', false);
        if ($cat['is_default']) respond(403, null, 'Không thể xóa danh mục mặc định', false);

        $isOwner = ((int)($cat['created_by'] ?? 0)) === $uid;
        $isAdmin = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true);

        if ($cat['visibility'] === 'personal') {
            if (!$isOwner && !$isAdmin) respond(403, null, 'Bạn không có quyền xóa danh mục cá nhân của người khác', false);
        } else {
            if (!$isAdmin) respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $this->db->prepare("DELETE FROM file_categories WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);
        $this->db->prepare("UPDATE cloud_files SET category = 'general' WHERE category = ? AND tenant_id = ?")->execute([$id, $tid]);

        respond(200, null, 'Đã xóa danh mục');
    }

    private function ensureDefaults(int $tid): void {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM file_categories WHERE tenant_id = ? AND is_default = 1");
        $stmt->execute([$tid]);
        $count = (int)$stmt->fetchColumn();

        if ($count === 0) {
            $defaults = [
                ['all', 'Tất cả', 'hard-drive'],
                ['template', 'Biểu mẫu', 'file-text'],
                ['marketing', 'Marketing', 'globe'],
                ['contract', 'Hợp đồng', 'shield'],
                ['general', 'Khác', 'folder']
            ];
            
            $insert = $this->db->prepare("INSERT IGNORE INTO file_categories (id, tenant_id, label, icon_type, is_default) VALUES (?, ?, ?, ?, 1)");
            foreach ($defaults as $d) {
                $insert->execute([$d[0], $tid, $d[1], $d[2]]);
            }
        }
    }
}
