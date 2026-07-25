<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DIAGNOSTIC: VERIFYING EMBEDDING VECTORS IN DATABASE ===\n\n";

// 1. Find the document "Dịch vụ Rich Land"
$dStmt = $conn->prepare("SELECT id, name, status FROM ai_training_docs WHERE name LIKE '%Dịch vụ Rich Land%' LIMIT 1");
if ($dStmt) {
    $dStmt->execute();
    $doc = $dStmt->get_result()->fetch_assoc();
    $dStmt->close();
}

if (!$doc) {
    echo "❌ [ERROR] Document 'Dịch vụ Rich Land' not found in database.\n";
    exit;
}

echo "✅ [FOUND] Document ID: " . $doc['id'] . " | Name: " . $doc['name'] . " | Status: " . $doc['status'] . "\n\n";

// DEBUG: Check all chunk counts in table
echo "--- DB Table Stats ---\n";
$stats = $conn->query("SELECT doc_id, COUNT(*) as cnt FROM ai_training_chunks GROUP BY doc_id");
if ($stats) {
    while ($row = $stats->fetch_assoc()) {
        echo "Doc ID: " . $row['doc_id'] . " | Chunks Count: " . $row['cnt'] . "\n";
    }
}
echo "----------------------\n\n";

// 2. Fetch chunks belonging to this document
$cStmt = $conn->prepare("SELECT id, chunk_index, content, vector, vector_norm FROM ai_training_chunks WHERE doc_id = ? ORDER BY chunk_index ASC");
if ($cStmt) {
    $cStmt->bind_param("i", $doc['id']);
    $cStmt->execute();
    $res = $cStmt->get_result();
    
    $count = 0;
    while ($row = $res->fetch_assoc()) {
        $count++;
        echo "--- Chunk #" . $row['chunk_index'] . " (ID: " . $row['id'] . ") ---\n";
        echo "📝 Content snippet: " . mb_substr($row['content'], 0, 80) . "...\n";
        
        $vectorArr = json_decode($row['vector'], true);
        if (is_array($vectorArr)) {
            echo "📐 Vector dimensions: " . count($vectorArr) . " (Standard Gemini dimension)\n";
            echo "📊 First 5 values: [" . implode(", ", array_slice($vectorArr, 0, 5)) . ", ...]\n";
        } else {
            echo "❌ [ERROR] Vector is empty or not valid JSON string.\n";
        }
        
        echo "📏 Pre-calculated Vector Norm: " . $row['vector_norm'] . "\n\n";
    }
    $cStmt->close();
    
    if ($count === 0) {
        echo "❌ [ERROR] No chunks found for this document.\n";
    } else {
        echo "📊 Total chunks found: " . $count . "\n";
    }
}
