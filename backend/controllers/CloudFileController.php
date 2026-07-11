<?php
class CloudFileController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
        try {
            $this->db->exec("ALTER TABLE cloud_files ADD COLUMN project_id INT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE cloud_files ADD COLUMN contact_id INT NULL");
        } catch (Exception $e) {}
    }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $uid    = $auth['user_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $cat    = $_GET['category'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        $projectId = $_GET['project_id'] ?? '';

        $role = $auth['role'] ?? '';
        $isSale = $role === 'sales' || $role === 'sale';

        if ($isSale) {
            $where = [
                "cf.tenant_id = ?",
                "(
                    cf.uploaded_by = ? 
                    OR (
                        cf.visibility = 'shared' 
                        AND (cf.category NOT LIKE 'consultant_%' OR cf.category = ?)
                    )
                )"
            ];
            $params = [$tid, $uid, 'consultant_' . $uid];
        } else {
            $where = ["cf.tenant_id = ?"];
            $params = [$tid];
        }

        if ($cat) {
            $where[] = "cf.category = ?";
            $params[] = $cat;
        }

        if ($contactId !== '') {
            $where[] = "cf.contact_id = ?";
            $params[] = (int)$contactId;
        }

        if ($projectId !== '') {
            $where[] = "cf.project_id = ?";
            $params[] = (int)$projectId;
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM cloud_files cf WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT cf.*, u.full_name as uploader_name, u2.full_name as editor_name, p.name as project_name
            FROM cloud_files cf
            LEFT JOIN users u ON cf.uploaded_by = u.id
            LEFT JOIN users u2 ON cf.updated_by = u2.id
            LEFT JOIN projects p ON cf.project_id = p.id
            WHERE $w
            ORDER BY cf.created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        
        respond(200, [
            'items' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit
        ]);
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        
        $b = getBody();
        $category = $_POST['category'] ?? $b['category'] ?? 'general';
        if (in_array($auth['role'], ['sales', 'sale'], true) && strpos($category, 'consultant_') === 0) {
            respond(403, null, 'Bạn không có quyền tải lên tài liệu nhân sự (consultant_*)', false);
        }

        if (empty($_FILES['file'])) respond(422, null, 'Vui lòng chọn tệp tin để tải lên', false);
        
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) respond(500, null, 'Lỗi trong quá trình tải tệp lên server', false);

        // Security: Max file size 10MB
        if ($file['size'] > 10 * 1024 * 1024) respond(422, null, 'Dung lượng tệp tối đa cho phép là 10MB', false);

        // Security: Whitelist extensions
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg','jpeg','png','gif','webp','pdf','doc','docx','xls','xlsx','ppt','pptx','txt','zip','rar','csv'];
        if (!in_array($ext, $allowed)) respond(422, null, "Định dạng tệp .$ext không được hỗ trợ", false);

        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $name = $_POST['name'] ?? $file['name'];
        $visibility = $_POST['visibility'] ?? 'shared';
        $project_id = isset($_POST['project_id']) && $_POST['project_id'] !== '' ? (int)$_POST['project_id'] : null;
        $contact_id = isset($_POST['contact_id']) && $_POST['contact_id'] !== '' ? (int)$_POST['contact_id'] : null;

        // 1. Prepare directory
        $targetDir = UPLOAD_DIR . "/cloud/$tid";
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        // 2. Sanitize and prepare file path
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($name, PATHINFO_FILENAME));
        $fileName = time() . '_' . $safeName . '.' . $ext;
        $targetPath = $targetDir . '/' . $fileName;
        $dbPath = "uploads/cloud/$tid/$fileName";

        // 3. Move file
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            respond(500, null, 'Không thể lưu tệp tin vào thư mục đích', false);
        }

        // 4. Save to DB
        $stmt = $this->db->prepare("
            INSERT INTO cloud_files (tenant_id, uploaded_by, name, file_path, mime_type, file_size, category, visibility, project_id, contact_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tid, $uid, $name,
            $dbPath, $file['type'], $file['size'],
            $category, $visibility, $project_id, $contact_id
        ]);

        respond(201, ['id' => $this->db->lastInsertId(), 'path' => $dbPath], 'Đã tải tệp tin lên thành công');
    }

    public function update(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $b = getBody();
        
        $name = trim($b['name'] ?? '');
        $category = trim($b['category'] ?? 'general');
        $visibility = trim($b['visibility'] ?? 'shared');
        $project_id = isset($b['project_id']) && $b['project_id'] !== '' ? (int)$b['project_id'] : null;

        if (!$name) {
            respond(422, null, 'Tên tệp là bắt buộc', false);
        }

        // Permission check: Only uploader or admin/manager
        $checkStmt = $this->db->prepare("SELECT uploaded_by, category FROM cloud_files WHERE id = ? AND tenant_id = ?");
        $checkStmt->execute([$id, $tid]);
        $file = $checkStmt->fetch();
        if (!$file) respond(404, null, 'Không tìm thấy tệp tin', false);
        if (in_array($auth['role'], ['sales', 'sale'], true)) {
            if ((int)$file['uploaded_by'] !== (int)$auth['user_id']) {
                respond(403, null, 'Bạn không có quyền sửa thông tin tệp tin của người khác', false);
            }
            if (strpos($category, 'consultant_') === 0 || ($file['category'] && strpos($file['category'], 'consultant_') === 0)) {
                respond(403, null, 'Bạn không có quyền cập nhật tài liệu nhân sự (consultant_*)', false);
            }
        }

        $stmt = $this->db->prepare("
            UPDATE cloud_files 
            SET name = ?, category = ?, visibility = ?, project_id = ?, updated_by = ?
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$name, $category, $visibility, $project_id, $auth['user_id'], $id, $tid]);

        respond(200, null, 'Cập nhật thông tin tệp thành công');
    }

    public function destroy(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $tid = $auth['tenant_id'];
        
        // 1. Get file details first
        $stmt = $this->db->prepare("SELECT file_path, uploaded_by, category FROM cloud_files WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        $file = $stmt->fetch();
        
        if (!$file) respond(404, null, 'Không tìm thấy tệp tin', false);

        // Permission check: Only uploader or admin/manager
        if (in_array($auth['role'], ['sales', 'sale'], true)) {
            if ((int)$file['uploaded_by'] !== (int)$auth['user_id']) {
                respond(403, null, 'Bạn không có quyền xóa tệp tin của người khác', false);
            }
            if (strpos($file['category'], 'consultant_') === 0) {
                respond(403, null, 'Bạn không có quyền xóa tài liệu nhân sự (consultant_*)', false);
            }
        }
        $path = $file['file_path'];

        // 2. Delete from DB
        $this->db->prepare("DELETE FROM cloud_files WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);

        // 3. Delete from Disk
        $fullPath = dirname(__DIR__) . '/' . $path;
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }

        respond(200, null, 'Đã xóa tệp tin vĩnh viễn');
    }
}
