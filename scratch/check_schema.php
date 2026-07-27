<?php
// scratch/check_schema.php
// Script đối soát cấu trúc bảng giữa database local và staging

require_once __DIR__ . '/../backend/db_connect.php';

echo "=== STARTING DATABASE SCHEMA AUDIT ===\n";

// 1. Fetch local schema of distribution_rounds
$localFields = [];
$res = $conn->query("DESCRIBE distribution_rounds");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $localFields[$row['Field']] = [
            'Type' => $row['Type'],
            'Null' => $row['Null'],
            'Key' => $row['Key'],
            'Default' => $row['Default']
        ];
    }
} else {
    die("Error reading local schema.\n");
}

// 2. Fetch staging schema of distribution_rounds
$stagingUrl = "https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=DESCRIBE%20distribution_rounds";
$stagingContent = file_get_contents($stagingUrl);
if (!$stagingContent) {
    die("Error fetching staging schema from $stagingUrl\n");
}

$stagingData = json_decode($stagingContent, true);
if (!isset($stagingData['status']) || $stagingData['status'] !== 'success') {
    die("Invalid staging response: " . $stagingContent . "\n");
}

$stagingFields = [];
foreach ($stagingData['data'] as $row) {
    $stagingFields[$row['Field']] = [
        'Type' => $row['Type'],
        'Null' => $row['Null'],
        'Key' => $row['Key'],
        'Default' => $row['Default']
    ];
}

// 3. Compare schemas
$allOk = true;
echo "Comparing fields between Local and Staging:\n";

foreach ($localFields as $field => $meta) {
    if (!isset($stagingFields[$field])) {
        echo "❌ FIELD MISSING ON STAGING: $field\n";
        $allOk = false;
        continue;
    }
    
    $sMeta = $stagingFields[$field];
    if ($meta['Type'] !== $sMeta['Type'] || $meta['Null'] !== $sMeta['Null']) {
        echo "⚠️ FIELD MISMATCH: $field | Local: {$meta['Type']} (Null: {$meta['Null']}) vs Staging: {$sMeta['Type']} (Null: {$sMeta['Null']})\n";
        $allOk = false;
    } else {
        echo "✅ Match: $field ({$meta['Type']})\n";
    }
}

foreach ($stagingFields as $field => $meta) {
    if (!isset($localFields[$field])) {
        echo "❌ FIELD MISSING ON LOCAL: $field\n";
        $allOk = false;
    }
}

if ($allOk) {
    echo "=== [PASS] DATABASE SCHEMA IS PERFECTLY SYNCHRONIZED BETWEEN LOCAL AND STAGING ===\n";
} else {
    echo "=== [FAIL] DATABASE SCHEMA MISMATCH FOUND ===\n";
}
