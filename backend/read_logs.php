<?php
// backend/read_logs.php
header('Content-Type: text/plain; charset=utf-8');

$type = $_GET['type'] ?? 'webhook';
$file = __DIR__ . ($type === 'send' ? '/zalo_send_log.txt' : '/webhook_log.txt');

if (!file_exists($file)) {
    echo "File $file does not exist.\n";
    exit;
}

$content = file_get_contents($file);
$lines = explode("\n", $content);
$lastLines = array_slice($lines, -50);
echo "=== LAST 50 LINES OF $file ===\n\n";
echo implode("\n", $lastLines);
