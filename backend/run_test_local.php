<?php
// backend/run_test_local.php
header('Content-Type: text/plain; charset=utf-8');

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err) {
        echo "SHUTDOWN ERROR: " . print_r($err, true) . "\n";
    }
});

echo "Starting local execution test...\n";

// Mock environment
$_SERVER['HTTP_X_BOT_API_SECRET_TOKEN'] = 'richlandvietnam-1808';
$mockPayload = json_encode([
    "event_name" => "message.text.received",
    "message" => [
        "date" => time() * 1000,
        "chat" => [
            "chat_type" => "PRIVATE",
            "id" => "17a44cab94e07dbe24f1"
        ],
        "message_id" => "test12345",
        "from" => [
            "id" => "17a44cab94e07dbe24f1",
            "is_bot" => false,
            "display_name" => "Phúc Hoàng"
        ],
        "text" => "1000"
    ]
], JSON_UNESCAPED_UNICODE);

// Set up php://input wrapper mock
$data = json_decode($mockPayload, true);

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/zalo_bot.php';
require_once __DIR__ . '/webhook_logic.php';

$rawBody = $mockPayload;
$headerSecret = 'richlandvietnam-1808';
$botToken = get_system_setting($conn, 'zalo_bot_token');
$eventName = 'message.text.received';

echo "Database connected OK.\n";
echo "Bot Token: $botToken\n";

$text = '1000';
$chatId = '17a44cab94e07dbe24f1';
$senderId = '17a44cab94e07dbe24f1';
$isOAMessage = false;

$sendReply = function(string $message) use ($botToken, $chatId, $senderId, $isOAMessage, $conn) {
    echo "REPLY CALLBACK EXECUTED WITH MESSAGE:\n$message\n\n";
    if (!empty($chatId)) {
        $ok = sendZaloMessage($botToken, $chatId, $message);
        echo "sendZaloMessage RESULT: " . ($ok ? 'SUCCESS' : 'FAILED') . "\n";
        return $ok;
    }
    return false;
};

$cleanText = trim($text);
$userId = (int)$cleanText;
$targetType = '';

echo "Parsed userId: $userId\n";

$stmtFind = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
$stmtFind->bind_param("i", $userId);
$stmtFind->execute();
$sale = $stmtFind->get_result()->fetch_assoc();
$stmtFind->close();

echo "Sale record: " . print_r($sale, true) . "\n";

$stmtAdmin = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? LIMIT 1");
$stmtAdmin->bind_param("i", $userId);
$stmtAdmin->execute();
$admin = $stmtAdmin->get_result()->fetch_assoc();
$stmtAdmin->close();

echo "Admin record: " . print_r($admin, true) . "\n";

if ($sale && $admin && $sale['id'] === $admin['id']) {
    $admin = null;
}

$linkedAny = false;
$successMessages = [];
$errorMsg = '';

if ($sale) {
    if (!empty($sale['zalo_chat_id'])) {
        if ($sale['zalo_chat_id'] === $chatId) {
            $successMessages[] = "Tư vấn viên: " . $sale['name'] . " (" . $sale['email'] . ") - Đã liên kết từ trước.";
            $linkedAny = true;
        }
    } else {
        $stmtUpdate = $conn->prepare("UPDATE users SET zalo_chat_id = ? WHERE id = ?");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("si", $chatId, $sale['id']);
            if ($stmtUpdate->execute()) {
                $linkedAny = true;
                $successMessages[] = "Tư vấn viên: " . $sale['name'] . " - Email: " . $sale['email'];
            } else {
                echo "UPDATE FAILED: " . $stmtUpdate->error . "\n";
            }
            $stmtUpdate->close();
        }
    }
}

echo "LinkedAny: " . ($linkedAny ? 'YES' : 'NO') . "\n";
echo "SuccessMessages: " . print_r($successMessages, true) . "\n";

if ($linkedAny) {
    $msg = "[ HỆ THỐNG RICH LAND DATA ]\n\n"
        . "Chúc mừng bạn đã xác thực hệ thống thành công:\n";
    foreach ($successMessages as $sm) {
        $msg .= "  • $sm\n";
    }
    $msg .= "\nTừ bây giờ hệ thống sẽ tự động gửi thông báo qua Zalo này.";
    $sendReply($msg);
}
