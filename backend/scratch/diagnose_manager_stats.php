<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/../db_connect.php';

$_GET['action'] = 'get_dashboard_stats';
$_GET['date'] = 'Tháng này';
$_GET['chart_mode'] = 'day';
$_GET['chart_metric'] = 'lead';
$_GET['token'] = 'demo_token_manager';

ob_start();
include __DIR__ . '/../api.php';
$output = ob_get_clean();

echo "=== API OUTPUT ===\n";
echo $output;
?>
