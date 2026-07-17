<?php
// backend/controllers/ProjectController.php

class ProjectController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN document_ids TEXT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN campaign_ids TEXT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN progress_percent INT DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN construction_status VARCHAR(100) DEFAULT 'Chưa khởi công'");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN legal_status VARCHAR(255) DEFAULT 'Đang hoàn thiện pháp lý'");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN scale_block_count INT DEFAULT 1");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN scale_unit_count INT DEFAULT 100");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN handover_year INT DEFAULT 2026");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN manager_ids TEXT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN folder_path VARCHAR(500) DEFAULT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE projects ADD COLUMN created_by INT DEFAULT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS comments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id INT NOT NULL,
                    user_id INT NOT NULL,
                    body TEXT NOT NULL,
                    parent_id INT NULL DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE comments ADD COLUMN parent_id INT NULL DEFAULT NULL");
        } catch (Exception $e) {}
    }

    private function requireProjectAccess(array $auth, int $projectId): void {
        $stmtProj = $this->db->prepare("SELECT tenant_id, created_by, manager_ids FROM projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        if (!$proj) {
            respond(404, null, 'Dự án không tồn tại', false);
        }
        if ((int)$proj['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền truy cập dự án này', false);
        }

        // Bypass if project creator or project manager (GĐKD Dự án)
        if ($proj['created_by'] && (int)$proj['created_by'] === (int)$auth['user_id']) {
            return;
        }
        if (!empty($proj['manager_ids'])) {
            $mIds = array_filter(array_map('intval', explode(',', $proj['manager_ids'])));
            if (in_array((int)$auth['user_id'], $mIds, true)) {
                return;
            }
        }

        $isRosterRestricted = in_array($auth['role'], ['sale', 'sales', 'manager', 'director'], true);
        if (!$isRosterRestricted) {
            return;
        }

        // Check if user is in roster for this project
        $stmt = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ?");
        $stmt->execute([$projectId, $auth['user_id']]);
        if (!$stmt->fetch()) {
            respond(403, null, 'Bạn không thuộc roster của dự án này để truy cập tài liệu', false);
        }
    }

    private function requireProjectEditPermission(array $auth, int $projectId): void {
        $stmtProj = $this->db->prepare("SELECT created_by, manager_ids FROM projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        
        $isAuthorized = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true);
        if ($proj) {
            if ($proj['created_by'] && (int)$proj['created_by'] === (int)$auth['user_id']) {
                $isAuthorized = true;
            }
            if (!empty($proj['manager_ids'])) {
                $mIds = array_filter(array_map('intval', explode(',', $proj['manager_ids'])));
                if (in_array((int)$auth['user_id'], $mIds, true)) {
                    $isAuthorized = true;
                }
            }
        }

        if (!$isAuthorized) {
            $isManagerOrLeader = ($auth['role'] === 'manager');
            if (!$isManagerOrLeader) {
                $stmtLeader = $this->db->prepare("SELECT 1 FROM teams WHERE leader_id = ? LIMIT 1");
                $stmtLeader->execute([(int)$auth['user_id']]);
                if ($stmtLeader->fetch()) {
                    $isManagerOrLeader = true;
                }
            }

            if ($isManagerOrLeader) {
                $stmtRoster = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
                $stmtRoster->execute([$projectId, (int)$auth['user_id']]);
                if ($stmtRoster->fetch()) {
                    $isAuthorized = true;
                }
            }
        }

        if (!$isAuthorized) {
            respond(403, null, 'Bạn không có quyền chỉnh sửa dự án này', false);
        }
        $this->requireProjectAccess($auth, $projectId);
    }

    public function index(array $auth): void {
        $role = $auth['role'];
        $uid = (int)$auth['user_id'];
        
        $where = "WHERE p.tenant_id = ?";
        $params = [$auth['tenant_id']];
        
        $bypassRoster = (int)($_GET['bypass_roster'] ?? 0);
        $isRosterRestricted = in_array($role, ['sale', 'sales', 'manager', 'director'], true);
        if ($isRosterRestricted && !$bypassRoster) {
            $where .= " AND p.id IN (SELECT project_id FROM project_roster WHERE user_id = ?)";
            $params[] = $uid;
        }

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 0;
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 0;

        if ($page > 0 && $limit > 0) {
            // Count total
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM projects p $where");
            $stmtCount->execute($params);
            $total = (int)$stmtCount->fetchColumn();

            $offset = ($page - 1) * $limit;
            $stmt = $this->db->prepare("
                SELECT p.*,
                       (SELECT COUNT(*) FROM project_roster WHERE project_id = p.id) as roster_count,
                       (SELECT COUNT(*) FROM project_documents WHERE project_id = p.id) as doc_count
                FROM projects p
                $where
                ORDER BY p.created_at DESC
                LIMIT $offset, $limit
            ");
            $stmt->execute($params);
            $projects = $stmt->fetchAll();

            respond(200, [
                'data' => $projects,
                'total' => $total,
                'page' => $page,
                'limit' => $limit
            ], 'Lấy danh sách dự án thành công');
        } else {
            $stmt = $this->db->prepare("
                SELECT p.*,
                       (SELECT COUNT(*) FROM project_roster WHERE project_id = p.id) as roster_count,
                       (SELECT COUNT(*) FROM project_documents WHERE project_id = p.id) as doc_count
                FROM projects p
                $where
                ORDER BY p.created_at DESC
            ");
            $stmt->execute($params);
            $projects = $stmt->fetchAll();
            respond(200, $projects, 'Lấy danh sách dự án thành công');
        }
    }

    private function generateUniqueCode(string $projectName): string {
        // Lấy chữ cái đầu của các từ
        $words = explode(' ', preg_replace('/\s+/', ' ', trim($projectName)));
        $initials = '';
        foreach ($words as $w) {
            $char = mb_substr($w, 0, 1);
            if (preg_match('/[a-zA-Z0-9]/', $char)) {
                $initials .= strtoupper($char);
            }
        }
        // Loại bỏ dấu tiếng Việt để có mã sạch
        $initials = iconv('UTF-8', 'ASCII//TRANSLIT', $initials);
        $initials = preg_replace('/[^A-Z0-9]/', '', strtoupper($initials));

        if (empty($initials)) {
            $initials = 'PROJ';
        }

        $code = $initials;
        $counter = 1;
        while (true) {
            $stmt = $this->db->prepare("SELECT id FROM projects WHERE code = ?");
            $stmt->execute([$code]);
            if (!$stmt->fetch()) {
                return $code;
            }
            $code = $initials . $counter;
            $counter++;
        }
    }

    public function store(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $code = trim($b['code'] ?? '');
        $desc = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $location = trim($b['location'] ?? '');
        $developer = trim($b['developer'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $campaign_ids = trim($b['campaign_ids'] ?? '');
        $progress_percent = isset($b['progress_percent']) ? (int)$b['progress_percent'] : 0;
        $construction_status = trim($b['construction_status'] ?? 'Chưa khởi công');
        $legal_status = trim($b['legal_status'] ?? 'Đang hoàn thiện pháp lý');
        $scale_block_count = isset($b['scale_block_count']) ? (int)$b['scale_block_count'] : 1;
        $scale_unit_count = isset($b['scale_unit_count']) ? (int)$b['scale_unit_count'] : 100;
        $handover_year = isset($b['handover_year']) ? (int)$b['handover_year'] : 2026;

        if (!$name) {
            respond(422, null, 'Tên dự án là bắt buộc', false);
        }

        // Tự động sinh mã nếu trống
        if (empty($code)) {
            $code = $this->generateUniqueCode($name);
        }

        // Check unique code
        $stmtCheck = $this->db->prepare("SELECT id FROM projects WHERE code = ?");
        $stmtCheck->execute([$code]);
        if ($stmtCheck->fetch()) {
            respond(400, null, 'Mã dự án đã tồn tại', false);
        }

        $manager_ids = trim($b['manager_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');
        $reference_url = trim($b['reference_url'] ?? '');

        $stmt = $this->db->prepare("
            INSERT INTO projects (tenant_id, name, code, description, status, location, developer, document_ids, campaign_ids, progress_percent, construction_status, legal_status, scale_block_count, scale_unit_count, handover_year, manager_ids, folder_path, reference_url, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $name, $code, $desc, $status, $location, $developer, $document_ids, $campaign_ids, $progress_percent, $construction_status, $legal_status, $scale_block_count, $scale_unit_count, $handover_year, $manager_ids, $folder_path, $reference_url, $auth['user_id']]);
        $newId = $this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE_PROJECT', 'project', $newId, "Tạo dự án: $name ($code)");

        // Update campaigns to link to this new project
        $campaignIdsArray = isset($b['campaign_ids_array']) && is_array($b['campaign_ids_array']) 
            ? array_filter(array_map('intval', $b['campaign_ids_array'])) 
            : [];
            
        if (empty($campaignIdsArray) && !empty($campaign_ids)) {
            $campNames = array_filter(array_map('trim', explode(',', $campaign_ids)));
            if (!empty($campNames)) {
                $inClause = implode(',', array_fill(0, count($campNames), '?'));
                $stmtC = $this->db->prepare("SELECT id FROM marketing_campaigns WHERE name IN ($inClause)");
                $stmtC->execute($campNames);
                $campaignIdsArray = $stmtC->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        }

        if (!empty($campaignIdsArray)) {
            $inClause = implode(',', array_fill(0, count($campaignIdsArray), '?'));
            $stmtSet = $this->db->prepare("UPDATE marketing_campaigns SET project_id = ? WHERE id IN ($inClause)");
            $stmtSet->execute(array_merge([$newId], $campaignIdsArray));
        }

        respond(200, ['id' => $newId, 'code' => $code], 'Tạo dự án thành công');
    }

    public function update(array $auth, int $id): void {
        $this->requireProjectEditPermission($auth, $id);

        $b = getBody();
        $name = trim($b['name'] ?? '');
        $code = trim($b['code'] ?? '');
        $desc = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $location = trim($b['location'] ?? '');
        $developer = trim($b['developer'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $campaign_ids = trim($b['campaign_ids'] ?? '');
        $progress_percent = isset($b['progress_percent']) ? (int)$b['progress_percent'] : 0;
        $construction_status = trim($b['construction_status'] ?? 'Chưa khởi công');
        $legal_status = trim($b['legal_status'] ?? 'Đang hoàn thiện pháp lý');
        $scale_block_count = isset($b['scale_block_count']) ? (int)$b['scale_block_count'] : 1;
        $scale_unit_count = isset($b['scale_unit_count']) ? (int)$b['scale_unit_count'] : 100;
        $handover_year = isset($b['handover_year']) ? (int)$b['handover_year'] : 2026;

        if (!$name) {
            respond(422, null, 'Tên dự án là bắt buộc', false);
        }

        // Tự động sinh mã nếu trống
        if (empty($code)) {
            $code = $this->generateUniqueCode($name);
        }

        // Check unique code excluding this project
        $stmtCheck = $this->db->prepare("SELECT id FROM projects WHERE code = ? AND id != ?");
        $stmtCheck->execute([$code, $id]);
        if ($stmtCheck->fetch()) {
            respond(400, null, 'Mã dự án đã bị trùng với dự án khác', false);
        }

        $manager_ids = trim($b['manager_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');
        $reference_url = trim($b['reference_url'] ?? '');

        $stmt = $this->db->prepare("
            UPDATE projects 
            SET name = ?, code = ?, description = ?, status = ?, location = ?, developer = ?, document_ids = ?, campaign_ids = ?, progress_percent = ?, construction_status = ?, legal_status = ?, scale_block_count = ?, scale_unit_count = ?, handover_year = ?, manager_ids = ?, folder_path = ?, reference_url = ? 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$name, $code, $desc, $status, $location, $developer, $document_ids, $campaign_ids, $progress_percent, $construction_status, $legal_status, $scale_block_count, $scale_unit_count, $handover_year, $manager_ids, $folder_path, $reference_url, $id, $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_PROJECT', 'project', $id, "Cập nhật dự án: $name ($code)");

        // Update campaigns to link to this project
        $campaignIdsArray = isset($b['campaign_ids_array']) && is_array($b['campaign_ids_array']) 
            ? array_filter(array_map('intval', $b['campaign_ids_array'])) 
            : [];
            
        if (empty($campaignIdsArray) && !empty($campaign_ids)) {
            $campNames = array_filter(array_map('trim', explode(',', $campaign_ids)));
            if (!empty($campNames)) {
                $inClause = implode(',', array_fill(0, count($campNames), '?'));
                $stmtC = $this->db->prepare("SELECT id FROM marketing_campaigns WHERE name IN ($inClause)");
                $stmtC->execute($campNames);
                $campaignIdsArray = $stmtC->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        }

        // Clear previous campaigns project_id association
        $stmtClear = $this->db->prepare("UPDATE marketing_campaigns SET project_id = NULL WHERE project_id = ?");
        $stmtClear->execute([$id]);

        if (!empty($campaignIdsArray)) {
            $inClause = implode(',', array_fill(0, count($campaignIdsArray), '?'));
            $stmtSet = $this->db->prepare("UPDATE marketing_campaigns SET project_id = ? WHERE id IN ($inClause)");
            $stmtSet->execute(array_merge([$id], $campaignIdsArray));
        }

        respond(200, null, 'Cập nhật dự án thành công');
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        
        $stmtProj = $this->db->prepare("SELECT created_by FROM projects WHERE id = ? AND tenant_id = ?");
        $stmtProj->execute([$id, $auth['tenant_id']]);
        $creatorId = $stmtProj->fetchColumn();
        if ($creatorId !== false && $creatorId !== null) {
            $isAdmin = in_array($auth['role'], ['admin', 'superadmin', 'super_admin'], true);
            if (!$isAdmin && (int)$creatorId !== (int)$auth['user_id']) {
                respond(403, null, 'Chỉ Admin hoặc người tạo dự án mới được xóa', false);
            }
        }
        
        $stmt = $this->db->prepare("DELETE FROM projects WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_PROJECT', 'project', $id, "Xóa dự án ID: $id");
        respond(200, null, 'Xóa dự án thành công');
    }

    public function getRoster(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);

        // Fetch user IDs in roster
        $stmt = $this->db->prepare("
             SELECT u.id, u.full_name, u.email, u.role, u.avatar_url, u.team_id,
                    (CASE WHEN pr.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_assigned
              FROM users u
              LEFT JOIN project_roster pr ON u.id = pr.user_id AND pr.project_id = ?
              WHERE u.tenant_id = ? AND u.role IN ('sales', 'sale', 'manager', 'director') AND u.is_active = 1
        ");
        $stmt->execute([$projectId, $auth['tenant_id']]);
        $roster = $stmt->fetchAll();
        respond(200, $roster, 'Lấy danh sách roster thành công');
    }

    public function updateRoster(array $auth, int $projectId): void {
        $isAuthorized = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$isAuthorized) {
            $isManagerOrLeader = ($auth['role'] === 'manager');
            if (!$isManagerOrLeader) {
                $stmtLeader = $this->db->prepare("SELECT 1 FROM teams WHERE leader_id = ? LIMIT 1");
                $stmtLeader->execute([(int)$auth['user_id']]);
                if ($stmtLeader->fetch()) {
                    $isManagerOrLeader = true;
                }
            }

            if ($isManagerOrLeader) {
                $stmtRoster = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
                $stmtRoster->execute([$projectId, (int)$auth['user_id']]);
                if ($stmtRoster->fetch()) {
                    $isAuthorized = true;
                }
            }
        }

        if (!$isAuthorized) {
            respond(403, null, 'Quyền truy cập bị từ chối', false);
        }
        $this->requireProjectAccess($auth, $projectId);
        $b = getBody();
        $userIds = $b['user_ids'] ?? []; // Array of user IDs to include in roster

        if (!is_array($userIds)) {
            respond(422, null, 'Danh sách user_ids không hợp lệ', false);
        }

        $this->db->beginTransaction();
        try {
            // Get current roster before delete
            $stmtCurrent = $this->db->prepare("SELECT user_id FROM project_roster WHERE project_id = ?");
            $stmtCurrent->execute([$projectId]);
            $oldUserIds = $stmtCurrent->fetchAll(PDO::FETCH_COLUMN) ?: [];

            // Remove all current roster for this project
            $stmtDel = $this->db->prepare("DELETE FROM project_roster WHERE project_id = ?");
            $stmtDel->execute([$projectId]);

            // Add new roster entries
            if (!empty($userIds)) {
                $stmtAdd = $this->db->prepare("INSERT INTO project_roster (project_id, user_id) VALUES (?, ?)");
                foreach ($userIds as $uid) {
                    $stmtAdd->execute([$projectId, (int)$uid]);
                }
            }

            // Find newly added users
            $addedUserIds = array_diff($userIds, $oldUserIds);

            if (!empty($addedUserIds)) {
                // Get project name
                $stmtName = $this->db->prepare("SELECT name FROM projects WHERE id = ?");
                $stmtName->execute([$projectId]);
                $projectName = $stmtName->fetchColumn() ?: "Dự án mới";

                $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'project_roster', ?)");
                foreach ($addedUserIds as $newUid) {
                    $stmtNotif->execute([
                        (int)$newUid,
                        $auth['tenant_id'],
                        "Bạn được phân phối vào dự án mới",
                        "Bạn đã được thêm vào danh sách nhân sự phân phối (roster) của dự án: " . $projectName,
                        "/projects?id=" . $projectId
                    ]);
                }
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_PROJECT_ROSTER', 'project', $projectId, "Cập nhật roster dự án ID: $projectId, số lượng: " . count($userIds));
            respond(200, null, 'Cập nhật roster thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi cập nhật roster: ' . $e->getMessage(), false);
        }
    }

    public function getDocuments(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);

        $stmt = $this->db->prepare("
            SELECT pd.*, u.full_name as uploaded_by_name 
            FROM project_documents pd
            JOIN users u ON pd.uploaded_by = u.id
            WHERE pd.project_id = ? 
            ORDER BY pd.created_at DESC
        ");
        $stmt->execute([$projectId]);
        $docs = $stmt->fetchAll();
        respond(200, $docs, 'Lấy danh sách tài liệu thành công');
    }

    public function uploadDocument(array $auth, int $projectId): void {
        $this->requireProjectEditPermission($auth, $projectId);
        
        if (empty($_FILES['file'])) {
            respond(400, null, 'Không tìm thấy file tải lên', false);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(400, null, 'Lỗi tải file lên: ' . $file['error'], false);
        }

        $fileName = basename($file['name']);
        $uploadDir = UPLOAD_DIR . '/projects/' . $projectId;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $fileName);
        $destPath = $uploadDir . '/' . $safeName;

        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            $stmt = $this->db->prepare("
                INSERT INTO project_documents (project_id, name, file_path, file_size, mime_type, uploaded_by) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $projectId, 
                $fileName, 
                'projects/' . $projectId . '/' . $safeName, 
                $file['size'], 
                $file['type'], 
                $auth['user_id']
            ]);
            $newDocId = $this->db->lastInsertId();

            // Retrieve roster users for this project
            $stmtRoster = $this->db->prepare("SELECT user_id FROM project_roster WHERE project_id = ?");
            $stmtRoster->execute([$projectId]);
            $rosterUsers = $stmtRoster->fetchAll(PDO::FETCH_COLUMN) ?: [];

            // Get project details for name & managers
            $stmtProj = $this->db->prepare("SELECT name, created_by, manager_ids FROM projects WHERE id = ?");
            $stmtProj->execute([$projectId]);
            $project = $stmtProj->fetch(PDO::FETCH_ASSOC);
            $notifyUids = [];

            if ($project) {
                $projectName = $project['name'];
                if ($project['created_by'] && (int)$project['created_by'] !== (int)$auth['user_id']) {
                    $notifyUids[] = (int)$project['created_by'];
                }
                if (!empty($project['manager_ids'])) {
                    $mIds = array_filter(array_map('intval', explode(',', $project['manager_ids'])));
                    foreach ($mIds as $mId) {
                        if ($mId !== (int)$auth['user_id']) {
                            $notifyUids[] = $mId;
                        }
                    }
                }
            } else {
                $projectName = "Dự án";
            }

            foreach ($rosterUsers as $rUid) {
                if ((int)$rUid !== (int)$auth['user_id']) {
                    $notifyUids[] = (int)$rUid;
                }
            }

            $notifyUids = array_unique($notifyUids);

            if (!empty($notifyUids)) {
                $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'project_document', ?)");
                foreach ($notifyUids as $nUid) {
                    $stmtNotif->execute([
                        $nUid,
                        $auth['tenant_id'],
                        "Tài liệu dự án mới được tải lên",
                        $auth['full_name'] . " đã tải lên tài liệu mới \"" . $fileName . "\" cho dự án " . $projectName,
                        "/projects?id=" . $projectId
                    ]);
                }
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPLOAD_PROJECT_DOC', 'project_document', $newDocId, "Tải lên tài liệu: $fileName cho dự án ID $projectId");
            respond(200, ['id' => $newDocId, 'name' => $fileName], 'Tải lên tài liệu dự án thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên máy chủ', false);
        }
    }

    public function deleteDocument(array $auth, int $projectId, int $docId): void {
        $this->requireProjectEditPermission($auth, $projectId);

        // Fetch document info
        $stmtDoc = $this->db->prepare("SELECT file_path, name FROM project_documents WHERE id = ? AND project_id = ?");
        $stmtDoc->execute([$docId, $projectId]);
        $doc = $stmtDoc->fetch();

        if (!$doc) {
            respond(404, null, 'Tài liệu không tồn tại', false);
        }

        // Delete physical file
        $filePath = UPLOAD_DIR . '/' . $doc['file_path'];
        if (file_exists($filePath)) {
            @unlink($filePath);
        }

        // Delete DB record
        $stmt = $this->db->prepare("DELETE FROM project_documents WHERE id = ?");
        $stmt->execute([$docId]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_PROJECT_DOC', 'project_document', $docId, "Xóa tài liệu: " . $doc['name']);
        respond(200, null, 'Xóa tài liệu dự án thành công');
    }

    public function updateDocument(array $auth, int $projectId, int $docId): void {
        $this->requireProjectEditPermission($auth, $projectId);

        $b = getRequestBody();
        $name = trim($b['name'] ?? '');
        if (empty($name)) {
            respond(400, null, 'Tên tệp không được để trống', false);
        }

        // Fetch document info
        $stmtDoc = $this->db->prepare("SELECT name FROM project_documents WHERE id = ? AND project_id = ?");
        $stmtDoc->execute([$docId, $projectId]);
        $oldName = $stmtDoc->fetchColumn();

        if (!$oldName) {
            respond(404, null, 'Tài liệu không tồn tại', false);
        }

        $stmt = $this->db->prepare("UPDATE project_documents SET name = ? WHERE id = ? AND project_id = ?");
        $stmt->execute([$name, $docId, $projectId]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_PROJECT_DOC', 'project_document', $docId, "Đổi tên tài liệu từ '$oldName' thành '$name'");
        respond(200, null, 'Đổi tên tài liệu thành công');
    }

    public function downloadDocument(array $auth, int $projectId, int $docId): void {
        $this->requireProjectAccess($auth, $projectId);

        $stmtDoc = $this->db->prepare("SELECT file_path, name, mime_type FROM project_documents WHERE id = ? AND project_id = ?");
        $stmtDoc->execute([$docId, $projectId]);
        $doc = $stmtDoc->fetch();

        if (!$doc) {
            respond(404, null, 'Tài liệu không tồn tại', false);
        }

        $filePath = UPLOAD_DIR . '/' . $doc['file_path'];
        if (!file_exists($filePath)) {
            respond(404, null, 'File vật lý không tồn tại trên máy chủ', false);
        }

        // Force download file safely
        header('Content-Description: File Transfer');
        header('Content-Type: ' . ($doc['mime_type'] ?? 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . $doc['name'] . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }

    public function getComments(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'project' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$projectId, $auth['tenant_id']]);
        respond(200, $stmt->fetchAll(), 'Lấy danh sách bình luận thành công');
    }

    public function addComment(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);
        $b = getBody();
        $body = trim($b['body'] ?? '');
        if (!$body) {
            respond(422, null, 'Nội dung bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, parent_id) 
            VALUES (?, 'project', ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $projectId, $auth['user_id'], $body, $parentId]);
        $newId = $this->db->lastInsertId();

        if ($parentId > 0) {
            $stmtParent = $this->db->prepare("SELECT user_id FROM comments WHERE id = ?");
            $stmtParent->execute([$parentId]);
            $parentOwnerId = (int)$stmtParent->fetchColumn();

            if ($parentOwnerId > 0 && $parentOwnerId !== (int)$auth['user_id']) {
                $title = "Bạn có phản hồi mới trong thảo luận dự án";
                $bodyText = ($auth['full_name'] ?? 'Đồng nghiệp') . " đã trả lời bình luận của bạn trong dự án";
                $type = "info";
                $link = "/projects?id=" . $projectId . "&highlight_comment_id=" . $newId;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $insertNotif->execute([$parentOwnerId, $auth['tenant_id'], $title, $bodyText, $type, $link]);
            }
        }

        // Parse mentions in comment body
        $mentions = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $body, $matches);
        if (!empty($matches[1])) {
            foreach ($matches[1] as $nameWithUnderscores) {
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmtUser = $this->db->prepare("SELECT id, email, full_name FROM users WHERE tenant_id=? AND full_name=?");
                $stmtUser->execute([$auth['tenant_id'], $fullName]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow) {
                    $uid = (int)$userRow['id'];
                    if ($uid !== (int)$auth['user_id']) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }

        // Get project details for name & managers
        $stmtProj = $this->db->prepare("SELECT name, created_by, manager_ids FROM projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $project = $stmtProj->fetch(PDO::FETCH_ASSOC);
        $projectName = $project ? $project['name'] : "Dự án";

        // Retrieve roster users for this project
        $stmtRoster = $this->db->prepare("SELECT user_id FROM project_roster WHERE project_id = ?");
        $stmtRoster->execute([$projectId]);
        $rosterUsers = $stmtRoster->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $notifyUids = [];
        if ($project) {
            if ($project['created_by'] && (int)$project['created_by'] !== (int)$auth['user_id']) {
                $notifyUids[] = (int)$project['created_by'];
            }
            if (!empty($project['manager_ids'])) {
                $mIds = array_filter(array_map('intval', explode(',', $project['manager_ids'])));
                foreach ($mIds as $mId) {
                    if ($mId !== (int)$auth['user_id']) {
                        $notifyUids[] = $mId;
                    }
                }
            }
        }

        foreach ($rosterUsers as $rUid) {
            if ((int)$rUid !== (int)$auth['user_id']) {
                $notifyUids[] = (int)$rUid;
            }
        }

        $notifyUids = array_unique($notifyUids);
        
        // Remove mentioned users from generic notifications
        $notifyUids = array_diff($notifyUids, array_keys($mentions));

        $preview = mb_strimwidth($body, 0, 50, "...");

        // Send mention notifications (with email)
        if (!empty($mentions)) {
            require_once __DIR__ . '/../mailer.php';
            $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'project_comment_mention', ?)");
            foreach ($mentions as $mUid => $userRow) {
                $stmtNotif->execute([
                    $mUid,
                    $auth['tenant_id'],
                    "Bạn được nhắc tên trong dự án " . $projectName,
                    $auth['full_name'] . " đã nhắc tên bạn trong dự án " . $projectName . ": \"" . $preview . "\"",
                    "/projects?id=" . $projectId . "&highlight_comment_id=" . $newId
                ]);

                if (!empty($userRow['email'])) {
                    $emailSubject = "[RICH LAND] Bạn được nhắc tên trong bình luận dự án " . $projectName;
                    $emailTitle = "NHẮC TÊN TRÊN HỆ THỐNG";
                    $emailContent = "Chào <strong>" . htmlspecialchars($userRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Bạn đã được nhắc tên bởi <strong>" . htmlspecialchars($auth['full_name']) . "</strong> trong một bình luận của dự án <strong>" . htmlspecialchars($projectName) . "</strong>.<br/>" .
                                    "Nội dung:<br/>" .
                                    "<blockquote style='border-left: 4px solid #eab308; padding-left: 12px; margin: 12px 0; color: #475569;'>" . nl2br(htmlspecialchars($body)) . "</blockquote>" .
                                    "Vui lòng truy cập hệ thống để biết thêm chi tiết.";
                    sendEmailNotification($userRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }

        // Send regular notifications
        if (!empty($notifyUids)) {
            $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'project_comment', ?)");
            foreach ($notifyUids as $nUid) {
                $stmtNotif->execute([
                    $nUid,
                    $auth['tenant_id'],
                    "Bình luận mới trong dự án " . $projectName,
                    $auth['full_name'] . " đã thêm một bình luận mới trong dự án " . $projectName . ": \"" . $preview . "\"",
                    "/projects?id=" . $projectId . "&highlight_comment_id=" . $newId
                ]);
            }
        }

        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    public function getStats(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);
        
        // Count total contacts/deals
        $stmtDeals = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE project_id = ? AND deleted_at IS NULL");
        $stmtDeals->execute([$projectId]);
        $totalDeals = (int)$stmtDeals->fetchColumn();
        
        // Count won deals (dong_deal)
        $stmtWon = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE project_id = ? AND pipeline_status = 'dong_deal' AND deleted_at IS NULL");
        $stmtWon->execute([$projectId]);
        $wonDeals = (int)$stmtWon->fetchColumn();
        
        // Win rate
        $winRate = $totalDeals > 0 ? round(($wonDeals / $totalDeals) * 100) : 0;
        
        // Expected revenue
        $stmtExpRev = $this->db->prepare("SELECT COALESCE(SUM(expected_revenue), 0) FROM contacts WHERE project_id = ? AND deleted_at IS NULL");
        $stmtExpRev->execute([$projectId]);
        $expectedRevenue = (float)$stmtExpRev->fetchColumn();
        
        // Actual revenue (paid invoices)
        $stmtActRev = $this->db->prepare("
            SELECT COALESCE(SUM(total), 0) 
            FROM invoices 
            WHERE contact_id IN (SELECT id FROM contacts WHERE project_id = ? AND deleted_at IS NULL)
              AND status = 'paid' 
              AND deleted_at IS NULL
        ");
        $stmtActRev->execute([$projectId]);
        $actualRevenue = (float)$stmtActRev->fetchColumn();
        
        // Total leads (lead status)
        $stmtLeads = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE project_id = ? AND status = 'lead' AND deleted_at IS NULL");
        $stmtLeads->execute([$projectId]);
        $totalLeads = (int)$stmtLeads->fetchColumn();
        
        // Audit changelog trail: last 15 actions
        $stmtLogs = $this->db->prepare("
            SELECT a.id, a.action, a.new_data, a.created_at, u.full_name as user_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.resource = 'project' AND a.resource_id = ? AND a.tenant_id = ?
            ORDER BY a.created_at DESC
            LIMIT 15
        ");
        $stmtLogs->execute([$projectId, $auth['tenant_id']]);
        $logs = $stmtLogs->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
        respond(200, [
            'total_deals' => $totalDeals,
            'won_deals' => $wonDeals,
            'win_rate' => $winRate,
            'expected_revenue' => $expectedRevenue,
            'actual_revenue' => $actualRevenue,
            'total_leads' => $totalLeads,
            'logs' => $logs
        ], 'Lấy thống kê dự án thành công');
    }
}
