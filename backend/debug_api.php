<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$_GET = [
    'action' => 'invoices',
    'token' => 'demo_token_sale_1'
];
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/backend/invoices';
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer demo_token_sale_1';

require __DIR__ . '/api.php';
