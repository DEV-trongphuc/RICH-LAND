<?php
// Mock user and consultant info
$_GET['sale_id'] = '1000'; // Nguyễn Hải Đăng consultant ID
$decodedUser = [
    'id' => 1000,
    'email' => 'dom.marketing.vn@gmail.com',
    'role' => 'sales' // sales role
];

// Include api logic but we will capture the output
ob_start();
$_GET['action'] = 'get_sale_portal_data';
require_once __DIR__ . '/api.php';
$output = ob_get_clean();

header('Content-Type: application/json; charset=utf-8');
echo $output;
