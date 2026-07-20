<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "=== CHECKING SYNTAX ===\n";
$target = __DIR__ . '/telegram_webhook.php';
echo "Target path: " . $target . "\n";
echo "Exists: " . (file_exists($target) ? 'YES' : 'NO') . "\n";
if (file_exists($target)) {
    include $target;
}
echo "\n=== END SYNTAX CHECK ===\n";
exit;
echo "Done checking all paths.";
