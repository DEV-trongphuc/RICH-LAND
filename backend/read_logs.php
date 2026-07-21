<?php
// backend/read_logs.php
header('Content-Type: text/plain; charset=utf-8');

$type = $_GET['type'] ?? 'webhook';
$file = __DIR__ . ($type === 'send' ? '/zalo_send_log.txt' : '/webhook_log.txt');

if (!file_exists($file)) {
    echo "File $file does not exist.\n";
    exit;
}

$size = filesize($file);
$fp = fopen($file, 'r');
if ($size > 20000) {
    fseek($fp, $size - 20000);
}
$content = fread($fp, 20000);
fclose($fp);

echo "=== LAST 20KB OF $file (Total Size: $size bytes) ===\n\n";
echo $content;
