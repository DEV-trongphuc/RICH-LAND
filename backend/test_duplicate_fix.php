<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

$leadId = 4606;
$phone = '0905607463';
$email = 'sabiramahoian@gmail.com';

echo "=== TESTING DUPLICATE CHECK FOR LEAD 4606 ===\n";
$res = checkCRMInteraction($conn, $phone, $email, false, $leadId);
print_r($res);
?>
