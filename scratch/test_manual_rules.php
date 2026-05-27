<?php
// e:\GIAO_DATA_GOOGLESHEETS\scratch\test_manual_rules.php

require_once __DIR__ . '/../backend/webhook_logic.php';

echo "=== STARTING MANUAL RULES NORMALIZATION TEST ===\n\n";

$testCases = [
    // [Input text, expected normalized/stripped text]
    ["tiếng anh không", "tieng anh khong"],
    ["TIẾNG ANH KHÔNG", "tieng anh khong"],
    ["tieng anh khong", "tieng anh khong"],
    ["Học tiếng Anh giao tiếp", "hoc tieng anh giao tiep"],
    ["đường đời, số mệnh", "duong doi so menh"],
    ["mất gốc hoàn toàn – không học", "mat goc hoan toan khong hoc"]
];

$failed = 0;
foreach ($testCases as $index => $case) {
    $input = $case[0];
    $expected = $case[1];
    $normalized = normalizeTextForComparison($input);
    
    if ($normalized === $expected) {
        echo "✅ Test case #" . ($index + 1) . " PASSED: '$input' -> '$normalized'\n";
    } else {
        echo "❌ Test case #" . ($index + 1) . " FAILED: '$input' -> '$normalized' (Expected: '$expected')\n";
        $failed++;
    }
}

// Verify rule evaluation simulation
echo "\nSimulating rule match:\n";
$ruleVal = "tiếng anh không";
$leadVal = "tieng anh khong";

$normalizedRule = normalizeTextForComparison($ruleVal);
$normalizedLead = normalizeTextForComparison($leadVal);

echo "Rule: '$ruleVal' -> Normalized: '$normalizedRule'\n";
echo "Lead: '$leadVal' -> Normalized: '$normalizedLead'\n";

if ($normalizedRule === $normalizedLead) {
    echo "✅ SUCCESS: Rule and Lead MATCH accent-insensitively!\n";
} else {
    echo "❌ FAILURE: Rule and Lead DO NOT match.\n";
    $failed++;
}

if ($failed === 0) {
    echo "\n=== ALL TESTS PASSED SUCCESSFULLY ===\n";
} else {
    echo "\n=== SOME TESTS FAILED ===\n";
}
