<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DATABASE MIGRATION: ADDING vector_norm TO ai_vector_cache ===\n\n";

$res = $conn->query("SHOW COLUMNS FROM ai_vector_cache LIKE 'vector_norm'");
if ($res && $res->num_rows > 0) {
    echo "Column 'vector_norm' already exists in 'ai_vector_cache'.\n";
} else {
    $alter = $conn->query("ALTER TABLE ai_vector_cache ADD COLUMN vector_norm DOUBLE DEFAULT 0.0");
    if ($alter) {
        echo "✅ Successfully added column 'vector_norm' to 'ai_vector_cache'!\n";
    } else {
        echo "❌ Failed to add column: " . $conn->error . "\n";
    }
}
