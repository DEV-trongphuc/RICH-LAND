<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../config/JWT.php';

$token = JWT::encode([
    'user_id' => 999,
    'email' => 'admin@richland.com',
    'role' => 'admin',
    'tenant_id' => 1
], JWT_SECRET);

$_GET['action'] = 'get_dashboard_stats';
$_GET['date'] = 'Tháng này';
$_GET['chart_mode'] = 'day';
$_GET['chart_metric'] = 'lead';
$_GET['token'] = $token;
$action = 'get_dashboard_stats';

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
