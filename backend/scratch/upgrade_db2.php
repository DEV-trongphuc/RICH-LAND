<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DATABASE UPGRADE & OPTIMIZATION MODULE ===\n\n";

// 1. Add vector_norm column to ai_training_chunks
$checkNorm = $conn->query("SHOW COLUMNS FROM ai_training_chunks LIKE 'vector_norm'");
if ($checkNorm && $checkNorm->num_rows > 0) {
    echo "Column 'vector_norm' already exists in ai_training_chunks.\n";
} else {
    echo "Adding column 'vector_norm' to ai_training_chunks...\n";
    $conn->query("ALTER TABLE ai_training_chunks ADD COLUMN `vector_norm` FLOAT DEFAULT 0");
    echo "Column 'vector_norm' added successfully.\n";
}

// 2. Create ai_vector_cache table
$checkVecCache = $conn->query("SHOW TABLES LIKE 'ai_vector_cache'");
if ($checkVecCache && $checkVecCache->num_rows > 0) {
    echo "Table 'ai_vector_cache' already exists.\n";
} else {
    echo "Creating table 'ai_vector_cache'...\n";
    $conn->query("CREATE TABLE IF NOT EXISTS `ai_vector_cache` (
        `hash` VARCHAR(32) PRIMARY KEY,
        `vector` LONGTEXT NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    echo "Table 'ai_vector_cache' created successfully.\n";
}

// 3. Create ai_rag_search_cache table
$checkRagCache = $conn->query("SHOW TABLES LIKE 'ai_rag_search_cache'");
if ($checkRagCache && $checkRagCache->num_rows > 0) {
    echo "Table 'ai_rag_search_cache' already exists.\n";
} else {
    echo "Creating table 'ai_rag_search_cache'...\n";
    $conn->query("CREATE TABLE IF NOT EXISTS `ai_rag_search_cache` (
        `query_hash` VARCHAR(32) PRIMARY KEY,
        `results` LONGTEXT NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    echo "Table 'ai_rag_search_cache' created successfully.\n";
}

echo "\n=== Database upgrade finished successfully! ===\n";
