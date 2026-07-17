<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Mock server variables to prevent notices/errors
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_ORIGIN'] = 'http://localhost';
$_GET['action'] = 'login'; // Use public action so it doesn't try to parse token

require_once 'api.php';
echo "api.php loaded successfully\n";
