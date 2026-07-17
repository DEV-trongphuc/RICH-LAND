<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_ORIGIN'] = 'http://localhost';
$_GET['action'] = 'get_settings';
$_GET['token'] = 'demo_token_12345';

require_once 'api.php';
