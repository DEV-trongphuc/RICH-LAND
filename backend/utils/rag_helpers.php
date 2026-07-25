<?php
// backend/utils/rag_helpers.php

if (!function_exists('extract_pdf_text_via_gemini')) {
    function extract_pdf_text_via_gemini($filePath, $apiKey) {
        $fullPath = $_SERVER['DOCUMENT_ROOT'] . $filePath;
        if (!file_exists($fullPath)) {
            $fullPath = __DIR__ . '/../..' . $filePath;
            if (!file_exists($fullPath)) {
                $fullPath = __DIR__ . '/../' . $filePath;
            }
        }
        
        if (!file_exists($fullPath)) {
            error_log("extract_pdf_text_via_gemini: File not found at " . $fullPath);
            return "";
        }
        
        $data = file_get_contents($fullPath);
        if (empty($data)) {
            return "";
        }
        
        $base64 = base64_encode($data);
        $payload = [
            'contents' => [[
                'parts' => [
                    [
                        'inlineData' => [
                            'mimeType' => 'application/pdf',
                            'data' => $base64
                        ]
                    ],
                    [
                        'text' => 'Hãy trích xuất và trả về toàn bộ nội dung văn bản (text) tiếng Việt có trong tài liệu PDF này dưới dạng văn bản thô (raw text) đầy đủ nhất có thể. Không thêm bình luận, tiêu đề phụ, hay bất kỳ giải thích nào khác.'
                    ]
                ]
            ]],
            'generationConfig' => [
                'temperature' => 0.1
            ]
        ];

        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $apiKey;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $response = curl_exec($ch);
        curl_close($ch);

        if (!$response) return "";
        $resJson = json_decode($response, true);
        return $resJson['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }
}

if (!function_exists('fetch_web_content')) {
    function fetch_web_content($url) {
        $opts = [
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n",
                'timeout' => 15
            ]
        ];
        $context = stream_context_create($opts);
        $html = @file_get_contents($url, false, $context);
        if (empty($html)) return '';
        
        $html = preg_replace('/<script\b[^>]*>(.*?)<\/script>/is', '', $html);
        $html = preg_replace('/<style\b[^>]*>(.*?)<\/style>/is', '', $html);
        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }
}

if (!function_exists('chunk_text')) {
    function chunk_text($text, $chunkSize = 700, $chunkOverlap = 150) {
        $chunks = [];
        $text = trim($text);
        $length = mb_strlen($text, 'UTF-8');
        if ($length <= $chunkSize) {
            return [$text];
        }
        
        $start = 0;
        while ($start < $length) {
            $endIndex = min($start + $chunkSize, $length);
            $chunk = mb_substr($text, $start, $endIndex - $start, 'UTF-8');
            
            if ($endIndex === $length) {
                $chunks[] = trim($chunk);
                break;
            }
            
            // Search for a sentence punctuation boundary within the overlap lookback zone
            $lookbackZone = mb_substr($chunk, -$chunkOverlap, null, 'UTF-8');
            $lastPeriod = mb_strrpos($lookbackZone, '.');
            $lastExcl = mb_strrpos($lookbackZone, '!');
            $lastQuest = mb_strrpos($lookbackZone, '?');
            $lastNewline = mb_strrpos($lookbackZone, "\n");
            
            $boundaryPos = false;
            foreach ([$lastPeriod, $lastExcl, $lastQuest, $lastNewline] as $pos) {
                if ($pos !== false) {
                    if ($boundaryPos === false || $pos > $boundaryPos) {
                        $boundaryPos = $pos;
                    }
                }
            }
            
            if ($boundaryPos !== false) {
                // Adjust chunk end index to match sentence boundary (include the punctuation)
                $cutOffset = ($endIndex - $chunkOverlap) + $boundaryPos + 1;
                $chunk = mb_substr($text, $start, $cutOffset - $start, 'UTF-8');
                $chunks[] = trim($chunk);
                $start = $cutOffset;
            } else {
                // Fallback to word space boundary in lookback zone
                $lastSpace = mb_strrpos($lookbackZone, ' ');
                if ($lastSpace !== false) {
                    $cutOffset = ($endIndex - $chunkOverlap) + $lastSpace + 1;
                    $chunk = mb_substr($text, $start, $cutOffset - $start, 'UTF-8');
                    $chunks[] = trim($chunk);
                    $start = $cutOffset;
                } else {
                    // Force hard cut if no boundary or space is found
                    $chunks[] = trim($chunk);
                    $start += ($chunkSize - $chunkOverlap);
                }
            }
        }
        return array_values(array_filter($chunks));
    }
}

if (!function_exists('generate_embedding')) {
    function generate_embedding($text, $apiKey) {
        if (empty($text)) return null;

        // Try to fetch from local database cache first
        global $conn;
        $hash = md5('models/gemini-embedding-001|v1beta|' . mb_strtolower(trim($text)));
        if (isset($conn) && $conn instanceof mysqli) {
            $stmt = $conn->prepare("SELECT vector FROM ai_vector_cache WHERE hash = ? LIMIT 1");
            if ($stmt) {
                $stmt->bind_param("s", $hash);
                $stmt->execute();
                $res = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                if ($res && !empty($res['vector'])) {
                    $cachedVec = json_decode($res['vector'], true);
                    if (is_array($cachedVec)) {
                        return $cachedVec;
                    }
                }
            }
        }

        $payload = [
            'model' => 'models/gemini-embedding-001',
            'content' => [
                'parts' => [[
                    'text' => $text
                ]]
            ]
        ];

        // 1. Try v1beta models/gemini-embedding-001 first
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=" . $apiKey;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $response = curl_exec($ch);
        curl_close($ch);

        if (!$response) return null;
        $resJson = json_decode($response, true);
        
        // 2. Fallback to v1beta models/embedding-001 if gemini-embedding-001 is unavailable
        if (empty($resJson['embedding']['values'])) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=" . $apiKey;
            $payload['model'] = 'models/embedding-001';
            
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            $response = curl_exec($ch);
            curl_close($ch);
            
            if ($response) {
                $resJson = json_decode($response, true);
            }
        }
        
        $vectorValues = $resJson['embedding']['values'] ?? null;
        if (is_array($vectorValues) && !empty($vectorValues) && isset($conn) && $conn instanceof mysqli) {
            $vectorJson = json_encode($vectorValues);
            $stmt = $conn->prepare("INSERT INTO ai_vector_cache (hash, vector) VALUES (?, ?) ON DUPLICATE KEY UPDATE vector = ?");
            if ($stmt) {
                $stmt->bind_param("sss", $hash, $vectorJson, $vectorJson);
                $stmt->execute();
                $stmt->close();
            }
        }
        
        return $vectorValues;
    }
}

if (!function_exists('generate_batch_embeddings')) {
    function generate_batch_embeddings($texts, $apiKey) {
        if (empty($texts)) return [];
        $payload = [
            'requests' => []
        ];
        foreach ($texts as $text) {
            $payload['requests'][] = [
                'model' => 'models/gemini-embedding-001',
                'content' => [
                    'parts' => [['text' => $text]]
                ]
            ];
        }

        // 1. Try v1beta models/gemini-embedding-001:batchEmbedContents first
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=" . $apiKey;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $response = curl_exec($ch);
        curl_close($ch);

        $embeddings = [];
        if ($response) {
            $resJson = json_decode($response, true);
            if (isset($resJson['embeddings'])) {
                foreach ($resJson['embeddings'] as $emb) {
                    $embeddings[] = $emb['values'] ?? null;
                }
                return $embeddings;
            }
        }

        // 2. Fallback to v1beta models/embedding-001:batchEmbedContents if gemini-embedding-001 is unavailable
        $payload = [
            'requests' => []
        ];
        foreach ($texts as $text) {
            $payload['requests'][] = [
                'model' => 'models/embedding-001',
                'content' => [
                    'parts' => [['text' => $text]]
                ]
            ];
        }
        $url = "https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=" . $apiKey;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $resJson = json_decode($response, true);
            if (isset($resJson['embeddings'])) {
                foreach ($resJson['embeddings'] as $emb) {
                    $embeddings[] = $emb['values'] ?? null;
                }
            }
        }

        return $embeddings;
    }
}

if (!function_exists('cosine_similarity')) {
    function cosine_similarity($vec1, $vec2) {
        if (!is_array($vec1) || !is_array($vec2) || count($vec1) !== count($vec2)) {
            return 0.0;
        }
        $dotProduct = 0.0;
        $normA = 0.0;
        $normB = 0.0;
        $count = count($vec1);
        for ($i = 0; $i < $count; $i++) {
            $dotProduct += $vec1[$i] * $vec2[$i];
            $normA += $vec1[$i] * $vec1[$i];
            $normB += $vec2[$i] * $vec2[$i];
        }
        if ($normA == 0.0 || $normB == 0.0) {
            return 0.0;
        }
        return $dotProduct / (sqrt($normA) * sqrt($normB));
    }
}
