<?php
// backend/test_performance_benchmark.php
// Performance & Latency Bottleneck Diagnostic Script

if (isset($db)) {
    $pdo = $db;
}

if (!isset($pdo)) {
    require_once __DIR__ . '/test_bootstrap.php';
}

if (!function_exists('assertTest')) {
    function assertTest($title, $condition, $details = '') {
        echo ($condition ? "✅ [PASS] " : "❌ [FAIL] ") . $title . ($details ? " -> $details" : "") . "\n";
        return $condition;
    }
}
if (!function_exists('printTestSummary')) {
    function printTestSummary() {
        echo "\nBenchmark complete.\n";
    }
}

echo "====================================================\n";
echo "⚡ KIEM THU HIEU NANG & DIEM NGHEN CO CHAI (BENCHMARK)\n";
echo "====================================================\n\n";

// 1. Measure DB Connection Speed
$t1 = microtime(true);
$resConn = $pdo->query("SELECT 1");
$t2 = microtime(true);
$connLatency = round(($t2 - $t1) * 1000, 3);
assertTest("Do trễ truy vấn CSDL (DB Latency)", $connLatency < 10, "Thoi gian: {$connLatency} ms");

// 2. Measure Contacts Index Performance
$t1 = microtime(true);
$cRes = $pdo->query("SELECT id, first_name, last_name, phone FROM contacts ORDER BY id DESC LIMIT 50");
$t2 = microtime(true);
$cLatency = round(($t2 - $t1) * 1000, 3);
assertTest("Tien trinh doc 50 Contacts Mới nhất", $cLatency < 25, "Thoi gian: {$cLatency} ms");

// 3. Measure Leads Query Performance
$t1 = microtime(true);
$lRes = $pdo->query("SELECT id, name, phone, status FROM leads ORDER BY id DESC LIMIT 50");
$t2 = microtime(true);
$lLatency = round(($t2 - $t1) * 1000, 3);
assertTest("Tien trinh doc 50 Leads Mới nhất", $lLatency < 25, "Thoi gian: {$lLatency} ms");

// 4. Measure System Settings Cache Performance
$t1 = microtime(true);
$sRes = $pdo->query("SELECT setting_key, setting_value FROM system_settings");
$t2 = microtime(true);
$sLatency = round(($t2 - $t1) * 1000, 3);
assertTest("Doc toan bo 120 System Settings", $sLatency < 15, "Thoi gian: {$sLatency} ms");

printTestSummary();
