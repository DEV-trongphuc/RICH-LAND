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
            
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN start_date DATE DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN end_date DATE DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN project_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN user_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN manager_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN document_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN folder_path VARCHAR(500) DEFAULT NULL");
            } catch (Exception $e) {}

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
        $start_date = !empty($b['start_date']) ? $b['start_date'] : null;
        $end_date = !empty($b['end_date']) ? $b['end_date'] : null;
        $project_ids = trim($b['project_ids'] ?? '');
        $user_ids = trim($b['user_ids'] ?? '');
        $manager_ids = trim($b['manager_ids'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');

        if (empty($name)) {
            respond(422, null, 'Tên chiến dịch không được để trống', false);
        }

        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        $stmt = $this->db->prepare("
            INSERT INTO marketing_campaigns (tenant_id, name, description, status, start_date, end_date, project_ids, user_ids, manager_ids, document_ids, folder_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$tenantId, $name, $description, $status, $start_date, $end_date, $project_ids, $user_ids, $manager_ids, $document_ids, $folder_path]);
        $newId = (int)$this->db->lastInsertId();

        $this->propagateCampaignRoster($project_ids, $user_ids);

        logActivity($this->db, $tenantId, $userId, 'CREATE_CAMPAIGN', 'marketing_campaigns', $newId, "Tạo chiến dịch: $name");
        respond(200, ['id' => $newId], 'Tạo chiến dịch thành công');
    }

    public function update(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $description = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $start_date = !empty($b['start_date']) ? $b['start_date'] : null;
        $end_date = !empty($b['end_date']) ? $b['end_date'] : null;
        $project_ids = trim($b['project_ids'] ?? '');
        $user_ids = trim($b['user_ids'] ?? '');
        $manager_ids = trim($b['manager_ids'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');

        if (empty($name)) {
            respond(422, null, 'Tên chiến dịch không được để trống', false);
        }

        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        $stmt = $this->db->prepare("
            UPDATE marketing_campaigns 
            SET name = ?, description = ?, status = ?, start_date = ?, end_date = ?, project_ids = ?, user_ids = ?, manager_ids = ?, document_ids = ?, folder_path = ? 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$name, $description, $status, $start_date, $end_date, $project_ids, $user_ids, $manager_ids, $document_ids, $folder_path, $id, $tenantId]);

        $this->propagateCampaignRoster($project_ids, $user_ids);

        logActivity($this->db, $tenantId, $userId, 'UPDATE_CAMPAIGN', 'marketing_campaigns', $id, "Cập nhật chiến dịch: $name");
        respond(200, null, 'Cập nhật chiến dịch thành công');
    }

    private function propagateCampaignRoster(string $projectIdsStr, string $userIdsStr): void {
        if (empty($projectIdsStr) || empty($userIdsStr)) return;
        // Project names mapping to IDs
        $pNames = array_filter(array_map('trim', explode(',', $projectIdsStr)));
        $uids = array_filter(array_map('intval', explode(',', $userIdsStr)));
        if (empty($pNames) || empty($uids)) return;

        // Fetch project IDs by name matching
        $inClause = implode(',', array_fill(0, count($pNames), '?'));
        $stmtProj = $this->db->prepare("SELECT id FROM projects WHERE name IN ($inClause)");
        $stmtProj->execute($pNames);
        $pids = $stmtProj->fetchAll(PDO::FETCH_COLUMN) ?: [];

        foreach ($pids as $pid) {
            foreach ($uids as $uid) {
                $stmtCheck = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ?");
                $stmtCheck->execute([$pid, $uid]);
                if (!$stmtCheck->fetch()) {
                    $stmtAdd = $this->db->prepare("INSERT INTO project_roster (project_id, user_id) VALUES (?, ?)");
                    $stmtAdd->execute([$pid, $uid]);
                }
            }
        }
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
