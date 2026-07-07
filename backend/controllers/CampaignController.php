<?php
// backend/controllers/CampaignController.php

class CampaignController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS marketing_campaigns (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    name VARCHAR(255) NOT NULL,
                    description TEXT DEFAULT NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            
            // Delete mock campaigns if they exist to keep only production/user data
            $this->db->exec("
                DELETE FROM marketing_campaigns 
                WHERE name IN (
                    'Chiến dịch Mở bán Q1 2026', 
                    'Facebook Lead Ads - HCMC', 
                    'Google Search - Căn hộ cao cấp', 
                    'TikTok Ads - Biệt thự nghỉ dưỡng', 
                    'Chiến dịch Email & Inbound M2'
                ) OR description = 'Chiến dịch marketing chạy quảng cáo thu lead phân phối về cho các dự án bất động sản.';
            ");
        } catch (Exception $e) {}
    }

    public function index(array $auth): void {
        $tenantId = $auth['tenant_id'] ?? 1;
        $stmt = $this->db->prepare("SELECT * FROM marketing_campaigns WHERE tenant_id = ? ORDER BY created_at DESC");
        $stmt->execute([$tenantId]);
        respond(200, $stmt->fetchAll(), 'Lấy danh sách chiến dịch thành công');
    }

    public function store(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $description = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');

        if (empty($name)) {
            respond(422, null, 'Tên chiến dịch không được để trống', false);
        }

        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        $stmt = $this->db->prepare("INSERT INTO marketing_campaigns (tenant_id, name, description, status) VALUES (?, ?, ?, ?)");
        $stmt->execute([$tenantId, $name, $description, $status]);
        $newId = (int)$this->db->lastInsertId();

        logActivity($this->db, $tenantId, $userId, 'CREATE_CAMPAIGN', 'marketing_campaigns', $newId, "Tạo chiến dịch: $name");
        respond(200, ['id' => $newId], 'Tạo chiến dịch thành công');
    }

    public function update(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $description = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');

        if (empty($name)) {
            respond(422, null, 'Tên chiến dịch không được để trống', false);
        }

        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        $stmt = $this->db->prepare("UPDATE marketing_campaigns SET name = ?, description = ?, status = ? WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$name, $description, $status, $id, $tenantId]);

        logActivity($this->db, $tenantId, $userId, 'UPDATE_CAMPAIGN', 'marketing_campaigns', $id, "Cập nhật chiến dịch: $name");
        respond(200, null, 'Cập nhật chiến dịch thành công');
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        
        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        $stmtName = $this->db->prepare("SELECT name FROM marketing_campaigns WHERE id = ? AND tenant_id = ?");
        $stmtName->execute([$id, $tenantId]);
        $name = $stmtName->fetchColumn();
        if (!$name) {
            respond(404, null, 'Chiến dịch không tồn tại', false);
        }

        $stmt = $this->db->prepare("DELETE FROM marketing_campaigns WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        logActivity($this->db, $tenantId, $userId, 'DELETE_CAMPAIGN', 'marketing_campaigns', $id, "Xóa chiến dịch: $name");
        respond(200, null, 'Xóa chiến dịch thành công');
    }
}
