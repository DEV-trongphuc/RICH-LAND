<?php
// backend/test_cron_cooperation_slips.php
// Unit Test cho TC-30: Quét phiếu hợp tác quá 24h chưa ký -> Tự đổi PHIEU_TREO (disputed) + Báo Quản lý

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/cron_cooperation_slips.php';

echo "\n=======================================================\n";
echo "🧪 BẮT ĐẦU KIỂM THỬ TC-30: CRON QUÉT PHIẾU TREO 24H\n";
echo "=======================================================\n\n";

if (!$pdo) {
    echo "❌ Không thể khởi tạo kết nối PDO từ test_bootstrap.php!\n";
    exit(1);
}

// 1. Kiểm tra cú pháp và sự tồn tại của hàm cron
assertTest("Hàm runCooperationSlipsCron() tồn tại", function_exists('runCooperationSlipsCron'));

// 2. Tạo dữ liệu giả lập cho 1 phiếu hợp tác quá 24h chưa ký
$tenantId = 1;
// Tìm hoặc tạo contact mẫu
$stmtContact = $pdo->query("SELECT id FROM contacts WHERE tenant_id = $tenantId AND deleted_at IS NULL LIMIT 1");
$contactRow = $stmtContact->fetch();
$contactId = $contactRow ? (int)$contactRow['id'] : 1;

// Lấy 2 user mẫu
$stmtUsers = $pdo->query("SELECT id, full_name FROM users WHERE deleted_at IS NULL LIMIT 2");
$users = $stmtUsers->fetchAll();
if (count($users) < 2) {
    echo "⚠️ Không đủ user để chạy test phân chia hoa hồng, sử dụng ID 1 và 2.\n";
    $u1 = 1;
    $u2 = 2;
} else {
    $u1 = (int)$users[0]['id'];
    $u2 = (int)$users[1]['id'];
}

$shares = [$u1 => 60, $u2 => 40];
$signatures = [
    $u1 => [
        'time' => date('Y-m-d H:i:s', strtotime('-30 hours')),
        'ip' => '127.0.0.1'
    ]
    // $u2 CHƯA KÝ!
];

// Chèn 1 phiếu có created_at và updated_at cách đây 26 tiếng
$testCreatedAt = date('Y-m-d H:i:s', strtotime('-26 hours'));
$stmtInsert = $pdo->prepare("
    INSERT INTO cooperation_slips (contact_id, version, total_percentage, shares_json, signatures_json, status, created_by, created_at, updated_at)
    VALUES (?, 1, 100, ?, ?, 'pending_signatures', ?, ?, ?)
");
$stmtInsert->execute([
    $contactId,
    json_encode($shares),
    json_encode($signatures),
    $u1,
    $testCreatedAt,
    $testCreatedAt
]);
$testSlipId = (int)$pdo->lastInsertId();
assertTest("Tạo thành công phiếu hợp tác mẫu (ID: #$testSlipId, created_at: -26h, $u2 chưa ký)", $testSlipId > 0);

// 3. Thực thi tiến trình cron quét phiếu treo
echo "\n--- Kích hoạt runCooperationSlipsCron() ---\n";
$processed = runCooperationSlipsCron($conn, $pdo);
echo "--- Hoàn tất chạy cron ---\n\n";

assertTest("Cron phát hiện và xử lý ít nhất 1 phiếu quá hạn", $processed >= 1);

// 4. Xác minh trạng thái của phiếu sau khi cron chạy
$stmtCheck = $pdo->prepare("SELECT status, dispute_details FROM cooperation_slips WHERE id = ?");
$stmtCheck->execute([$testSlipId]);
$checkSlip = $stmtCheck->fetch();

assertTest("Trạng thái của phiếu đã tự động chuyển sang 'disputed' (PHIEU_TREO)", $checkSlip['status'] === 'disputed', "Thực tế: " . $checkSlip['status']);
assertTest("Ghi nhận chi tiết lý do treo (dispute_details)", !empty($checkSlip['dispute_details']) && strpos($checkSlip['dispute_details'], '24h') !== false, "Nội dung: " . $checkSlip['dispute_details']);

// 5. Dọn dẹp dữ liệu kiểm thử
$pdo->prepare("DELETE FROM cooperation_slips WHERE id = ?")->execute([$testSlipId]);
assertTest("Dọn dẹp bản ghi kiểm thử #$testSlipId thành công", true);

// 6. In tổng kết kết quả
printTestSummary();
