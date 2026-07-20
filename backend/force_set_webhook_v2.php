<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

// Cố gắng reset opcache để xóa mọi file cũ
if (function_exists('opcache_reset')) {
    @opcache_reset();
}

$stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'telegram_bot_token' LIMIT 1");
$botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

if (empty($botToken)) {
    echo json_encode(["error" => "Bot token is empty"]);
    exit;
}

// Đường dẫn đúng trên server production (không có /backend/ do tar giải nén)
$webhookUrl = "https://open.domation.net/richland/telegram_webhook.php";
$url = "https://api.telegram.org/bot{$botToken}/setWebhook?url=" . urlencode($webhookUrl);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo json_encode([
    "bot_token_configured" => !empty($botToken),
    "target_webhook_url" => $webhookUrl,
    "response" => json_decode($response, true),
    "http_code" => $httpCode
], JSON_PRETTY_PRINT);
