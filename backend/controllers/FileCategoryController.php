<?php

class FileCategoryController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];

        // Ensure default categories exist
        $this->ensureDefaults($tid);

        $stmt = $this->db->prepare("SELECT id, label, icon_type, is_default FROM file_categories WHERE tenant_id = ? ORDER BY created_at ASC");
        $stmt->execute([$tid]);
        
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        respond(200, $categories);
    }

    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }
        $b = getBody();
        if (empty($b['label'])) respond(400, null, 'Tên danh mục là bắt buộc', false);

        $id = 'cat_' . time() . '_' . bin2hex(random_bytes(2));
        $label = trim($b['label']);
        $icon = $b['icon_type'] ?? 'folder';

        $stmt = $this->db->prepare("INSERT INTO file_categories (id, tenant_id, label, icon_type, is_default) VALUES (?, ?, ?, ?, 0)");
        $stmt->execute([$id, $auth['tenant_id'], $label, $icon]);

        respond(200, ['id' => $id, 'label' => $label, 'icon_type' => $icon, 'is_default' => 0], 'Đã tạo danh mục');
    }

    public function update(array $auth, string $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }
        $b = getBody();
        if (empty($b['label'])) respond(400, null, 'Tên danh mục là bắt buộc', false);

        $stmt = $this->db->prepare("UPDATE file_categories SET label = ? WHERE id = ? AND tenant_id = ?");
        $stmt->execute([trim($b['label']), $id, $auth['tenant_id']]);

        if ($stmt->rowCount() === 0) respond(404, null, 'Không tìm thấy danh mục', false);
        
        respond(200, null, 'Đã cập nhật danh mục');
    }

    public function destroy(array $auth, string $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }
        $stmt = $this->db->prepare("SELECT is_default FROM file_categories WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $auth['tenant_id']]);
        $cat = $stmt->fetch();

        if (!$cat) respond(404, null, 'Không tìm thấy danh mục', false);
        if ($cat['is_default']) respond(403, null, 'Không thể xóa danh mục mặc định', false);

        $this->db->prepare("DELETE FROM file_categories WHERE id = ? AND tenant_id = ?")->execute([$id, $auth['tenant_id']]);
        
        // Move files back to 'all' or 'general' (although category is just a string in cloud_files)
        // Here we just let them exist as orphans or we can update cloud_files:
        $this->db->prepare("UPDATE cloud_files SET category = 'general' WHERE category = ? AND tenant_id = ?")->execute([$id, $auth['tenant_id']]);

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
