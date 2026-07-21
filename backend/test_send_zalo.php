<?php
// backend/test_send_zalo.php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$botToken = get_system_setting($conn, 'zalo_bot_token');
$chatId = '17a44cab94e07dbe24f1';

echo "Bot Token: $botToken\n";
echo "Target ChatId: $chatId\n\n";

$url = "https://bot-api.zaloplatforms.com/bot" . $botToken . "/sendMessage";
$payload = json_encode([
    "chat_id" => $chatId,
    "text" => "Test message from Rich Land system at " . date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json; charset=utf-8'));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Curl Error: $curlErr\n";
echo "Zalo API Response:\n$result\n";
