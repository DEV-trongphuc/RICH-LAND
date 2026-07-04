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
    }

    private function requireProjectAccess(array $auth, int $projectId): void {
        if ($auth['role'] === 'admin' || $auth['role'] === 'superadmin' || $auth['role'] === 'super_admin' || $auth['role'] === 'manager') {
            return;
        }

        // Check if sales is in roster for this project
        $stmt = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ?");
        $stmt->execute([$projectId, $auth['user_id']]);
        if (!$stmt->fetch()) {
            respond(403, null, 'Bạn không thuộc roster của dự án này để truy cập tài liệu', false);
        }
    }

    public function index(array $auth): void {
        $role = $auth['role'];
        $uid = (int)$auth['user_id'];
        
        $where = "WHERE p.tenant_id = ?";
        $params = [$auth['tenant_id']];
        
        if (in_array($role, ['sale', 'sales'], true)) {
            $where .= " AND p.id IN (SELECT project_id FROM project_roster WHERE user_id = ?)";
            $params[] = $uid;
        }

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
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $code = trim($b['code'] ?? '');
        $desc = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $location = trim($b['location'] ?? '');
        $developer = trim($b['developer'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $campaign_ids = trim($b['campaign_ids'] ?? '');

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

        $stmt = $this->db->prepare("
            INSERT INTO projects (tenant_id, name, code, description, status, location, developer, document_ids, campaign_ids) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $name, $code, $desc, $status, $location, $developer, $document_ids, $campaign_ids]);
        $newId = $this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE_PROJECT', 'project', $newId, "Tạo dự án: $name ($code)");
        respond(200, ['id' => $newId, 'code' => $code], 'Tạo dự án thành công');
    }

    public function update(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $code = trim($b['code'] ?? '');
        $desc = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $location = trim($b['location'] ?? '');
        $developer = trim($b['developer'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $campaign_ids = trim($b['campaign_ids'] ?? '');

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

        $stmt = $this->db->prepare("
            UPDATE projects 
            SET name = ?, code = ?, description = ?, status = ?, location = ?, developer = ?, document_ids = ?, campaign_ids = ? 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$name, $code, $desc, $status, $location, $developer, $document_ids, $campaign_ids, $id, $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_PROJECT', 'project', $id, "Cập nhật dự án: $name ($code)");
        respond(200, null, 'Cập nhật dự án thành công');
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin']);
        
        $stmt = $this->db->prepare("DELETE FROM projects WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_PROJECT', 'project', $id, "Xóa dự án ID: $id");
        respond(200, null, 'Xóa dự án thành công');
    }

    public function getRoster(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);

        // Fetch user IDs in roster
        $stmt = $this->db->prepare("
            SELECT u.id, u.full_name, u.email, u.role,
                   (CASE WHEN pr.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_assigned
            FROM users u
            LEFT JOIN project_roster pr ON u.id = pr.user_id AND pr.project_id = ?
            WHERE u.tenant_id = ? AND u.role = 'sales' AND u.is_active = 1
        ");
        $stmt->execute([$projectId, $auth['tenant_id']]);
        $roster = $stmt->fetchAll();
        respond(200, $roster, 'Lấy danh sách roster thành công');
    }

    public function updateRoster(array $auth, int $projectId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        $b = getBody();
        $userIds = $b['user_ids'] ?? []; // Array of user IDs to include in roster

        if (!is_array($userIds)) {
            respond(422, null, 'Danh sách user_ids không hợp lệ', false);
        }

        $this->db->beginTransaction();
        try {
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
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        
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

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPLOAD_PROJECT_DOC', 'project_document', $newDocId, "Tải lên tài liệu: $fileName cho dự án ID $projectId");
            respond(200, ['id' => $newDocId, 'name' => $fileName], 'Tải lên tài liệu dự án thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên máy chủ', false);
        }
    }

    public function deleteDocument(array $auth, int $projectId, int $docId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);

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
}
