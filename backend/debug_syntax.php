<?php
// backend/debug_syntax.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "Testing syntax of zalo_webhook.php:\n";

try {
    include_once __DIR__ . '/zalo_webhook.php';
    echo "Included successfully without fatal syntax error.\n";
} catch (Throwable $t) {
    echo "EXCEPTION CATCH: " . $t->getMessage() . " in " . $t->getFile() . " line " . $t->getLine() . "\n";
    echo $t->getTraceAsString();
}
