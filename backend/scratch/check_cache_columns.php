<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DIAGNOSTIC: SHOW COLUMNS FOR CACHE TABLES ===\n\n";

foreach (['ai_vector_cache', 'ai_rag_search_cache'] as $table) {
    echo "--- Table: $table ---\n";
    $res = $conn->query("SHOW COLUMNS FROM $table");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            echo "Field: " . $row['Field'] . " | Type: " . $row['Type'] . " | Null: " . $row['Null'] . "\n";
        }
    } else {
        echo "Table does not exist or query failed: " . $conn->error . "\n";
    }
    echo "\n";
}
