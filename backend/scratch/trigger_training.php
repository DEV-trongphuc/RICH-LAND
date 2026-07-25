<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../test_bootstrap.php';
require_once __DIR__ . '/../utils/rag_helpers.php';

echo "=== MANUAL TRAINING TRIGGER FOR DOCUMENT ID 2 ===\n\n";

$id = 2;
$apiKey = get_system_setting($conn, 'gemini_api_key');
echo "Gemini API Key length: " . strlen($apiKey) . "\n";

$chunkSize = 700;
$chunkOverlap = 150;

// Fetch document
$stmt = $conn->prepare("SELECT * FROM ai_training_docs WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$doc = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$doc) {
    echo "Document not found!\n";
    exit;
}

echo "Found document: " . $doc['name'] . "\n";
echo "Doc content snippet: " . substr($doc['content'], 0, 100) . "\n";

$rawText = $doc['content'];

// Delete existing chunks for this doc first to prevent duplication
$conn->query("DELETE FROM ai_training_chunks WHERE doc_id = $id");

// Chunk text
$chunks = chunk_text($rawText, $chunkSize, $chunkOverlap);
echo "Split into " . count($chunks) . " chunks.\n";

// Generate embeddings in batches of 100 and save chunks
$hasError = false;
$chunkBatches = array_chunk($chunks, 100);

foreach ($chunkBatches as $batchIdx => $batchChunks) {
    $batchChunks = array_values(array_filter(array_map('trim', $batchChunks)));
    if (empty($batchChunks)) continue;

    echo "Generating embeddings for batch of " . count($batchChunks) . " chunks...\n";
    $vectors = generate_batch_embeddings($batchChunks, $apiKey);

    if (empty($vectors) || count($vectors) !== count($batchChunks)) {
        echo "Error: generate_batch_embeddings failed or dimension mismatch!\n";
        $hasError = true;
        break;
    }

    foreach ($batchChunks as $idx => $chunk) {
        $vector = $vectors[$idx];
        if ($vector === null) {
            echo "Error: Vector at index $idx is null!\n";
            $hasError = true;
            break;
        }
        $vectorJson = json_encode($vector);
        $chunkIndex = ($batchIdx * 100) + $idx;

        // Calculate vector norm
        $vectorNorm = 0.0;
        if (is_array($vector)) {
            foreach ($vector as $v) {
                $vectorNorm += $v * $v;
            }
            $vectorNorm = sqrt($vectorNorm);
        }

        $cStmt = $conn->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, ?)");
        if ($cStmt) {
            $cStmt->bind_param("iisssd", $id, $chunkIndex, $chunk, $vectorJson, $vectorNorm);
            $cStmt->execute();
            $cStmt->close();
            echo "Saved chunk #$chunkIndex with norm $vectorNorm\n";
        }
    }
    if ($hasError) break;
}

if ($hasError) {
    echo "❌ Training failed!\n";
} else {
    $conn->query("UPDATE ai_training_docs SET status = 'trained' WHERE id = $id");
    echo "✅ Training completed successfully!\n";
}
