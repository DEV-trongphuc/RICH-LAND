<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_REQUEST['key'] ?? '') !== 'richland2026') {
    die("Unauthorized");
}

$output = [];
@exec('ps aux 2>&1', $output);
echo implode("\n", $output);
