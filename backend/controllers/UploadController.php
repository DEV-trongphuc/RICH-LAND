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
            $uploadDirBase = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/../uploads');
            if ($fileUrl && (strpos($fileUrl, "uploads/tenant_{$tid}/") !== false || strpos($fileUrl, "storage/uploads/tenant_{$tid}/") !== false)) {
                $storageDir = $uploadDirBase . "/tenant_{$tid}/";
                $filename = basename($fileUrl);
                $filePath = $storageDir . $filename;
                if (file_exists($filePath) && is_file($filePath)) {
                    unlink($filePath);
                    respond(200, null, 'Đã xóa tệp tin thành công khỏi hệ thống');
                }

                // Fallback for old storage dir just in case
                $oldStorageDir = __DIR__ . "/../storage/uploads/tenant_{$tid}/";
                $oldFilePath = $oldStorageDir . $filename;
                if (file_exists($oldFilePath) && is_file($oldFilePath)) {
                    unlink($oldFilePath);
                    respond(200, null, 'Đã xóa tệp tin thành công khỏi hệ thống (thư mục cũ)');
                }
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

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            // Delete old file if requested (strictly within tenant dir)
            $oldUrl = $_POST['previous_url'] ?? null;
            if ($oldUrl && (strpos($oldUrl, "/uploads/tenant_{$tid}/") !== false || strpos($oldUrl, "/storage/uploads/tenant_{$tid}/") !== false)) {
                $oldFilename = basename($oldUrl);
                $oldPath = $storageDir . $oldFilename;
                if (file_exists($oldPath) && is_file($oldPath)) {
                    unlink($oldPath);
                }

                $oldStorageDir = __DIR__ . "/../storage/uploads/tenant_{$tid}/";
                $oldFilePath = $oldStorageDir . $oldFilename;
                if (file_exists($oldFilePath) && is_file($oldFilePath)) {
                    unlink($oldFilePath);
                }
            }

            // Return relative URL
            $url = "uploads/tenant_{$tid}/" . $filename;
            respond(200, ['url' => $url], 'Tải lên thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên server');
        }
    }
}
