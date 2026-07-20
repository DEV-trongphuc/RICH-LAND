<?php
// backend/cron_master.php
// MASTER ORCHESTRATOR CRON JOB
// Cấu hình đúng 1 cronjob duy nhất chạy mỗi 1 phút:
// * * * * * php /path/to/backend/cron_master.php

// Đặt thời gian thực thi không giới hạn để tránh timeout
set_time_limit(0);

// --- PREVENT CONCURRENT EXECUTION (CHỐNG CHẠY SONG SONG TRÙNG LẶP) ---
$lockFile = sys_get_temp_dir() . '/cron_master_' . md5(__DIR__) . '.lock';
$lockFp = @fopen($lockFile, 'w');
if (!$lockFp) {
    echo "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Exiting.\n";
    exit(1);
}
if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] Another master cron is already running. Exiting.\n";
    fclose($lockFp);
    exit(0);
}

echo "[" . date('Y-m-d H:i:s') . "] Starting master cron orchestrator...\n";

// Tự động nhận diện đường dẫn lệnh php trên hệ thống
$phpBin = 'php';
if (defined('PHP_BINARY') && !empty(PHP_BINARY)) {
    $phpBin = PHP_BINARY;
}

// Kiểm tra xem lệnh phpBin hiện tại có tương thích với PHP >= 7.0 hay không
$isModern = false;
$testOutput = [];
$testReturn = 0;
@exec('"' . $phpBin . '" -v 2>&1', $testOutput, $testReturn);
if ($testReturn === 0 && !empty($testOutput)) {
    if (preg_match('/PHP\s+([5-9]\.[0-9]+\.[0-9]+)/i', $testOutput[0], $matches)) {
        $ver = $matches[1];
        if (version_compare($ver, '7.0.0', '>=')) {
            $isModern = true;
        }
    }
}

if (!$isModern) {
    $candidates = [
        '/usr/local/bin/ea-php82',
        '/usr/local/bin/ea-php81',
        '/usr/local/bin/ea-php80',
        '/usr/local/bin/ea-php74',
        '/usr/local/bin/ea-php73',
        '/usr/local/bin/ea-php72',
        '/usr/local/bin/php82',
        '/usr/local/bin/php81',
        '/usr/local/bin/php80',
        '/usr/local/bin/php74',
        '/usr/bin/php82',
        '/usr/bin/php81',
        '/usr/bin/php80',
        '/usr/bin/php74',
        '/opt/alt/php82/usr/bin/php',
        '/opt/alt/php81/usr/bin/php',
        '/opt/alt/php80/usr/bin/php',
        '/opt/alt/php74/usr/bin/php',
        'php74',
        'php80',
        'php81',
        'php82'
    ];
    foreach ($candidates as $cand) {
        $output = [];
        $returnVar = 0;
        @exec('"' . $cand . '" -v 2>&1', $output, $returnVar);
        if ($returnVar === 0 && !empty($output)) {
            if (preg_match('/PHP\s+([5-9]\.[0-9]+\.[0-9]+)/i', $output[0], $matches)) {
                $ver = $matches[1];
                if (version_compare($ver, '7.0.0', '>=')) {
                    $phpBin = $cand;
                    break;
                }
            }
        }
    }
}

// Danh sách các tiến trình con chạy tuần tự
// cron_sync.php sẽ xử lý đồng bộ Google Sheets, chia số, báo cáo Ngày/Tuần/Tháng, và gọi AI/Sync Queue
// cron_mailer.php sẽ gửi email và tin nhắn Zalo bất đồng bộ từ hàng đợi gửi tin
$tasks = [
    'cron_sync.php',
    'cron_mailer.php'
];

require_once __DIR__ . '/db_connect.php';

// Get golden hours settings
$goldenHoursStart = get_system_setting($conn, 'golden_hours_start_time') ?: '06:00';
$goldenHoursEnd = get_system_setting($conn, 'golden_hours_end_time') ?: '08:30';

$currentTime = date('H:i');
$isGoldenHour = false;
if ($goldenHoursStart < $goldenHoursEnd) {
    $isGoldenHour = ($currentTime >= $goldenHoursStart && $currentTime <= $goldenHoursEnd);
} else {
    $isGoldenHour = ($currentTime >= $goldenHoursStart || $currentTime <= $goldenHoursEnd);
}

$iterations = $isGoldenHour ? 3 : 1;

for ($iter = 0; $iter < $iterations; $iter++) {
    if ($iter > 0) {
        echo "[" . date('Y-m-d H:i:s') . "] Sleeping 20 seconds (Golden Hour scan iteration " . ($iter + 1) . " of $iterations)...\n";
        sleep(20);
        if (isset($conn) && method_exists($conn, 'ping')) {
            $conn->ping();
        }
    }

    foreach ($tasks as $task) {
        $taskPath = __DIR__ . '/' . $task;
        if (file_exists($taskPath)) {
            echo "[" . date('Y-m-d H:i:s') . "] >>> [Iteration " . ($iter + 1) . "] Executing: $task...\n";
            $output = [];
            $returnVar = 0;
            
            // Thực thi lệnh php chạy độc lập để tránh tràn bộ nhớ hoặc xung đột tài nguyên
            exec('"' . $phpBin . '" "' . $taskPath . '"', $output, $returnVar);
            
            foreach ($output as $line) {
                echo "    $line\n";
            }
            echo "[" . date('Y-m-d H:i:s') . "] <<< Finished $task with exit code $returnVar\n";
        } else {
            echo "[" . date('Y-m-d H:i:s') . "] WARNING: Task file not found: $taskPath\n";
        }
    }
}

if (isset($conn) && method_exists($conn, 'close')) {
    $conn->close();
}

echo "[" . date('Y-m-d H:i:s') . "] Master cron orchestrator finished successfully.\n";
flock($lockFp, LOCK_UN);
fclose($lockFp);
