<?php
require_once __DIR__ . '/../test_bootstrap.php';
require_once __DIR__ . '/../utils/rag_helpers.php';

$apiKey = get_system_setting($conn, 'gemini_api_key');
$message = "học phí khóa học bao nhiêu";

echo "=== RAG PIPELINE PERFORMANCE DIAGNOSTIC ===\n\n";

// Ensure there is at least one chunk to search
$conn->query("INSERT INTO ai_training_docs (id, tenant_id, name, content, status, is_active) VALUES (9999, 1, 'Test Doc', 'Thông tin học phí khóa học là 10.000.000 VND một năm.', 'trained', 1) ON DUPLICATE KEY UPDATE status='trained'");
$conn->query("INSERT INTO ai_training_chunks (id, tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (99999, 1, 9999, 0, 'Thông tin học phí khóa học là 10.000.000 VND một năm.', '[0.01, 0.02]', 0.02236) ON DUPLICATE KEY UPDATE content=VALUES(content)");

// Clear previous cache for clean metrics
$cacheKey = md5('tenant_1|' . mb_strtolower(trim($message)));
$conn->query("DELETE FROM ai_rag_search_cache WHERE query_hash = '$cacheKey'");

// --- Run 1: Cache Miss ---
echo "--- Run 1: Cache Miss (Executing full Hybrid Search + RRF) ---\n";
$start1 = microtime(true);

// Replicate RAG context retrieval logic from ai_chat_handler.php
$ragContext = '';
$queryVector = generate_embedding($message, $apiKey);

if (!empty($queryVector)) {
    $cleanQuery = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $message);
    $queryWords = array_slice(array_filter(explode(' ', mb_strtolower($cleanQuery)), function ($w) {
        return mb_strlen($w) >= 2;
    }), 0, 10);
    $relaxedQuery = "";
    foreach ($queryWords as $w) {
        $relaxedQuery .= "$w* ";
    }
    $relaxedQuery = trim($relaxedQuery);

    $cStmt = $conn->prepare("
        (SELECT c.id, c.content, c.vector, c.vector_norm, d.name AS doc_name, d.tags, d.source_type, COALESCE(d.updated_at, d.created_at) as doc_updated_at,
            MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) as fts_score
        FROM ai_training_chunks c
        JOIN ai_training_docs d ON c.doc_id = d.id
        WHERE d.tenant_id = 1 AND d.is_active = 1 AND d.status = 'trained'
        ORDER BY fts_score DESC
        LIMIT 150)
        UNION
        (SELECT c.id, c.content, c.vector, c.vector_norm, d.name AS doc_name, d.tags, d.source_type, COALESCE(d.updated_at, d.created_at) as doc_updated_at,
            MATCH(c.content) AGAINST(? IN BOOLEAN MODE) as fts_score
        FROM ai_training_chunks c
        JOIN ai_training_docs d ON c.doc_id = d.id
        WHERE d.tenant_id = 1 AND d.is_active = 1 AND d.status = 'trained'
        ORDER BY fts_score DESC
        LIMIT 100)
    ");

    if ($cStmt) {
        $cStmt->bind_param("ss", $cleanQuery, $relaxedQuery);
        $cStmt->execute();
        $cRes = $cStmt->get_result();
        
        $similarityThreshold = 0.45;
        $topK = 5;

        $rawResults = [];
        while ($cRow = $cRes->fetch_assoc()) {
            $rawResults[] = $cRow;
        }
        $cStmt->close();

        $vectorScores = [];
        $normQ = 0.0;
        foreach ($queryVector as $val) {
            $normQ += $val * $val;
        }
        $normQ = sqrt($normQ);

        foreach ($rawResults as $row) {
            $id = $row['id'];
            $chunkVector = json_decode($row['vector'], true);
            $normB = (float)($row['vector_norm'] ?? 0.0);
            
            if (is_array($chunkVector) && $normB > 0.0 && $normQ > 0.0) {
                $dotProduct = 0.0;
                $dim = count($queryVector);
                for ($i = 0; $i < $dim; $i++) {
                    $dotProduct += $queryVector[$i] * $chunkVector[$i];
                }
                $sim = $dotProduct / ($normQ * $normB);
                $vectorScores[$id] = $sim;
            } else {
                $vectorScores[$id] = 0.0;
            }
        }

        // RRF sorting, rank & scoring
        $rankedByVector = $rawResults;
        uasort($rankedByVector, function ($a, $b) use ($vectorScores) {
            $scoreA = $vectorScores[$a['id']] ?? 0;
            $scoreB = $vectorScores[$b['id']] ?? 0;
            return $scoreB <=> $scoreA;
        });

        $rankedByKeyword = $rawResults;
        uasort($rankedByKeyword, function ($a, $b) {
            return $b['fts_score'] <=> $a['fts_score'];
        });

        $vectorRanks = [];
        $rankIdx = 1;
        foreach ($rankedByVector as $r) {
            $vectorRanks[$r['id']] = $rankIdx++;
        }

        $keywordRanks = [];
        $rankIdx = 1;
        foreach ($rankedByKeyword as $r) {
            $keywordRanks[$r['id']] = $rankIdx++;
        }

        $k = 60;
        $candidates = [];
        foreach ($rawResults as $row) {
            $id = $row['id'];
            $rankV = $vectorRanks[$id] ?? 999;
            $rankK = $keywordRanks[$id] ?? 999;
            $rrfScore = (1 / ($k + $rankV)) + (1 / ($k + $rankK));
            $finalScore = $rrfScore * 1800;

            $candidates[] = [
                'content' => $row['content'],
                'doc_name' => $row['doc_name'],
                'tags' => $row['tags'],
                'source_type' => $row['source_type'],
                'score' => $finalScore,
                'vector_score' => $vectorScores[$id] ?? 0.0
            ];
        }

        usort($candidates, function($a, $b) {
            return $b['score'] <=> $a['score'];
        });

        $selectedCandidates = array_slice($candidates, 0, $topK);
        if (!empty($selectedCandidates)) {
            $docsText = [];
            foreach ($selectedCandidates as $idx => $cand) {
                $docText = "Nguồn: " . $cand['doc_name'] . "\nNội dung: " . $cand['content'];
                $docsText[] = $docText;
            }
            $ragContext = implode("\n\n", $docsText);
        }
    }
}

if (!empty($ragContext)) {
    $stmt = $conn->prepare("INSERT INTO ai_rag_search_cache (query_hash, results) VALUES (?, ?) ON DUPLICATE KEY UPDATE results = ?");
    if ($stmt) {
        $stmt->bind_param("sss", $cacheKey, $ragContext, $ragContext);
        $stmt->execute();
        $stmt->close();
    }
}

$end1 = microtime(true);
$time1 = ($end1 - $start1) * 1000;
echo "Run 1 time: " . round($time1, 2) . " ms\n";
echo "Context retrieved:\n" . $ragContext . "\n\n";

// --- Run 2: Cache Hit ---
echo "--- Run 2: Cache Hit (Retrieving from ai_rag_search_cache) ---\n";
$start2 = microtime(true);

$ragContext2 = '';
$stmt = $conn->prepare("SELECT results FROM ai_rag_search_cache WHERE query_hash = ? AND created_at > (NOW() - INTERVAL 7 DAY) LIMIT 1");
if ($stmt) {
    $stmt->bind_param("s", $cacheKey);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($res && !empty($res['results'])) {
        $ragContext2 = $res['results'];
    }
}

$end2 = microtime(true);
$time2 = ($end2 - $start2) * 1000;
echo "Run 2 time: " . round($time2, 2) . " ms\n";
echo "Context retrieved (cached):\n" . $ragContext2 . "\n\n";

// Cleanup test records
$conn->query("DELETE FROM ai_training_chunks WHERE id = 99999");
$conn->query("DELETE FROM ai_training_docs WHERE id = 9999");
$conn->query("DELETE FROM ai_rag_search_cache WHERE query_hash = '$cacheKey'");

echo "Diagnostic finished.\n";
