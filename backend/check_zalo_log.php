<?php
// backend/check_zalo_log.php
header("Content-Type: text/plain; charset=utf-8");

$logFile = __DIR__ . '/zalo_send_log.txt';
if (!file_exists($logFile)) {
    echo "Không tìm thấy file log gửi Zalo trực tiếp (zalo_send_log.txt).\n";
    exit;
}

$content = file_get_contents($logFile);
$lines = explode("\n", $content);

// Lọc log của ngày hôm nay (2026-05-28)
$todayStr = '2026-05-28';
if (isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'])) {
    $todayStr = $_GET['date'];
}

echo "=== CHI TIẾT LOG GỬI ZALO TRỰC TIẾP HÔM NAY ($todayStr) ===\n\n";

$foundCount = 0;
foreach ($lines as $line) {
    if (empty(trim($line))) continue;
    
    // Chỉ lấy các dòng log của ngày được chọn
    if (strpos($line, '[' . $todayStr) !== false) {
        echo $line . "\n";
        $foundCount++;
    }
}

if ($foundCount === 0) {
    echo "Không tìm thấy bất kỳ log gửi Zalo nào trong ngày $todayStr.\n";
} else {
    echo "\nTổng cộng tìm thấy $foundCount dòng log trong ngày $todayStr.\n";
}
?>
