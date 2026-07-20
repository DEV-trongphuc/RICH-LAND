<?php
header('Content-Type: text/plain; charset=utf-8');
$logFile = __DIR__ . '/error_log';
if (file_exists($logFile)) {
    $lines = file($logFile);
    $lastLines = array_slice($lines, -50);
    echo implode("", $lastLines);
} else {
    echo "No error log found.";
}
