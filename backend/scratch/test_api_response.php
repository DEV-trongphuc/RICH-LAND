<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../config/JWT.php';

$token = JWT::encode([
    'user_id' => 1,
    'email' => 'admin@richland.com',
    'role' => 'admin',
    'tenant_id' => 1
], JWT_SECRET);

$_GET['action'] = 'get_calendar_day_details';
$_GET['date'] = '2026-07-17';
$_GET['consultant'] = 'all';
$_GET['token'] = $token;
$action = 'get_calendar_day_details';

// Include api.php
ob_start();
try {
    include __DIR__ . '/../api.php';
} catch (Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n";
}
$output = ob_get_clean();

echo "API response:\n";
echo $output . "\n";
