<?php
// scratch/check_contacts_issue.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "=== COUNT OF MAIL QUEUE ===\n";
$res = $conn->query("SELECT COUNT(*) as cnt FROM mail_queue");
echo "Mail queue total rows: " . $res->fetch_assoc()['cnt'] . "\n";

echo "\n=== RECENT MAILS IN QUEUE ===\n";
$res = $conn->query("SELECT id, to_email, subject, status, attempts, lead_id, created_at, sent_at FROM mail_queue ORDER BY id DESC LIMIT 15");
while ($row = $res->fetch_assoc()) {
    echo "ID: {$row['id']} | To: {$row['to_email']} | Subject: {$row['subject']} | Status: {$row['status']} | Attempts: {$row['attempts']} | Lead ID: {$row['lead_id']} | Created: {$row['created_at']} | Sent: {$row['sent_at']}\n";
}

$conn->close();
