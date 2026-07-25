<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "Checking indexes on ai_training_chunks...\n";
$res = $conn->query("SHOW INDEX FROM ai_training_chunks WHERE Column_name = 'content' AND Index_type = 'FULLTEXT'");
if ($res && $res->num_rows > 0) {
    echo "FULLTEXT index exists on content column!\n";
} else {
    echo "Adding FULLTEXT index on content column...\n";
    $conn->query("ALTER TABLE ai_training_chunks ADD FULLTEXT INDEX ft_content (content)");
    echo "FULLTEXT index added successfully!\n";
}
