<?php
header("Content-Type: text/plain; charset=utf-8");

$url = "https://open.domation.net/richland/telegram_webhook.php";
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
        "text" => "/id"
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json"
]);
$res = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP CODE: $httpCode\n";
echo "RESPONSE:\n$res\n";
