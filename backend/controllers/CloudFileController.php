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
        try {
            $this->db->exec("ALTER TABLE cloud_files ADD COLUMN campaign_id INT NULL");
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
        $campaignId = $_GET['campaign_id'] ?? '';

        $role = $auth['role'] ?? '';
        $isSale = $role === 'sales' || $role === 'sale';
        $visibility = $_GET['visibility'] ?? 'shared';

        $where = ["cf.tenant_id = ?"];
        $params = [$tid];

        if ($visibility === 'personal') {
            $where[] = "cf.visibility = 'personal'";
            $where[] = "cf.uploaded_by = ?";
            $params[] = $uid;
        } else {
            $where[] = "(cf.visibility = 'shared' OR cf.visibility IS NULL OR cf.visibility = '')";
            if ($isSale) {
                $where[] = "(
                    cf.uploaded_by = ? 
                    OR (
                        cf.category NOT LIKE 'consultant_%' 
                        OR cf.category = ?
                    )
                )";
                $params[] = $uid;
                $params[] = 'consultant_' . $uid;
            }
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

        if ($campaignId !== '') {
            $where[] = "cf.campaign_id = ?";
            $params[] = (int)$campaignId;
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM cloud_files cf WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT cf.*, u.full_name as uploader_name, u2.full_name as editor_name, p.name as project_name, mc.name as campaign_name
            FROM cloud_files cf
            LEFT JOIN users u ON cf.uploaded_by = u.id
            LEFT JOIN users u2 ON cf.updated_by = u2.id
            LEFT JOIN projects p ON cf.project_id = p.id
            LEFT JOIN marketing_campaigns mc ON cf.campaign_id = mc.id
            WHERE $w
            ORDER BY cf.created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        
        $sumStmt = $this->db->prepare("SELECT SUM(file_size) FROM cloud_files WHERE tenant_id = ?");
        $sumStmt->execute([$tid]);
        $totalSizeBytes = (int)$sumStmt->fetchColumn();

        respond(200, [
            'items' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_size_bytes' => $totalSizeBytes
        ]);
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        
        $b = getBody();
        $category = $_POST['category'] ?? $b['category'] ?? 'general';
        if (in_array($auth['role'], ['sales', 'sale'], true) && strpos($category, 'consultant_') === 0) {
            if ($category !== 'consultant_' . $auth['user_id']) {
                respond(403, null, 'Bạn không có quyền tải lên tài liệu nhân sự của người khác (consultant_*)', false);
            }
        }

        if (empty($_FILES['file'])) respond(422, null, 'Vui lòng chọn tệp tin để tải lên', false);
        
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) respond(500, null, 'Lỗi trong quá trình tải tệp lên server', false);

        // Security: Max file size 10MB
        if ($file['size'] > 10 * 1024 * 1024) respond(422, null, 'Dung lượng tệp tối đa cho phép là 10MB', false);

        // Security: Blocklist extensions
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $blockedExts = [
            'php', 'php3', 'php4', 'php5', 'phtml', 
            'js', 'ts', 'py', 'pl', 'sh', 'cgi', 'rb', 'go', 'c', 'cpp', 'java', 'h', 'cs', 'swift', 'kt', 'rs',
            'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'wsf', 'ps1', 'jar', 'apk'
        ];
        if (in_array($ext, $blockedExts)) respond(422, null, "Định dạng tệp .$ext không được hỗ trợ hoặc không an toàn", false);

        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $name = $_POST['name'] ?? $file['name'];
        $visibility = $_POST['visibility'] ?? 'shared';
        $project_id = isset($_POST['project_id']) && $_POST['project_id'] !== '' ? (int)$_POST['project_id'] : null;
        $contact_id = isset($_POST['contact_id']) && $_POST['contact_id'] !== '' ? (int)$_POST['contact_id'] : null;
        $campaign_id = isset($_POST['campaign_id']) && $_POST['campaign_id'] !== '' ? (int)$_POST['campaign_id'] : null;

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
            INSERT INTO cloud_files (tenant_id, uploaded_by, name, file_path, mime_type, file_size, category, visibility, project_id, contact_id, campaign_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tid, $uid, $name,
            $dbPath, $file['type'], $file['size'],
            $category, $visibility, $project_id, $contact_id, $campaign_id
        ]);

        // Auto notification for contact document upload
        if ($contact_id) {
            $stmtOwner = $this->db->prepare("SELECT owner_id, CONCAT(first_name, ' ', COALESCE(last_name, '')) as contact_name FROM contacts WHERE id = ? AND tenant_id = ?");
            $stmtOwner->execute([$contact_id, $tid]);
            $contactInfo = $stmtOwner->fetch();
            if ($contactInfo) {
                $ownerId = (int)$contactInfo['owner_id'];
                $contactName = $contactInfo['contact_name'];
                
                // Get uploader name
                $uploaderName = 'Hệ thống';
                $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                $stmtUser->execute([$uid]);
                $uRow = $stmtUser->fetch();
                if ($uRow && !empty($uRow['full_name'])) {
                    $uploaderName = $uRow['full_name'];
                }

                $notifyUids = [];
                if ($ownerId > 0 && $ownerId !== $uid) {
                    $notifyUids[] = $ownerId;
                }
                
                // Also notify managers of the owner's team
                if ($ownerId > 0) {
                    $stmtMgr = $this->db->prepare("
                        SELECT leader_id FROM teams 
                        WHERE id = (SELECT team_id FROM users WHERE id = ?) 
                          AND leader_id IS NOT NULL 
                          AND leader_id != ?
                    ");
                    $stmtMgr->execute([$ownerId, $uid]);
                    $mgrId = $stmtMgr->fetchColumn();
                    if ($mgrId) {
                        $notifyUids[] = (int)$mgrId;
                    }
                }

                $notifyUids = array_unique($notifyUids);
                if (!empty($notifyUids)) {
                    $title = "Tài liệu khách hàng mới";
                    $body = "$uploaderName đã tải lên tài liệu mới \"$name\" cho khách hàng $contactName";
                    $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'contact_document', ?)");
                    foreach ($notifyUids as $nUid) {
                        $stmtNotif->execute([$nUid, $tid, $title, $body, "/contacts?open_contact_id=$contact_id"]);
                    }
                }
            }
        }

        // Auto notification for consultant document upload
        if (strpos($category, 'consultant_') === 0) {
            $targetUserId = (int) substr($category, strlen('consultant_'));
            if ($targetUserId > 0) {
                // Get uploader name
                $uploaderName = 'Hệ thống';
                $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                $stmtUser->execute([$uid]);
                $uRow = $stmtUser->fetch();
                if ($uRow && !empty($uRow['full_name'])) {
                    $uploaderName = $uRow['full_name'];
                }
                
                // Get target user details to verify
                $stmtTarget = $this->db->prepare("SELECT id FROM users WHERE id = ?");
                $stmtTarget->execute([$targetUserId]);
                $targetExists = $stmtTarget->fetch();
                if ($targetExists) {
                    $title = "Tài liệu nhân sự mới đã được tải lên";
                    if ($uid === $targetUserId) {
                        $body = "Bạn đã tải lên tài liệu mới: $name";
                    } else {
                        $body = "$uploaderName đã tải lên tài liệu mới cho bạn: $name";
                    }
                    
                    // Insert notification
                    $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'mention', ?)");
                    $stmtNotif->execute([$targetUserId, $tid, $title, $body, '/account']);
                }
            }
        }

        respond(201, ['id' => $this->db->lastInsertId(), 'path' => $dbPath], 'Đã tải tệp tin lên thành công');
    }

    public function update(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $b = getBody();
        
        $name = trim($b['name'] ?? '');
        $category = trim($b['category'] ?? 'general');
        $visibility = trim($b['visibility'] ?? 'shared');
        $project_id = isset($b['project_id']) && $b['project_id'] !== '' ? (int)$b['project_id'] : null;
        $campaign_id = isset($b['campaign_id']) && $b['campaign_id'] !== '' ? (int)$b['campaign_id'] : null;

        if (!$name) {
            respond(422, null, 'Tên tệp là bắt buộc', false);
        }

        // Permission check: Only uploader or admin/manager
        $checkStmt = $this->db->prepare("SELECT name, uploaded_by, category FROM cloud_files WHERE id = ? AND tenant_id = ?");
        $checkStmt->execute([$id, $tid]);
        $file = $checkStmt->fetch();
        if (!$file) respond(404, null, 'Không tìm thấy tệp tin', false);

        // Enforce original extension
        $origExt = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (!empty($origExt)) {
            $newExt = pathinfo($name, PATHINFO_EXTENSION);
            if (strtolower($newExt) !== strtolower($origExt)) {
                $name .= '.' . $origExt;
            }
        }

        if (in_array($auth['role'], ['sales', 'sale'], true)) {
            if ((int)$file['uploaded_by'] !== (int)$auth['user_id']) {
                respond(403, null, 'Bạn không có quyền sửa thông tin tệp tin của người khác', false);
            }
            if (
                (strpos($category, 'consultant_') === 0 && $category !== 'consultant_' . $auth['user_id']) || 
                ($file['category'] && strpos($file['category'], 'consultant_') === 0 && $file['category'] !== 'consultant_' . $auth['user_id'])
            ) {
                respond(403, null, 'Bạn không có quyền cập nhật tài liệu nhân sự (consultant_*)', false);
            }
        }

        $stmt = $this->db->prepare("
            UPDATE cloud_files 
            SET name = ?, category = ?, visibility = ?, project_id = ?, campaign_id = ?, updated_by = ?
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$name, $category, $visibility, $project_id, $campaign_id, $auth['user_id'], $id, $tid]);

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
            if (strpos($file['category'], 'consultant_') === 0 && $file['category'] !== 'consultant_' . $auth['user_id']) {
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
