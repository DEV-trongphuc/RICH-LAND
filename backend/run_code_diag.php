<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Mock the environment to simulate get_reports request
$_GET['action'] = 'get_reports';
$_GET['status'] = 'pending';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_X_AUTH_TOKEN'] = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MTAwNiwidXNlcl9pZCI6MTAwNiwiY29uc3VsdGFudF9pZCI6bnVsbCwidXNlcm5hbWUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AcmljaGxhbmQubmV0Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzg2NzgyMTc4fQ.KTptJDIzFeyWxThwa6zlG9NEGw6VrenbD2xxMCbqBGs';

echo "Simulating get_reports api.php request...\n";

try {
    require 'api.php';
} catch (Throwable $e) {
    echo "ERROR CAUGHT: " . $e->getMessage() . "\n";
    echo "TRACE:\n" . $e->getTraceAsString() . "\n";
}
