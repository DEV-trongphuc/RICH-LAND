<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DIAGNOSTIC: SHOW COLUMNS FROM ai_training_docs ===\n\n";

$res = $conn->query("SHOW COLUMNS FROM ai_training_docs");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "Field: " . $row['Field'] . " | Type: " . $row['Type'] . " | Null: " . $row['Null'] . "\n";
    }
} else {
    echo "Query failed: " . $conn->error . "\n";
}
