<?php
// backend/config/ImageHelper.php

class ImageHelper {
    /**
     * Save uploaded file to target destination, converting standard raster images (JPG/PNG/BMP) to WebP format automatically with compression & max dimension resizing (max 1920px).
     * 
     * @param string $tmpPath Source temporary file path ($_FILES['file']['tmp_name'])
     * @param string $targetPath Destination file path
     * @param string $origFilename Original file name
     * @param int $quality WebP compression quality (default 80)
     * @param int $maxDimension Max width or height in pixels (default 1920)
     * @return array ['success' => bool, 'path' => string, 'filename' => string, 'is_webp' => bool]
     */
    public static function saveUploadedFile(string $tmpPath, string $targetPath, string $origFilename, int $quality = 80, int $maxDimension = 1920): array {
        $dir = dirname($targetPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $ext = strtolower(pathinfo($origFilename, PATHINFO_EXTENSION));

        // Convert standard raster images to WebP with compression and resizing
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'bmp', 'webp']) && function_exists('imagewebp') && function_exists('imagecreatefromstring')) {
            try {
                $raw = @file_get_contents($tmpPath);
                if ($raw) {
                    $img = @imagecreatefromstring($raw);
                    if ($img) {
                        $origWidth = imagesx($img);
                        $origHeight = imagesy($img);

                        // Calculate new dimensions if image exceeds maxDimension
                        $newWidth = $origWidth;
                        $newHeight = $origHeight;
                        if ($origWidth > $maxDimension || $origHeight > $maxDimension) {
                            if ($origWidth > $origHeight) {
                                $newWidth = $maxDimension;
                                $newHeight = (int)round(($origHeight * $maxDimension) / $origWidth);
                            } else {
                                $newHeight = $maxDimension;
                                $newWidth = (int)round(($origWidth * $maxDimension) / $origHeight);
                            }
                        }

                        // Create truecolor canvas for resized image
                        $canvas = imagecreatetruecolor($newWidth, $newHeight);
                        
                        // Preserve transparency for PNG and WebP
                        imagealphablending($canvas, false);
                        imagesavealpha($canvas, true);
                        $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
                        imagefilledrectangle($canvas, 0, 0, $newWidth, $newHeight, $transparent);

                        imagecopyresampled($canvas, $img, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);

                        // Change extension in target path to .webp
                        $webpPath = preg_replace('/\.[^.]+$/', '', $targetPath) . '.webp';

                        $saved = @imagewebp($canvas, $webpPath, $quality);
                        imagedestroy($canvas);
                        imagedestroy($img);

                        if ($saved && file_exists($webpPath) && filesize($webpPath) > 0) {
                            @unlink($tmpPath);
                            return [
                                'success' => true,
                                'path' => $webpPath,
                                'filename' => basename($webpPath),
                                'is_webp' => true
                            ];
                        }
                    }
                }
            } catch (\Throwable $ex) {
                error_log("ImageHelper WebP error: " . $ex->getMessage());
            }
        }

        // Fallback: move file as-is for documents (PDF, Word, Excel) or if GD missing
        $success = @move_uploaded_file($tmpPath, $targetPath);
        return [
            'success' => $success,
            'path' => $targetPath,
            'filename' => basename($targetPath),
            'is_webp' => ($ext === 'webp')
        ];
    }
}
