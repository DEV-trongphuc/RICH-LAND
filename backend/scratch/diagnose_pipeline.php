<?php
require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db_connect.php';

try {
    // 1. Check pipeline_stages count and records
    $res = $conn->query("SELECT * FROM pipeline_stages");
    echo "=== PIPELINE STAGES ===\n";
    $stages = [];
    while ($row = $res->fetch_assoc()) {
        $stages[] = $row;
        echo "ID: {$row['id']} | Name: {$row['name']} | Tenant: {$row['tenant_id']} | Order: {$row['order_index']}\n";
    }
    
    // 2. Check contacts count grouped by stage_id
    $res2 = $conn->query("SELECT stage_id, COUNT(*) as cnt FROM contacts GROUP BY stage_id");
    echo "\n=== CONTACTS BY STAGE_ID ===\n";
    while ($row = $res2->fetch_assoc()) {
        echo "Stage ID: " . ($row['stage_id'] ?? 'NULL') . " | Count: {$row['cnt']}\n";
    }
    
    // 3. Check deals count grouped by stage_id
    $res3 = $conn->query("SELECT stage_id, COUNT(*) as cnt FROM deals GROUP BY stage_id");
    echo "\n=== DEALS BY STAGE_ID ===\n";
    while ($row = $res3->fetch_assoc()) {
        echo "Stage ID: " . ($row['stage_id'] ?? 'NULL') . " | Count: {$row['cnt']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
