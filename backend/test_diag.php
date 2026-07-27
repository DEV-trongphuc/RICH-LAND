<?php
// backend/test_diag.php
error_reporting(E_ALL);
ini_set('display_errors', 1);
try {
    include __DIR__ . '/test_grab_lead.php';
} catch (Throwable $e) {
    echo "FATAL THROWABLE: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
