<?php
// backend/debug_syntax.php
header('Content-Type: text/plain; charset=utf-8');

$output = [];
$returnVar = 0;
exec('php -l ' . escapeshellarg(__DIR__ . '/zalo_webhook.php') . ' 2>&1', $output, $returnVar);

echo "PHP Lint Exit Code: $returnVar\n";
echo implode("\n", $output) . "\n\n";

$_SERVER['HTTP_X_BOT_API_SECRET_TOKEN'] = 'richlandvietnam-1808';
ob_start();
include __DIR__ . '/zalo_webhook.php';
$out = ob_get_clean();

echo "Execution Output:\n$out\n";
