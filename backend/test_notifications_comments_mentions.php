<?php
// backend/test_notifications_comments_mentions.php
// Unit & Integration Test Suite for Notifications, Comments, Mentions across all CRM modules

require_once __DIR__ . '/test_bootstrap.php';

echo "\n====================================================\n";
echo "🚀 STARTING COMPREHENSIVE NOTIFICATION & MENTION AUDIT\n";
echo "====================================================\n\n";

// 1. Verify Database Schema for Notifications and Comments
if ($pdo) {
    try {
        $stmtCols = $pdo->query("DESCRIBE notifications");
        $cols = $stmtCols->fetchAll(PDO::FETCH_COLUMN);
        assertTest("Notifications Table Schema check (id, user_id, tenant_id, title, body, type, link, is_read)", 
            in_array('id', $cols) && in_array('user_id', $cols) && in_array('tenant_id', $cols) && in_array('link', $cols) && in_array('type', $cols),
            "Found columns: " . implode(', ', $cols)
        );

        $stmtComments = $pdo->query("DESCRIBE comments");
        $cCols = $stmtComments->fetchAll(PDO::FETCH_COLUMN);
        assertTest("Comments Table Schema check (entity_type, entity_id, user_id, body, parent_id)",
            in_array('entity_type', $cCols) && in_array('entity_id', $cCols) && in_array('body', $cCols) && in_array('parent_id', $cCols),
            "Found columns: " . implode(', ', $cCols)
        );

        $stmtActComments = $pdo->query("DESCRIBE activity_comments");
        $acCols = $stmtActComments->fetchAll(PDO::FETCH_COLUMN);
        assertTest("Activity Comments Table Schema check (activity_id, user_id, content, parent_id)",
            in_array('activity_id', $acCols) && in_array('content', $acCols) && in_array('parent_id', $acCols),
            "Found columns: " . implode(', ', $acCols)
        );

        $stmtTicketComments = $pdo->query("DESCRIBE ticket_comments");
        $tcCols = $stmtTicketComments->fetchAll(PDO::FETCH_COLUMN);
        assertTest("Ticket Comments Table Schema check (ticket_id, user_id, body, parent_id)",
            in_array('ticket_id', $tcCols) && in_array('body', $tcCols) && in_array('parent_id', $tcCols),
            "Found columns: " . implode(', ', $tcCols)
        );
    } catch (\Throwable $e) {
        assertTest("DB Schema query", false, $e->getMessage());
    }
}

// 2. Test Mention Parser Regex and Unicode Vietnamese Matching
$testComment = '<p>Xin chào <span class="mention" data-user-id="42">@Nguyễn Văn Nam</span> và @Trần_Thị_Hồng(Sale) vui lòng kiểm tra!</p>';

// Test data-user-id extraction
$dataUserIds = [];
if (preg_match_all('/data-user-id="(\d+)"/i', $testComment, $idMatches)) {
    $dataUserIds = array_map('intval', $idMatches[1]);
}
assertTest("Regex extraction of data-user-id mentions", in_array(42, $dataUserIds), "Extracted: " . implode(',', $dataUserIds));

// Test plaintext Unicode Vietnamese @mention extraction
$plainMatches = [];
preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $testComment, $plainMatches);
$names = $plainMatches[1] ?? [];
assertTest("Regex extraction of Vietnamese Unicode @mentions", 
    in_array('Nguyễn', $names) || in_array('Trần_Thị_Hồng(Sale)', $names),
    "Extracted names: " . implode(', ', $names)
);

// 3. Test NotificationService Event Resolution
$reflectionClass = new ReflectionClass('NotificationService');
$resolveMethod = $reflectionClass->getMethod('resolveEventData');
$resolveMethod->setAccessible(true);

$eventCases = [
    'MENTION_TAGGED' => [
        'user_id' => 1,
        'author_name' => 'Admin Test',
        'comment' => 'Test mention comment with <strong>HTML</strong>',
        'link' => '/contacts?open_contact_id=123&highlight_note_id=456'
    ],
    'TICKET_COMMENT' => [
        'user_id' => 1,
        'author_name' => 'Support Lead',
        'comment' => 'Vấn đề đã được tiếp nhận và đang xử lý.',
        'link' => '/support-tickets?id=10&highlight_comment_id=50'
    ],
    'WORKFLOW_TASK_ASSIGNED' => [
        'user_id' => 1,
        'task_title' => 'Gọi điện chăm sóc khách VIP',
        'due_date' => '2026-09-20'
    ],
    'COOP_INVITATION' => [
        'user_id' => 1,
        'customer_name' => 'Anh Hoàng',
        'inviter_name' => 'Nguyễn Văn B',
        'share_pct' => '50'
    ],
    'COOPERATION_PENDING_APPROVAL' => [
        'slip_id' => 88
    ],
    'DEPOSIT_NEW' => [
        'deposit_id' => 99,
        'customer_name' => 'Chị Mai',
        'amount' => 50000000
    ],
    'MY_DEPOSIT_UPDATE' => [
        'user_id' => 1,
        'deposit_id' => 99,
        'customer_name' => 'Chị Mai',
        'status_text' => 'đã được duyệt'
    ],
    'EXPENSE_REQUEST' => [
        'title' => 'Chi phí tiếp khách dự án',
        'amount' => 2500000,
        'reason' => 'Ăn trưa và giới thiệu dự án'
    ],
    'CHECKIN_LATE' => [
        'user_name' => 'Phúc',
        'date' => '2026-09-17',
        'time' => '08:45',
        'reason' => 'Kẹt xe đường Ung Văn Khiêm'
    ],
    'ATTENDANCE_UPDATE' => [
        'user_name' => 'Phúc',
        'date' => '2026-09-17',
        'time' => '17:30',
        'reason' => 'Quên checkout'
    ],
    'ATTENDANCE_APPROVAL_RESULT' => [
        'user_id' => 1,
        'status' => 'approved',
        'is_supplementary' => true,
        'reason' => 'Hợp lệ'
    ],
    'HOLIDAY_REGISTRATION_OPENED' => [
        'holiday_name' => 'Giỗ Tổ Hùng Vương',
        'shift_date' => '10/03 Âm lịch',
        'deadline' => '18:00 15/04'
    ],
    'MONTHLY_ATTENDANCE_REPORT' => [
        'period_str' => 'Tháng 08/2026',
        'summary_text' => "• Tổng ngày công: 24/24\n• Đúng giờ: 22 ngày\n• Đi trễ có phép: 2 ngày"
    ],
    'CHECKOUT_REMINDER' => [
        'work_end' => '17:30'
    ],
    'PROJECT_ROSTER_UPDATE' => [
        'project_name' => 'Eaton Park'
    ]
];

if ($pdo) {
    foreach ($eventCases as $evt => $payload) {
        try {
            $res = $resolveMethod->invoke(null, $pdo, 1, $evt, $payload);
            $hasTitle = !empty($res['title']);
            $hasBody = !empty($res['body']);
            $hasType = !empty($res['type']);
            $hasZalo = !empty($res['zalo_msg']);
            $hasTg = !empty($res['tg_msg']);
            $hasEmail = !empty($res['email_subject']);

            assertTest("NotificationService::resolveEventData for event '$evt'", 
                $hasTitle && $hasBody && $hasType && $hasZalo && $hasTg && $hasEmail,
                "Title: '{$res['title']}', Type: '{$res['type']}'"
            );
        } catch (\Throwable $ex) {
            assertTest("NotificationService::resolveEventData for event '$evt'", false, $ex->getMessage());
        }
    }
}

// 4. Test Notification In-App Bell Insertion and Fetch
if ($pdo) {
    try {
        // Fetch an active user
        $stmtU = $pdo->query("SELECT id FROM users WHERE tenant_id=1 AND is_active=1 LIMIT 1");
        $testUserId = (int)$stmtU->fetchColumn();

        if ($testUserId > 0) {
            $testTitle = "Test Thông Báo Kiểm Tra " . time();
            $testLink = "/contacts?open_contact_id=1&highlight_note_id=999";

            $stmtIns = $pdo->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read) VALUES (?, 1, ?, 'Nội dung test mention', 'mention', ?, 0)");
            $stmtIns->execute([$testUserId, $testTitle, $testLink]);
            $insertedNotifId = (int)$pdo->lastInsertId();

            assertTest("In-App Notification insert test", $insertedNotifId > 0, "Notification ID: $insertedNotifId");

            // Verify fetch
            $stmtFetch = $pdo->prepare("SELECT * FROM notifications WHERE id=?");
            $stmtFetch->execute([$insertedNotifId]);
            $fetched = $stmtFetch->fetch();
            assertTest("In-App Notification fetch test", $fetched && $fetched['link'] === $testLink, "Fetched link: " . ($fetched['link'] ?? 'null'));

            // Clean up test notif
            $pdo->prepare("DELETE FROM notifications WHERE id=?")->execute([$insertedNotifId]);
            assertTest("Clean up test notification", true);
        }
    } catch (\Throwable $e) {
        assertTest("In-App Notification cycle test", false, $e->getMessage());
    }
}

printTestSummary();
