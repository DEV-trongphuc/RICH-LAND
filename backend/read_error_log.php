<?php
header("Content-Type: text/plain; charset=utf-8");
$paths = [
    __DIR__ . '/error_log',
    __DIR__ . '/../error_log',
    '/home/vhvxoigh/open.domation.net/richland/error_log',
    '/home/vhvxoigh/open.domation.net/richland/backend/error_log',
];

foreach ($paths as $path) {
    if (file_exists($path)) {
        echo "=== LOG: $path ===\n";
        $lines = file($path);
        $last_lines = array_slice($lines, -100);
        echo implode("", $last_lines);
        echo "\n\n";
    }
}
echo "=== DIR LIST ===\n";
print_r(scandir(__DIR__));
echo "\n";
echo "Done checking all paths.";
