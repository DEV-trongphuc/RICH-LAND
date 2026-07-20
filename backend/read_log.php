<?php
header('Content-Type: text/plain; charset=utf-8');
$logPath = __DIR__ . '/telegram_webhook_log.txt';
if (!file_exists($logPath)) {
    echo "Log file not found.\n";
    exit;
}

$lines = file($logPath);
$lastLines = array_slice($lines, -50);
echo implode("", $lastLines);
