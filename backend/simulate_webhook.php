<?php
// backend/simulate_webhook.php
header('Content-Type: text/plain; charset=utf-8');

$url = 'https://open.domation.net/richland/zalo_webhook.php';
$payload = json_encode([
    "event_name" => "message.text.received",
    "message" => [
        "date" => time() * 1000,
        "chat" => [
            "chat_type" => "PRIVATE",
            "id" => "17a44cab94e07dbe24f1"
        ],
        "message_id" => bin2hex(random_bytes(10)),
        "from" => [
            "id" => "17a44cab94e07dbe24f1",
            "is_bot" => false,
            "display_name" => "Phúc Hoàng"
        ],
        "text" => "1000"
    ]
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json; charset=utf-8',
    'X-Bot-Api-Secret-Token: richlandvietnam-1808'
));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $result\n";
