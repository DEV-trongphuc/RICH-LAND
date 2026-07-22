<?php
// backend/test_email_dispatch.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "📧 TESTING EMAIL SETTINGS & DISPATCH ENGINE\n";
echo "====================================================\n\n";

// 1. Check SMTP System Settings
$smtpKeys = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name'];
$settings = [];
$res = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('" . implode("','", $smtpKeys) . "')");
while ($r = $res->fetch_assoc()) {
    $settings[$r['setting_key']] = $r['setting_value'];
}

echo "1. SMTP Settings in DB:\n";
foreach ($smtpKeys as $k) {
    $val = $settings[$k] ?? 'NOT SET';
    if ($k === 'smtp_password') $val = !empty($val) ? '****** (' . strlen($val) . ' chars)' : 'EMPTY';
    echo "  • $k: $val\n";
}

// 2. Check Mail Queue Status
$qRes = $conn->query("SELECT status, COUNT(*) as cnt FROM mail_queue GROUP BY status");
echo "\n2. Mail Queue Status:\n";
while ($qr = $qRes->fetch_assoc()) {
    echo "  • Status '{$qr['status']}': {$qr['cnt']} email(s)\n";
}

// 3. Test sending a direct test email via mailer.php
echo "\n3. Testing Direct SMTP Delivery...\n";
require_once __DIR__ . '/mailer.php';

$testTo = "test@example.com";
// Find email of current admin or user
$uRes = $conn->query("SELECT email FROM users WHERE email LIKE '%@%' AND status = 'active' LIMIT 1");
if ($uRes && $uRow = $uRes->fetch_assoc()) {
    $testTo = $uRow['email'];
}

echo "Attempting test email to: $testTo...\n";
// Insert to mail_queue
sendEmailNotification($testTo, "Test Co-care Email Dispatch", "MỜI HỢP TÁC DATA", "Bạn vừa nhận được lời mời hợp tác Data thử nghiệm.", "", false, 0);

echo "Email added to mail_queue. Processing queue now...\n";
if (function_exists('processMailQueueBatch')) {
    $result = processMailQueueBatch(5);
    print_r($result);
} else {
    // Manually process top pending email
    $pMail = $conn->query("SELECT * FROM mail_queue WHERE status = 'pending' ORDER BY id DESC LIMIT 1");
    if ($pMail && $mRow = $pMail->fetch_assoc()) {
        echo "Found pending mail ID #{$mRow['id']} to {$mRow['to_email']}.\n";
    }
}
