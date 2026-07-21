<?php
// backend/read_logs.php
header('Content-Type: text/plain; charset=utf-8');

if (isset($_GET['clear'])) {
    file_put_contents(__DIR__ . '/zalo_send_log.txt', date('[Y-m-d H:i:s]') . " --- LOG RESET FOR RICHLAND ---\n");
    file_put_contents(__DIR__ . '/webhook_log.txt', date('[Y-m-d H:i:s]') . " --- LOG RESET FOR RICHLAND ---\n");
    echo "Logs cleared successfully.\n";
    exit;
}

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
