<?php
// backend/test_coop_slips_performance.php
// Performance Comparison Benchmark for Cooperation Slips Eager Loading

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "⚡ KIEM THU SO SANH HIEU NANG COOPERATION SLIPS (N+1 vs Eager)\n";
echo "====================================================\n\n";

$tid = 1; // Default tenant_id for testing
$limit = 50;

// Fetch 50 slips to run benchmark
$stmtSlips = $pdo->prepare("SELECT id, contact_id, attachment_url, shares_json, signatures_json FROM cooperation_slips WHERE contact_id IS NOT NULL LIMIT ?");
$stmtSlips->bindValue(1, $limit, PDO::PARAM_INT);
$stmtSlips->execute();
$slips = $stmtSlips->fetchAll(PDO::FETCH_ASSOC);

$count = count($slips);
if ($count === 0) {
    echo "Info: Khong co du lieu phieu hop tac de chay benchmark. Tu dong gia lap 30 slips.\n";
    $slips = [];
    for ($i = 1; $i <= 30; $i++) {
        $slips[] = [
            'id' => $i,
            'contact_id' => $i, // Simulated contact_ids
            'attachment_url' => 'uploads/cloud/1/file1.png,uploads/cloud/1/file2.jpg',
            'shares_json' => '{"1":50,"2":50}',
            'signatures_json' => '{}'
        ];
    }
    $count = count($slips);
}

echo "Chay thu nghiem tren {$count} Phieu hop tac...\n\n";

// --- BENCHMARK 1: PHUONG PHAP CU (N+1 Queries) ---
$t1 = microtime(true);
$qCountOld = 0;
foreach ($slips as $s) {
    // 1. SELECT cloud_files
    $stmtDocs = $pdo->prepare("SELECT file_path FROM cloud_files WHERE contact_id = ? AND tenant_id = ?");
    $stmtDocs->execute([$s['contact_id'], $tid]);
    $docs = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);
    $qCountOld++;

    // 2. SELECT milestones
    $stmtMilestones = $pdo->prepare("
        SELECT dm.unc_file_path 
        FROM deposit_milestones dm
        JOIN deposits d ON dm.deposit_id = d.id
        JOIN contacts c ON d.contact_id = c.id
        WHERE d.contact_id = ? AND c.tenant_id = ? AND dm.unc_file_path IS NOT NULL AND dm.unc_file_path != ''
    ");
    $stmtMilestones->execute([$s['contact_id'], $tid]);
    $milestones = $stmtMilestones->fetchAll(PDO::FETCH_ASSOC);
    $qCountOld++;
}
$t2 = microtime(true);
$timeOld = round(($t2 - $t1) * 1000, 3);
echo "[N+1 METHOD]:\n";
echo "- So query SQL thuc hien: {$qCountOld} queries\n";
echo "- Thoi gian chay: {$timeOld} ms\n\n";


// --- BENCHMARK 2: PHUONG PHAP MOI (Eager Loading) ---
$t1 = microtime(true);
$qCountNew = 0;

$contactIds = array_unique(array_filter(array_column($slips, 'contact_id')));
$docsByContact = [];
$milestonesByContact = [];

if (!empty($contactIds)) {
    $inClause = implode(',', array_fill(0, count($contactIds), '?'));

    // 1. Fetch group of cloud files
    $stmtDocs = $pdo->prepare("
        SELECT contact_id, file_path 
        FROM cloud_files 
        WHERE tenant_id = ? AND contact_id IN ($inClause)
    ");
    $stmtDocs->execute(array_merge([$tid], $contactIds));
    $qCountNew++;
    while ($row = $stmtDocs->fetch(PDO::FETCH_ASSOC)) {
        $docsByContact[$row['contact_id']][] = $row;
    }

    // 2. Fetch group of milestones
    $stmtMilestones = $pdo->prepare("
        SELECT d.contact_id, dm.unc_file_path 
        FROM deposit_milestones dm
        JOIN deposits d ON dm.deposit_id = d.id
        JOIN contacts c ON d.contact_id = c.id
        WHERE c.tenant_id = ? AND d.contact_id IN ($inClause) AND dm.unc_file_path IS NOT NULL AND dm.unc_file_path != ''
    ");
    $stmtMilestones->execute(array_merge([$tid], $contactIds));
    $qCountNew++;
    while ($row = $stmtMilestones->fetch(PDO::FETCH_ASSOC)) {
        $milestonesByContact[$row['contact_id']][] = $row;
    }
}

foreach ($slips as $s) {
    $cid = $s['contact_id'];
    $docs = $docsByContact[$cid] ?? [];
    $milestones = $milestonesByContact[$cid] ?? [];
}

$t2 = microtime(true);
$timeNew = round(($t2 - $t1) * 1000, 3);

echo "[EAGER LOADING]:\n";
echo "- So query SQL thuc hien: {$qCountNew} queries\n";
echo "- Thoi gian chay: {$timeNew} ms\n\n";

echo "====================================================\n";
$speedup = $timeNew > 0 ? round(($timeOld / $timeNew), 1) : 0;
$queryReduction = $qCountOld - $qCountNew;

assertTest("Toi uu hoa so luong query SQL", $qCountNew === 2, "Giam duoc {$queryReduction} truy van SQL!");
assertTest("Toc do phan hoi duoc nang cap", $timeNew < $timeOld, "Nhanh gap {$speedup} lan phuong phap cu!");

printTestSummary();
