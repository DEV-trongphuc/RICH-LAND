<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/../db_connect.php';

$_GET['action'] = 'get_dashboard_stats';
$_GET['date'] = 'Tháng này';
$_GET['chart_mode'] = 'day';
$_GET['chart_metric'] = 'lead';
$_GET['token'] = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MTAwNywidXNlcl9pZCI6MTAwNywiY29uc3VsdGFudF9pZCI6bnVsbCwidXNlcm5hbWUiOiJtYW5hZ2VyIiwiZW1haWwiOiJtYW5hZ2VyQHJpY2hsYW5kLm5ldCIsInJvbGUiOiJtYW5hZ2VyIiwiZXhwIjoxNzg2ODQ0NzMxfQ.kJqY4nlA2_ihyRKn1uP23ACUHriJo6PTRCfgT66h5hQ';

include __DIR__ . '/../api.php';
