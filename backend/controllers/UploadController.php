<?php
class UploadController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function handle(array $auth): void {
        $tid = $auth['tenant_id'];
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'DELETE' || (isset($_GET['_method']) && $_GET['_method'] === 'DELETE')) {
            $b = getBody();
            $fileUrl = $b['file_url'] ?? $_GET['file_url'] ?? null;
            if ($fileUrl && deleteServerFile($fileUrl)) {
                respond(200, null, 'Đã xóa tệp tin thành công khỏi hệ thống');
            }
            respond(200, null, 'Không tìm thấy tệp hoặc đã được xóa trước đó');
        }

        $fileKey = isset($_FILES['file']) ? 'file' : (isset($_FILES['avatar']) ? 'avatar' : null);
        if (!$fileKey) {
            respond(400, null, 'Không có file nào được tải lên');
        }

        $file = $_FILES[$fileKey];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(500, null, 'Lỗi upload file: ' . $file['error']);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $blockedExts = [
            'php', 'php3', 'php4', 'php5', 'phtml', 
            'js', 'ts', 'py', 'pl', 'sh', 'cgi', 'rb', 'go', 'c', 'cpp', 'java', 'h', 'cs', 'swift', 'kt', 'rs',
            'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'wsf', 'ps1', 'jar', 'apk'
        ];

        if (in_array($ext, $blockedExts)) {
            respond(400, null, 'Định dạng file không hỗ trợ hoặc không an toàn');
        }

        // Limit size to 10MB
        if ($file['size'] > 10 * 1024 * 1024) {
            respond(400, null, 'Dung lượng file quá lớn (tối đa 10MB)');
        }

        // Tenant-isolated storage directory
        $uploadDirBase = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/../uploads');
        $storageDir = $uploadDirBase . "/tenant_{$tid}/";
        if (!is_dir($storageDir)) {
            mkdir($storageDir, 0755, true);
        }

        $filename = uniqid('img_', true) . '.' . $ext;
        $targetPath = $storageDir . $filename;

        require_once __DIR__ . '/../config/ImageHelper.php';
        $res = ImageHelper::saveUploadedFile($file['tmp_name'], $targetPath, $file['name']);

        if ($res['success']) {
            $savedFilename = $res['filename'];
            // Delete old file if requested
            $oldUrl = $_POST['previous_url'] ?? $_GET['previous_url'] ?? null;
            if ($oldUrl) {
                deleteServerFile($oldUrl);
            }

            // Return relative URL
            $url = "uploads/tenant_{$tid}/" . $savedFilename;
            respond(200, ['url' => $url], 'Tải lên thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên server');
        }
    }
}
