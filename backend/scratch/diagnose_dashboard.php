<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/../db_connect.php';

// Query pipeline_stages
echo "=== pipeline_stages TABLE ===\n";
$r = $conn->query("SELECT * FROM pipeline_stages ORDER BY order_index");
if ($r) {
    while ($row = $r->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "ERROR: " . $conn->error . "\n";
}

// Query system_settings for pipeline hierarchy
echo "\n=== system_settings FOR PIPELINE ===\n";
$r = $conn->query("SELECT * FROM system_settings WHERE setting_key IN ('pipeline_status_hierarchy', 'pipeline_status_labels')");
if ($r) {
    while ($row = $r->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "ERROR: " . $conn->error . "\n";
}
?>
