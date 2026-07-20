<?php
header('Content-Type: application/json; charset=utf-8');

$payload = [
    "update_id" => 123456789,
    "message" => [
        "message_id" => 999,
        "from" => [
            "id" => 7834122759,
            "is_bot" => false,
            "first_name" => "Ki",
            "last_name" => "DEV",
            "username" => "Opierasara"
        ],
        "chat" => [
            "id" => 7834122759,
            "first_name" => "Ki",
            "last_name" => "DEV",
            "type" => "private"
        ],
        "date" => time(),
        "text" => "1000"
    ]
];

$ch = curl_init("https://open.domation.net/richland/telegram_webhook.php");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo json_encode([
    "http_code" => $httpCode,
    "response" => json_decode($response, true) ?? $response
], JSON_PRETTY_PRINT);
