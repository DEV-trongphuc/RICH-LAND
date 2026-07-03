<?php
class UploadController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function handle(array $auth): void {
        $tid = $auth['tenant_id'];
        $fileKey = isset($_FILES['file']) ? 'file' : (isset($_FILES['avatar']) ? 'avatar' : null);
        if (!$fileKey) {
            respond(400, null, 'Không có file nào được tải lên');
        }

        $file = $_FILES[$fileKey];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(500, null, 'Lỗi upload file: ' . $file['error']);
        }

        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $allowedTypes) || !in_array($ext, $allowedExts)) {
            respond(400, null, 'Định dạng file không hỗ trợ hoặc không an toàn');
        }

        // Limit size to 2MB
        if ($file['size'] > 2 * 1024 * 1024) {
            respond(400, null, 'Dung lượng file quá lớn (tối đa 2MB)');
        }

        // Tenant-isolated storage directory
        $storageDir = __DIR__ . "/../storage/uploads/tenant_{$tid}/";
        if (!is_dir($storageDir)) {
            mkdir($storageDir, 0755, true);
        }

        $filename = uniqid('img_', true) . '.' . $ext;
        $targetPath = $storageDir . $filename;

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            // Delete old file if requested (strictly within tenant dir)
            $oldUrl = $_POST['previous_url'] ?? null;
            if ($oldUrl && strpos($oldUrl, "/storage/uploads/tenant_{$tid}/") !== false) {
                $oldFilename = basename($oldUrl);
                $oldPath = $storageDir . $oldFilename;
                if (file_exists($oldPath) && is_file($oldPath)) {
                    unlink($oldPath);
                }
            }

            // Return relative URL
            $url = "/backend/storage/uploads/tenant_{$tid}/" . $filename;
            respond(200, ['url' => $url], 'Tải lên thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên server');
        }
    }
}
