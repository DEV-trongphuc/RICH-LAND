<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== EXPLAINING THE SCREENER COUNT MISMATCH ===\n\n";

$start = date('Y-m-01 00:00:00');
$end = date('Y-m-t 23:59:59');
echo "Checking date range: $start to $end\n\n";

// Query all leads in the date range
$sql = "SELECT id, name, status, ai_screener_status, created_at, note, ai_attempts FROM leads WHERE created_at >= '$start' AND created_at <= '$end' ORDER BY id ASC";
$res = $conn->query($sql);

$leads = [];
$stats_failed = 0;
$stats_passed = 0;
$stats_other = 0;

$tab_queue = 0;
$tab_ai_pending = 0;
$tab_substandard = 0;
$tab_assigned = 0;
$tab_other = 0;

$detailed_rows = [];

while ($row = $res->fetch_assoc()) {
    $id = $row['id'];
    $name = $row['name'];
    $status = $row['status'];
    $ai_status = $row['ai_screener_status'];
    $created_at = $row['created_at'];
    $note = $row['note'];
    
    // Determine progress bar category
    $progress_cat = "Not counted";
    if ($ai_status === 'passed') {
        $progress_cat = "Passed (Đạt chuẩn)";
        $stats_passed++;
    } else if ($ai_status === 'failed') {
        $progress_cat = "Failed (Dưới chuẩn)";
        $stats_failed++;
    } else {
        $stats_other++;
    }
    
    // Determine tab category
    $tab_cat = "Khác";
    // Check if it matches queue_cnt
    $is_ai_pending = ($status === 'pending_approval' && ( ($ai_status === 'pending' || ($ai_status === 'error' && $row['ai_attempts'] < 3)) && strtotime($created_at) > (time() - 300) ));
    
    if ($status === 'pending_approval' && !$is_ai_pending) {
        $tab_cat = "Hàng chờ duyệt";
        $tab_queue++;
    } else if ($status === 'pending_approval' && $is_ai_pending) {
        $tab_cat = "Chờ AI đánh giá";
        $tab_ai_pending++;
    } else if (in_array($status, ['rejected', 'blacklisted'])) {
        $tab_cat = "Dưới chuẩn";
        $tab_substandard++;
    } else if ($status === 'active' && ($ai_status === 'failed' || $ai_status === 'error' || strpos($note, '[Duyệt ') !== false)) {
        $tab_cat = "Giao lead";
        $tab_assigned++;
    } else {
        $tab_other++;
    }
    
    $detailed_rows[] = [
        'id' => $id,
        'name' => $name,
        'status' => $status,
        'ai_status' => $ai_status,
        'created_at' => $created_at,
        'progress_cat' => $progress_cat,
        'tab_cat' => $tab_cat
    ];
}

echo "=== PROGRESS BAR STATISTICS (TOTAL EVALUATIONS) ===\n";
echo "Đạt chuẩn (Passed): $stats_passed\n";
echo "Dưới chuẩn (Failed): $stats_failed\n";
echo "Tổng số: " . ($stats_passed + $stats_failed) . " (Others: $stats_other)\n\n";

echo "=== TABS STATISTICS ===\n";
echo "Hàng chờ duyệt (Queue): $tab_queue\n";
echo "Chờ AI đánh giá (AI Pending): $tab_ai_pending\n";
echo "Dưới chuẩn (Substandard): $tab_substandard\n";
echo "Giao lead (Assigned): $tab_assigned\n";
echo "Khác (Other active/duplicate/etc.): $tab_other\n\n";

echo "=== DETAILED LEADS LIST ===\n";
printf("%-6s | %-20s | %-16s | %-16s | %-20s | %-16s\n", "ID", "Name", "Lead Status", "AI Status", "Tab Category", "Progress Bar");
echo str_repeat("-", 104) . "\n";
foreach ($detailed_rows as $r) {
    printf("#%-5d | %-20s | %-16s | %-16s | %-20s | %-16s\n", 
        $r['id'], 
        mb_substr($r['name'], 0, 20), 
        $r['status'], 
        $r['ai_status'], 
        $r['tab_cat'], 
        $r['progress_cat']
    );
}

echo "\n=== CONCLUSION & MISMATCH ANALYSIS ===\n";
// Let's print analysis of where the mismatch could be.
$failed_not_in_tabs = [];
$in_tabs_not_failed = [];

foreach ($detailed_rows as $r) {
    $in_understandard_tabs = ($r['tab_cat'] === 'Hàng chờ duyệt' || $r['tab_cat'] === 'Dưới chuẩn');
    $is_failed_screener = ($r['progress_cat'] === 'Failed (Dưới chuẩn)');
    
    if ($is_failed_screener && !$in_understandard_tabs) {
        $failed_not_in_tabs[] = $r;
    }
    if (!$is_failed_screener && $in_understandard_tabs) {
        $in_tabs_not_failed[] = $r;
    }
}

if (count($failed_not_in_tabs) > 0) {
    echo "\n[!] Leads counted as 'Dưới chuẩn' in progress bar but NOT in ('Hàng chờ duyệt' or 'Dưới chuẩn') tabs:\n";
    foreach ($failed_not_in_tabs as $r) {
        echo "  - #{$r['id']} ({$r['name']}): Has AI Status='{$r['ai_status']}' (counted as Dưới chuẩn) but Tab is '{$r['tab_cat']}' (Status='{$r['status']}')\n";
    }
}

if (count($in_tabs_not_failed) > 0) {
    echo "\n[!] Leads in 'Hàng chờ duyệt' or 'Dưới chuẩn' tabs but NOT counted as 'Dưới chuẩn' in progress bar:\n";
    foreach ($in_tabs_not_failed as $r) {
        echo "  - #{$r['id']} ({$r['name']}): Tab is '{$r['tab_cat']}' (Status='{$r['status']}') but AI Status='{$r['ai_status']}' (NOT counted in progress bar)\n";
    }
}

if (count($failed_not_in_tabs) === 0 && count($in_tabs_not_failed) === 0) {
    echo "\nNo structural discrepancies found. Double check date parsing or page loading constraints.";
}
?>
