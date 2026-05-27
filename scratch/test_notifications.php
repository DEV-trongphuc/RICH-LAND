<?php
// e:\GIAO_DATA_GOOGLESHEETS\scratch\test_notifications.php

require_once __DIR__ . '/../backend/db_connect.php';
require_once __DIR__ . '/../backend/mailer.php';
require_once __DIR__ . '/../backend/zalo_bot.php';

echo "=== STARTING NOTIFICATION TEST ===\n\n";

// 1. Insert dummy lead with AI evaluation
$name = 'Test AI Lead ' . time();
$phone = '0999999999';
$email = 'test_ai_lead@example.com';
$source = 'Test Source';
$type = 'Test Type';
$aiStatus = 'passed';
$aiEvaluation = "Test AI evaluation details:\n- Speaks fluent English\n- Has IELTS certificate 7.5\n- High interest in course";

echo "Inserting dummy lead...\n";
$stmt = $conn->prepare("INSERT INTO leads (name, phone, email, source, type, ai_screener_status, ai_evaluation, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')");
if (!$stmt) {
    die("Prepare failed: " . $conn->error);
}
$stmt->bind_param("sssssss", $name, $phone, $email, $source, $type, $aiStatus, $aiEvaluation);
$stmt->execute();
$leadId = $stmt->insert_id;
$stmt->close();
echo "Inserted lead ID: $leadId\n\n";

// 2. Insert dummy consultant
echo "Inserting dummy consultant...\n";
$cName = 'Test Consultant ' . time();
$cEmail = 'test_consultant_' . time() . '@example.com';
$cZalo = 'test_zalo_chat_id_' . time();
$stmtC = $conn->prepare("INSERT INTO consultants (name, email, zalo_chat_id, status) VALUES (?, ?, ?, 'active')");
if (!$stmtC) {
    die("Prepare failed: " . $conn->error);
}
$stmtC->bind_param("sss", $cName, $cEmail, $cZalo);
$stmtC->execute();
$consultantId = $stmtC->insert_id;
$stmtC->close();
echo "Inserted consultant ID: $consultantId\n\n";

// 3. Test Email notification
echo "Triggering sendLeadAssignedEmailToSale...\n";
sendLeadAssignedEmailToSale($cEmail, $cName, $name, $phone, 'Ghi chú test', $source, '', 'Vòng Test', $leadId, $consultantId, 0);

// Fetch from mail_queue to verify the generated HTML
$resMail = $conn->query("SELECT * FROM mail_queue ORDER BY id DESC LIMIT 1");
if ($resMail && $rowMail = $resMail->fetch_assoc()) {
    echo "Generated Email Subject: " . $rowMail['subject'] . "\n";
    echo "Checking if AI Evaluation exists in generated body...\n";
    if (stripos($rowMail['body_html'], 'Đánh giá AI') !== false) {
        echo "✅ SUCCESS: AI evaluation details found in email body!\n";
        // Print snippet of the body containing the AI evaluation
        $pos = stripos($rowMail['body_html'], 'Đánh giá AI');
        echo "Context: " . substr($rowMail['body_html'], $pos, 250) . "\n\n";
    } else {
        echo "❌ FAILURE: AI evaluation NOT found in email body.\n";
    }
} else {
    echo "❌ FAILURE: No email queued in mail_queue.\n";
}

// 4. Test Zalo notification
echo "Triggering sendLeadAssignedZaloMessageToSale...\n";
// We temporarily override the curl send request in zalo_bot.php by checking the send log
// or we can verify the text build. Let's look at the return of the function.
// Since sendLeadAssignedZaloMessageToSale will attempt to send curl, it will write to zalo_send_log.txt.
// Let's read the last entry of zalo_send_log.txt.
$logBefore = file_exists(__DIR__ . '/../backend/zalo_send_log.txt') ? file_get_contents(__DIR__ . '/../backend/zalo_send_log.txt') : '';

sendLeadAssignedZaloMessageToSale($consultantId, $cName, $name, $phone, 'Ghi chú test', $source, 'Vòng Test', $leadId, 0, $email, $type);

$logAfter = file_exists(__DIR__ . '/../backend/zalo_send_log.txt') ? file_get_contents(__DIR__ . '/../backend/zalo_send_log.txt') : '';

if (strlen($logAfter) > strlen($logBefore)) {
    $newLog = substr($logAfter, strlen($logBefore));
    echo "New Zalo Send Log entry found:\n";
    echo $newLog . "\n";
    if (stripos($newLog, 'Đánh giá AI') !== false) {
        echo "✅ SUCCESS: AI evaluation found in Zalo send payload!\n";
    } else {
        echo "❌ FAILURE: AI evaluation NOT found in Zalo send payload.\n";
    }
} else {
    echo "❌ FAILURE: No new entry in zalo_send_log.txt.\n";
}

// Cleanup
echo "\nCleaning up test data...\n";
$conn->query("DELETE FROM leads WHERE id = $leadId");
$conn->query("DELETE FROM consultants WHERE id = $consultantId");
$conn->query("DELETE FROM mail_queue ORDER BY id DESC LIMIT 1");
echo "Cleanup completed.\n";

echo "=== TEST COMPLETED ===\n";
