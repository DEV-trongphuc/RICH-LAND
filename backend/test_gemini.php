<?php
require_once __DIR__ . '/test_bootstrap.php';
$apiKey = get_system_setting($conn, 'gemini_api_key');

// Test 1: Single Embedding
echo "--- Testing Single Embedding ---\n";
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=" . $apiKey;
$payload = [
    'model' => 'models/gemini-embedding-001',
    'content' => ['parts' => [['text' => 'Rich Land bất động sản']]]
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
curl_close($ch);

echo "HTTP Code: " . $httpCode . "\n";
$resJson = json_decode($response, true);
$emb = $resJson['embedding']['values'] ?? null;
echo "Embedding values count: " . (is_array($emb) ? count($emb) : 0) . "\n";
if (empty($emb)) {
    echo "Response: " . $response . "\n";
}

// Test 2: Batch Embedding
echo "\n--- Testing Batch Embedding ---\n";
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=" . $apiKey;
$payload = [
    'requests' => [
        [
            'model' => 'models/gemini-embedding-001',
            'content' => ['parts' => [['text' => 'Căn 1']]]
        ],
        [
            'model' => 'models/gemini-embedding-001',
            'content' => ['parts' => [['text' => 'Căn 2']]]
        ]
    ]
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
curl_close($ch);

echo "HTTP Code: " . $httpCode . "\n";
$resJson = json_decode($response, true);
$embs = $resJson['embeddings'] ?? null;
echo "Batch Embedding count: " . (is_array($embs) ? count($embs) : 0) . "\n";
if (empty($embs)) {
    echo "Response: " . $response . "\n";
}

