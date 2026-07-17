<?php
// scratch/check_api_error.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_HOST'] = 'localhost';

$_GET['action'] = 'get_settings';
$_GET['token'] = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MTAwMCwidXNlcl9pZCI6MTAwMCwiY29uc3VsdGFudF9pZCI6MTAwMCwidXNlcm5hbWUiOiJ0dXJuaW9kZXYiLCJlbWFpbCI6InR1cm5pb2RldkBnbWFpbC5jb20iLCJyb2xlIjoic2FsZSIsImV4cCI6MTc4Njg2OTI3Mn0.Dm6BbK9fIIDeHPAQdEBaJq2IKKSQei_2-BpjDctIFJA';

include __DIR__ . '/api.php';
