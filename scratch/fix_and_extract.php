<?php
header('Content-Type: application/json; charset=utf-8');
set_time_limit(300);

// 1. Dọn dẹp các file có dấu gạch chéo ngược \ trong thư mục gốc
$files = scandir(__DIR__);
$removedCount = 0;
foreach ($files as $f) {
    if (strpos($f, '\\') !== false) {
        @unlink(__DIR__ . '/' . $f);
        $removedCount++;
    }
}

// 2. Nếu có release.zip, giải nén chuẩn hóa /
$zipFile = __DIR__ . '/release.zip';
$extractedCount = 0;
if (file_exists($zipFile)) {
    $zip = new ZipArchive();
    if ($zip->open($zipFile) === TRUE) {
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entryName = $zip->getNameIndex($i);
            $normalized = str_replace('\\', '/', $entryName);
            $targetPath = __DIR__ . '/' . $normalized;
            
            if (substr($normalized, -1) === '/') {
                if (!is_dir($targetPath)) {
                    mkdir($targetPath, 0755, true);
                }
            } else {
                $dir = dirname($targetPath);
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                file_put_contents($targetPath, $zip->getFromIndex($i));
                $extractedCount++;
            }
        }
        $zip->close();
        @unlink($zipFile);
    }
}

echo json_encode([
    "status" => "success",
    "removed_backslash_files" => $removedCount,
    "extracted_files" => $extractedCount,
    "has_backend_api" => file_exists(__DIR__ . '/backend/api.php'),
    "has_index_html" => file_exists(__DIR__ . '/index.html')
], JSON_PRETTY_PRINT);
