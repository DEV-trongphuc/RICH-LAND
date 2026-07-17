<?php
// d:\RICH_LAND_DATA_UI\backend\scratch\test_trigger.php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $userId = 2713; // Thanh Sale
    $tenantId = 1;

    echo "=== 1. ENSURING USER HAS EMAIL ===\n";
    $db->exec("UPDATE users SET email = 'thanhtd.tdt@gmail.com' WHERE id = $userId");
    $user = $db->query("SELECT email FROM users WHERE id = $userId")->fetch();
    echo "User email: " . $user['email'] . "\n";

    echo "=== 2. CLEARING PRESET SETTINGS & QUEUE ===\n";
    $db->exec("DELETE FROM user_notification_settings WHERE user_id = $userId");
    $db->exec("DELETE FROM mail_queue WHERE to_email = 'thanhtd.tdt@gmail.com'");

    echo "=== 3. TESTING DEFAULT SETTINGS ===\n";
    
    // Test 3a: Warning notification (should trigger email)
    echo "Inserting warning notification...\n";
    $db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type) VALUES (?, ?, ?, ?, ?)")
       ->execute([$userId, $tenantId, 'Test Warning', 'Test body warning', 'warning']);

    // Test 3b: Document notification (should NOT trigger email)
    echo "Inserting project_document notification...\n";
    $db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type) VALUES (?, ?, ?, ?, ?)")
       ->execute([$userId, $tenantId, 'Test Doc', 'Test body doc', 'project_document']);

    $queued = $db->query("SELECT subject FROM mail_queue WHERE to_email = 'thanhtd.tdt@gmail.com'")->fetchAll();
    echo "Queued emails (expecting only '[Rich Land] Test Warning'):\n";
    print_r($queued);

    echo "=== 4. TESTING CUSTOM SAVED SETTINGS ===\n";
    $db->exec("DELETE FROM mail_queue WHERE to_email = 'thanhtd.tdt@gmail.com'");
    
    // Save settings: warning = 0 (disabled), project_document = 1 (enabled)
    echo "Saving settings: warning=0, project_document=1...\n";
    $stmt = $db->prepare("INSERT INTO user_notification_settings 
        (user_id, tenant_id, email_warning, email_mention, email_approval_request, email_project_document, email_project_comment, email_project_roster, email_info)
        VALUES (?, ?, 0, 1, 1, 1, 0, 0, 0)
        ON DUPLICATE KEY UPDATE email_warning=0, email_project_document=1");
    $stmt->execute([$userId, $tenantId]);

    // Insert warning again
    echo "Inserting warning notification...\n";
    $db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type) VALUES (?, ?, ?, ?, ?)")
       ->execute([$userId, $tenantId, 'Test Warning 2', 'Test body warning 2', 'warning']);

    // Insert doc again
    echo "Inserting project_document notification...\n";
    $db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type) VALUES (?, ?, ?, ?, ?)")
       ->execute([$userId, $tenantId, 'Test Doc 2', 'Test body doc 2', 'project_document']);

    $queued2 = $db->query("SELECT subject FROM mail_queue WHERE to_email = 'thanhtd.tdt@gmail.com'")->fetchAll();
    echo "Queued emails (expecting only '[Rich Land] Test Doc 2'):\n";
    print_r($queued2);

    echo "=== 5. CLEANING UP TEST DATA ===\n";
    $db->exec("DELETE FROM notifications WHERE title LIKE 'Test Warning%' OR title LIKE 'Test Doc%'");
    $db->exec("DELETE FROM mail_queue WHERE to_email = 'thanhtd.tdt@gmail.com'");
    $db->exec("DELETE FROM user_notification_settings WHERE user_id = $userId");
    echo "Cleanup finished.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
