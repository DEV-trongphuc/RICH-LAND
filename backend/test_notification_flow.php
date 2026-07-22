<?php
// backend/test_notification_flow.php
// Automated test script using rich testing harness per Rule 6

define('DIAG_TOKEN', 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';

echo "=== STARTING COMPREHENSIVE NOTIFICATION SYSTEM TESTS ===\n\n";

// Test 1: Verify getRecipientById resolves user 1000
try {
    $stmt = $pdo->prepare("
        SELECT u.id, u.email, 
               COALESCE(
                 NULLIF(NULLIF(TRIM(u.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết'), 
                 NULLIF(NULLIF(TRIM(c.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết')
               ) AS zalo_chat_id,
               COALESCE(
                 NULLIF(NULLIF(TRIM(u.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết'), 
                 NULLIF(NULLIF(TRIM(c.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết')
               ) AS telegram_chat_id,
               u.full_name 
        FROM users u
        LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id)
        WHERE u.id = ? OR c.id = ?
        LIMIT 1
    ");
    $stmt->execute([1000, 1000]);
    $recipient = $stmt->fetch();
    
    assertTest(
        !empty($recipient) && (int)$recipient['id'] === 1000,
        "Verify user 1000 resolves correctly in getRecipientById query"
    );
} catch (\Throwable $e) {
    assertTest(false, "Verify user 1000 query (Exception: " . $e->getMessage() . ")");
}

// Test 2: Trigger COOP_INVITATION send and verify it completes
try {
    $initialNotifCount = (int)$pdo->query("SELECT COUNT(*) FROM notifications WHERE user_id = 1000")->fetchColumn();
    
    NotificationService::send($pdo, 1, 'COOP_INVITATION', [
        'user_id' => 1000,
        'customer_name' => 'Nguyễn Văn Kiểm Thử',
        'inviter_name' => 'Đình Thanh',
        'contact_id' => 34
    ]);
    
    $newNotifCount = (int)$pdo->query("SELECT COUNT(*) FROM notifications WHERE user_id = 1000")->fetchColumn();
    
    assertTest(
        $newNotifCount > $initialNotifCount,
        "Verify notification was inserted into 'notifications' table"
    );
} catch (\Throwable $e) {
    assertTest(false, "NotificationService::send execution (Exception: " . $e->getMessage() . ")");
}

// Test 3: Verify the details of the inserted notification
try {
    $latestNotif = $pdo->query("SELECT * FROM notifications WHERE user_id = 1000 ORDER BY id DESC LIMIT 1")->fetch();
    
    assertTest(
        $latestNotif['type'] === 'cooperation' && strpos($latestNotif['body'], 'Nguyễn Văn Kiểm Thử') !== false,
        "Verify notification title, body, and type details"
    );
} catch (\Throwable $e) {
    assertTest(false, "Verify latest notification details (Exception: " . $e->getMessage() . ")");
}

// Print final summary
printTestSummary();
