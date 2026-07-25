<?php
require_once __DIR__ . '/test_bootstrap.php';
$apiKey = get_system_setting($conn, 'gemini_api_key');
echo "API Key length: " . strlen($apiKey) . "\n";
echo "API Key mask: " . substr($apiKey, 0, 5) . "..." . substr($apiKey, -5) . "\n";

$url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=" . $apiKey;
$payload = [
    'model' => 'models/text-embedding-004',
    'content' => ['parts' => [['text' => 'test']]]
];
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

echo "HTTP Code: " . $httpCode . "\n";
echo "cURL Error: " . $curlError . "\n";
echo "Response: " . $response . "\n";
