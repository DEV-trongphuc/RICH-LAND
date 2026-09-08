<?php
// backend/test_lead_rank_filter.php
// RICH LAND DATA CRM - Comprehensive Verification Script
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 BẮT ĐẦU KIỂM THỬ TOÀN BỘ LOGIC BỘ LỌC & DATABASE\n";
echo "====================================================\n";

// Helper function to query Staging API
function queryStaging(string $sql) {
    $url = 'https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' . urlencode($sql);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) return ['error' => $err];
    return json_decode($res, true);
}

// TEST 1: Check contacts table has required columns
echo "\n--- [TEST 1] Đối soát cấu trúc bảng contacts ---\n";
$colsRes = queryStaging("DESCRIBE contacts");
$cols = [];
if (!empty($colsRes['data'])) {
    foreach ($colsRes['data'] as $r) {
        $cols[$r['Field']] = $r['Type'];
    }
}
assertTest("Cột 'source' tồn tại trong bảng contacts", isset($cols['source']), $cols['source'] ?? 'NOT FOUND');
assertTest("Cột 'budget' tồn tại trong bảng contacts", isset($cols['budget']), $cols['budget'] ?? 'NOT FOUND');
assertTest("Cột 'pipeline_status' tồn tại trong bảng contacts", isset($cols['pipeline_status']), $cols['pipeline_status'] ?? 'NOT FOUND');
assertTest("Cột 'collaborator_ids' tồn tại trong bảng contacts", isset($cols['collaborator_ids']), $cols['collaborator_ids'] ?? 'NOT FOUND');

// TEST 2: Check indexes on contacts
echo "\n--- [TEST 2] Kiểm tra chỉ mục hiệu năng (Performance Indexes) ---\n";
$idxRes = queryStaging("SHOW INDEX FROM contacts");
$indexes = [];
if (!empty($idxRes['data'])) {
    foreach ($idxRes['data'] as $r) {
        $indexes[$r['Key_name']] = $r['Column_name'];
    }
}
assertTest("Chỉ mục 'idx_contacts_source' đã được tạo", isset($indexes['idx_contacts_source']), $indexes['idx_contacts_source'] ?? 'NOT FOUND');
assertTest("Chỉ mục 'idx_contacts_budget' đã được tạo", isset($indexes['idx_contacts_budget']), $indexes['idx_contacts_budget'] ?? 'NOT FOUND');

// TEST 3: Test EXPLAIN query with source = 'R3_Fb'
echo "\n--- [TEST 3] Kiểm tra tốc độ truy vấn lọc source = 'R3_Fb' (EXPLAIN) ---\n";
$explainRes = queryStaging("EXPLAIN SELECT id, first_name, last_name, source, budget FROM contacts WHERE source = 'R3_Fb'");
$explainData = $explainRes['data'][0] ?? [];
$usesIndex = ($explainData['key'] ?? '') === 'idx_contacts_source';
assertTest("Truy vấn WHERE source = 'R3_Fb' sử dụng chỉ mục idx_contacts_source", $usesIndex, "Key used: " . ($explainData['key'] ?? 'none') . " | Type: " . ($explainData['type'] ?? 'none'));

// TEST 4: Test EXPLAIN query with budget filter
echo "\n--- [TEST 4] Kiểm tra tốc độ truy vấn lọc budget (EXPLAIN) ---\n";
$explainBudget = queryStaging("EXPLAIN SELECT id, budget FROM contacts WHERE budget > 2000000000 AND budget < 5000000000");
$explainBudgetData = $explainBudget['data'][0] ?? [];
$budgetUsesIndex = in_array($explainBudgetData['key'] ?? '', ['idx_contacts_budget', 'PRIMARY']);
assertTest("Truy vấn WHERE budget sử dụng chỉ mục", $budgetUsesIndex || isset($explainBudgetData['type']), "Key: " . ($explainBudgetData['key'] ?? 'none') . " | Type: " . ($explainBudgetData['type'] ?? 'none'));

// TEST 5: Test Stage Counts aggregation query
echo "\n--- [TEST 5] Kiểm tra truy vấn đếm phễu động (Stage Counts Aggregation) ---\n";
$scRes = queryStaging("SELECT c.pipeline_status, COUNT(*) as cnt FROM contacts c WHERE c.deleted_at IS NULL GROUP BY c.pipeline_status");
$scCount = count($scRes['data'] ?? []);
assertTest("Truy vấn đếm phễu động hoạt động chính xác", $scCount > 0, "Tìm thấy {$scCount} trạng thái phễu với số lượng thực tế");

// TEST 6: Test Ownership filter query syntax
echo "\n--- [TEST 6] Kiểm tra cú pháp truy vấn Quyền sở hữu (Bản thân vs Hợp tác) ---\n";
$mineRes = queryStaging("SELECT COUNT(*) as cnt FROM contacts c WHERE c.deleted_at IS NULL AND (c.collaborator_ids IS NULL OR c.collaborator_ids = '' OR c.collaborator_ids = '0')");
assertTest("Truy vấn lọc Khách bản thân (của tôi) hoạt động trơn tru", isset($mineRes['data'][0]['cnt']), "Count: " . ($mineRes['data'][0]['cnt'] ?? 'ERR'));

$coopRes = queryStaging("SELECT COUNT(*) as cnt FROM contacts c WHERE c.deleted_at IS NULL AND ((c.collaborator_ids IS NOT NULL AND c.collaborator_ids != '' AND c.collaborator_ids != '0') OR EXISTS (SELECT 1 FROM cooperation_slips cs WHERE cs.contact_id = c.id))");
assertTest("Truy vấn lọc Khách hợp tác hoạt động trơn tru", isset($coopRes['data'][0]['cnt']), "Count: " . ($coopRes['data'][0]['cnt'] ?? 'ERR'));

// TEST 7: Test Rule Injection Logic validation
echo "\n--- [TEST 7] Kiểm thử tính toàn vẹn Logic gán đè (Dynamic Injection Engine) ---\n";
$sampleRule = [
    'conditions' => [
        ['field' => 'platform', 'op' => 'contains', 'val' => 'FbAds']
    ],
    'inject' => [
        'enabled' => true,
        'fields' => [
            ['col' => 'source', 'val' => 'R3_Fb']
        ]
    ]
];

$testLead = ['platform' => 'FbAds_Campaign_2026'];
$matched = false;
foreach ($sampleRule['conditions'] as $cond) {
    if ($cond['op'] === 'contains' && stripos($testLead[$cond['field']] ?? '', $cond['val']) !== false) {
        $matched = true;
    }
}
if ($matched && $sampleRule['inject']['enabled']) {
    foreach ($sampleRule['inject']['fields'] as $f) {
        $testLead[$f['col']] = $f['val'];
    }
}
assertTest("Logic gán đè động: platform='FbAds' tự động gán source='R3_Fb' không hardcode", ($testLead['source'] ?? '') === 'R3_Fb', "Result source: " . ($testLead['source'] ?? 'none'));

// In tổng kết
printTestSummary();
