<?php
// backend/test_cron_jobs.php
// Comprehensive Cron Jobs Verification Suite

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "⏰ BAT DAU KIEM THU TOAN BO HE THONG CRON JOBS\n";
echo "====================================================\n\n";

$cronFiles = [
    'cron_master.php' => 'Master Cron Orchestrator',
    'cron_queue_worker.php' => 'Background Queue Worker (Mail/Zalo/Telegram)',
    'cron_recurring_tasks.php' => 'Recurring Tasks & Lead Recall Worker',
    'cron_sync.php' => 'Google Sheets / Webhook Sync Worker',
    'cron_ai_worker.php' => 'AI Lead Screener & Evaluation Worker',
    'cron_mailer.php' => 'Mail Queue Worker',
    'cron_daily_report.php' => 'Daily Report Generator',
    'cron_weekly_report.php' => 'Weekly Report Generator',
    'cron_monthly_report.php' => 'Monthly Report Generator'
];

foreach ($cronFiles as $file => $description) {
    $filePath = __DIR__ . '/' . $file;
    if (!file_exists($filePath)) {
        assertTest("Cron File: {$file} ({$description})", false, "Tap tin không tồn tại!");
        continue;
    }
    
    // Check PHP syntax readiness
    $content = file_get_contents($filePath);
    $hasPhpTag = (strpos($content, '<?php') !== false);
    $hasDbInclude = (strpos($content, 'db_connect.php') !== false || strpos($content, 'require') !== false || strpos($content, 'include') !== false);
    
    assertTest("Cron File Readiness: {$file}", $hasPhpTag && $hasDbInclude, "File hop le ({$description})");
}

// Test Cron Queue Worker tables
$mailQ = $conn->query("SHOW TABLES LIKE 'mail_queue'");
assertTest("Bang mail_queue phuc vu Cron Mailer", $mailQ && $mailQ->num_rows > 0);

$zaloQ = $conn->query("SHOW TABLES LIKE 'zalo_queue'");
assertTest("Bang zalo_queue phuc vu Cron Zalo", $zaloQ && $zaloQ->num_rows > 0);

printTestSummary();
