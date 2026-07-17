<?php
header('Content-Type: text/plain; charset=utf-8');
$logFile = ini_get('error_log');
echo "Error Log File Path: " . $logFile . "\n";
if ($logFile && file_exists($logFile)) {
    echo "=== LAST 30 LINES OF ERROR LOG ===\n";
    $lines = file($logFile);
    $lastLines = array_slice($lines, -30);
    foreach ($lastLines as $line) {
        echo $line;
    }
} else {
    echo "No error log file found or accessible at standard path.\n";
}
