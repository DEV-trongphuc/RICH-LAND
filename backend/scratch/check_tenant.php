<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DIAGNOSTIC: VERIFYING TENANT_ID IN DATABASE ===\n\n";

$res = $conn->query("SELECT id, tenant_id, name, status FROM ai_training_docs");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "Doc ID: " . $row['id'] . " | Tenant ID: " . $row['tenant_id'] . " | Name: " . $row['name'] . " | Status: " . $row['status'] . "\n";
    }
} else {
    echo "Query failed: " . $conn->error . "\n";
}
