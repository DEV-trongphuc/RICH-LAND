<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$botToken = get_system_setting($conn, 'telegram_bot_token') ?: '';
if (empty($botToken)) {
    echo "Telegram Bot Token not configured in system settings.\n";
    exit;
}

$url = "https://api.telegram.org/bot{$botToken}/getWebhookInfo";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
curl_close($ch);

echo "Webhook Info:\n";
echo json_encode(json_decode($res), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
