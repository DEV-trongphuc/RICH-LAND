<?php
// backend/check_zalo_webhook_info.php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$botToken = get_system_setting($conn, 'zalo_bot_token');
$secretToken = get_system_setting($conn, 'zalo_webhook_secret');

echo "Bot Token: $botToken\n";
echo "Current Secret Token in DB: $secretToken\n\n";

// 1. Get Webhook Info
$urlGet = "https://bot-api.zaloplatforms.com/bot" . $botToken . "/getWebhookInfo";
$ch = curl_init($urlGet);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$resGet = curl_exec($ch);
$httpGet = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "=== getWebhookInfo ===\n";
echo "HTTP: $httpGet\n";
echo "Response: $resGet\n\n";

// 2. Re-set Webhook URL to ensure fresh subscription
$targetWebhookUrl = 'https://open.domation.net/richland/zalo_webhook.php';
$urlSet = "https://bot-api.zaloplatforms.com/bot" . $botToken . "/setWebhook";
$payloadSet = json_encode([
    'url' => $targetWebhookUrl,
    'secret_token' => $secretToken
], JSON_UNESCAPED_UNICODE);

$chSet = curl_init($urlSet);
curl_setopt($chSet, CURLOPT_POSTFIELDS, $payloadSet);
curl_setopt($chSet, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($chSet, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chSet, CURLOPT_TIMEOUT, 10);
curl_setopt($chSet, CURLOPT_SSL_VERIFYPEER, false);
$resSet = curl_exec($chSet);
$httpSet = curl_getinfo($chSet, CURLINFO_HTTP_CODE);
curl_close($chSet);

echo "=== setWebhook ($targetWebhookUrl) ===\n";
echo "HTTP: $httpSet\n";
echo "Response: $resSet\n";
