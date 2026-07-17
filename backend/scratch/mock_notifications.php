<?php
// D:\RICH_LAND_DATA_UI\backend\scratch\mock_notifications.php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "=== DISABLING FOREIGN KEY CHECKS ===\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");

    echo "=== CREATING DEFAULT TENANT (ID = 1) ===\n";
    $db->exec("INSERT INTO tenants (id, name) VALUES (1, 'Richland Group') ON DUPLICATE KEY UPDATE name = 'Richland Group'");

    echo "=== CREATING DEFAULT PROJECT (ID = 78 / 1) ===\n";
    $db->exec("INSERT INTO projects (id, name, status) VALUES (1, 'Vinhome Saigon Park', 'active') ON DUPLICATE KEY UPDATE name = 'Vinhome Saigon Park'");

    echo "=== CREATING MOCK PERSON (ID = 78) ===\n";
    $db->exec("INSERT INTO persons (id, phone, full_name) VALUES (78, '0908888888', 'Nguyễn Văn Nam') ON DUPLICATE KEY UPDATE full_name = 'Nguyễn Văn Nam'");

    echo "=== CREATING MOCK CONTACT (ID = 78) ===\n";
    $db->exec("INSERT INTO contacts (id, person_id, first_name, last_name, phone, source, status, tenant_id) 
              VALUES (78, 78, 'Nguyễn', 'Văn Nam', '0908888888', 'facebook', 'new', 1) 
              ON DUPLICATE KEY UPDATE phone = '0908888888'");

    echo "=== CLEARING OLD NOTIFICATIONS ===\n";
    $db->exec("TRUNCATE TABLE notifications");

    $userIds = [2713, 2712, 999, 1002, 1000, 1001];

    $mocks = [
        [
            'title' => 'Cảnh báo trùng số',
            'body' => 'Trịnh Đình Thanh đã nhập tay khách hàng trùng SĐT với lead MKT đang hoạt động (Contact ID: 78)',
            'type' => 'warning',
            'link' => '/contacts?open_contact_id=78',
            'created_at' => date('Y-m-d H:i:s', time() - 240) // 4 mins ago
        ],
        [
            'title' => 'Nhắc nhở công việc',
            'body' => 'Phạm Quang Vinh đã gắn thẻ bạn vào công việc: Phê duyệt ngân sách chạy ads Google/Facebook dự án Richland.',
            'type' => 'mention',
            'link' => '/tasks',
            'created_at' => date('Y-m-d H:i:s', time() - 3600) // 1 hour ago
        ],
        [
            'title' => 'Tài liệu dự án mới',
            'body' => 'Nguyễn Hải Đăng đã tải lên tài liệu Bản vẽ mặt bằng phân khu dự án Vinhome Saigon Park.',
            'type' => 'project_document',
            'link' => '/projects',
            'created_at' => date('Y-m-d H:i:s', time() - 7200) // 2 hours ago
        ],
        [
            'title' => 'Yêu cầu hợp tác',
            'body' => 'Trần Quốc Bảo đã gửi yêu cầu hợp tác đại lý F1 phân phối giỏ hàng ngoại giao.',
            'type' => 'approval_request',
            'link' => '/cooperation',
            'created_at' => date('Y-m-d H:i:s', time() - 86400) // 1 day ago
        ],
        [
            'title' => 'Báo cáo phân bổ',
            'body' => 'Hệ thống đã tự động gửi Báo cáo hiệu suất phân bổ lead tháng 7 năm 2026.',
            'type' => 'info',
            'link' => '/reports',
            'created_at' => date('Y-m-d H:i:s', time() - 172800) // 2 days ago
        ]
    ];

    echo "=== INSERTING MOCK NOTIFICATIONS ===\n";
    $stmt = $db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, is_read, link, created_at) 
                          VALUES (?, 1, ?, ?, ?, 0, ?, ?)");

    foreach ($userIds as $uid) {
        foreach ($mocks as $mock) {
            $stmt->execute([
                $uid,
                $mock['title'],
                $mock['body'],
                $mock['type'],
                $mock['link'],
                $mock['created_at']
            ]);
        }
    }

    echo "=== ENABLING FOREIGN KEY CHECKS ===\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 1");

    echo "=== MOCK NOTIFICATIONS INSERTED SUCCESSFULLY ===\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
