<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/../db_connect.php';

$_GET['action'] = 'get_dashboard_stats';
$_GET['date'] = '30 ngày qua';
$_GET['chart_mode'] = 'day';
$_GET['chart_metric'] = 'lead';
$_GET['token'] = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6OTk5LCJ1c2VyX2lkIjo5OTksImNvbnN1bHRhbnRfaWQiOm51bGwsInVzZXJuYW1lIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQHJpY2hsYW5kLm5ldCIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc4NTYwNDU2N30.-6EhVTeCFEAX-DoHcyyA3XP_g7AZzRd77WhfENkvpDM';

ob_start();
include __DIR__ . '/../api.php';
$output = ob_get_clean();

echo "=== API OUTPUT ===\n";
echo $output;

echo "\n\n=== GET_SETTINGS OUTPUT ===\n";
$_GET['action'] = 'get_settings';
ob_start();
include __DIR__ . '/../api.php';
$output2 = ob_get_clean();
echo $output2;
?>
