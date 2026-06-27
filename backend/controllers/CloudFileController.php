<?php
class CloudFileController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $uid    = $auth['user_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $cat    = $_GET['category'] ?? '';

        $where = ["cf.tenant_id = ?", "(cf.visibility = 'shared' OR cf.uploaded_by = ?)"];
        $params = [$tid, $uid];

        if ($cat) {
            $where[] = "cf.category = ?";
            $params[] = $cat;
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM cloud_files cf WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT cf.*, u.full_name as uploader_name, u2.full_name as editor_name 
            FROM cloud_files cf
            LEFT JOIN users u ON cf.uploaded_by = u.id
            LEFT JOIN users u2 ON cf.updated_by = u2.id
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
        if (empty($_FILES['file'])) respond(422, null, 'Vui lòng chọn tệp tin để tải lên', false);
        
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) respond(500, null, 'Lỗi trong quá trình tải tệp lên server', false);

        // Security: Max file size 10MB
        if ($file['size'] > 10 * 1024 * 1024) respond(422, null, 'Dung lượng tệp tối đa cho phép là 10MB', false);

        // Security: Whitelist extensions
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg','jpeg','png','gif','pdf','doc','docx','xls','xlsx','ppt','pptx','txt','zip','rar','csv'];
        if (!in_array($ext, $allowed)) respond(422, null, "Định dạng tệp .$ext không được hỗ trợ", false);

        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $name = $_POST['name'] ?? $file['name'];
        $category = $_POST['category'] ?? 'general';
        $visibility = $_POST['visibility'] ?? 'shared';

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
            INSERT INTO cloud_files (tenant_id, uploaded_by, name, file_path, mime_type, file_size, category, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tid, $uid, $name,
            $dbPath, $file['type'], $file['size'],
            $category, $visibility
        ]);

        respond(201, ['id' => $this->db->lastInsertId(), 'path' => $dbPath], 'Đã tải tệp tin lên thành công');
    }

    public function destroy(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        
        // 1. Get file details first
        $stmt = $this->db->prepare("SELECT file_path, uploaded_by FROM cloud_files WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        $file = $stmt->fetch();
        
        if (!$file) respond(404, null, 'Không tìm thấy tệp tin', false);

        // Permission check: Only uploader or admin/manager
        if (in_array($auth['role'], ['sales', 'sale'], true) && (int)$file['uploaded_by'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn không có quyền xóa tệp tin của người khác', false);
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
