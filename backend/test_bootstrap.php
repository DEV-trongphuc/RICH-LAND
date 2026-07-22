<?php
// backend/test_bootstrap.php
// RICH LAND DATA CRM - Testing Harness Bootstrap
// Tập tin khởi tạo môi trường kiểm thử toàn diện cho toàn bộ hệ thống (DB, Webhook, NotificationService, Mailer)

// 1. Kiểm tra an toàn: Chỉ cho phép chạy từ CLI hoặc với Secure Token
$isCli = (php_sapi_name() === 'cli');
$hasValidToken = (($_GET['token'] ?? '') === 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7') || defined('DIAG_TOKEN');

if (!$isCli && !$hasValidToken) {
    http_response_code(403);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Forbidden: Direct access to testing harness is restricted']);
    exit;
}

// 2. Tải toàn bộ môi trường và các thư viện cốt lõi
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';
require_once __DIR__ . '/zalo_bot.php';
require_once __DIR__ . '/telegram_bot.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/NotificationService.php';

// 3. Khởi tạo đối tượng PDO từ kết nối MySQLi $conn
$pdo = null;
try {
    $dbHost = $_ENV['DB_HOST'] ?? ($servername ?? 'localhost');
    $dbUser = $_ENV['DB_USER'] ?? ($username ?? '');
    $dbPass = $_ENV['DB_PASS'] ?? ($password ?? '');
    $dbName = $_ENV['DB_NAME'] ?? ($dbname ?? '');
    
    if (!empty($dbName)) {
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec("SET time_zone = '+07:00'");
    }
} catch (\Throwable $e) {
    error_log("PDO Connection warning: " . $e->getMessage());
}

// 4. Các hàm tiện ích kiểm thử (Test Utility Helper Functions)

/**
 * Thực thi hàm kiểm thử và tự động ghi log kết quả PASS / FAIL
 */
if (!function_exists('assertTest')) {
    function assertTest(string $title, bool $condition, string $details = ''): bool {
        global $testStats;
        if (!isset($testStats)) {
            $testStats = ['pass' => 0, 'fail' => 0];
        }
        
        if ($condition) {
            $testStats['pass']++;
            echo "✅ [PASS] {$title}" . ($details ? " -> {$details}" : "") . "\n";
            return true;
        } else {
            $testStats['fail']++;
            echo "❌ [FAIL] {$title}" . ($details ? " -> {$details}" : "") . "\n";
            return false;
        }
    }
}

/**
 * Kiểm tra sự tồn tại và tính hợp lệ của một giá trị trong bảng CSDL
 */
if (!function_exists('assertDbField')) {
    function assertDbField(mysqli $conn, string $table, string $column, string $whereClause, $expectedValue, string $testTitle): bool {
        $stmt = $conn->prepare("SELECT `{$column}` FROM `{$table}` WHERE {$whereClause} LIMIT 1");
        if (!$stmt) {
            return assertTest($testTitle, false, "SQL prepare failed: " . $conn->error);
        }
        $stmt->execute();
        $res = $stmt->get_result();
        $val = $res && $res->num_rows > 0 ? $res->fetch_assoc()[$column] : null;
        $stmt->close();
        
        $match = ($val == $expectedValue);
        return assertTest($testTitle, $match, "Actual: " . var_export($val, true) . " | Expected: " . var_export($expectedValue, true));
    }
}

/**
 * In ra tổng kết quả kiểm thử
 */
if (!function_exists('printTestSummary')) {
    function printTestSummary(): void {
        global $testStats;
        $pass = $testStats['pass'] ?? 0;
        $fail = $testStats['fail'] ?? 0;
        echo "\n====================================================\n";
        echo "📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ:\n";
        echo "   ✅ Thành công (PASS): {$pass}\n";
        echo "   ❌ Thất bại (FAIL)  : {$fail}\n";
        echo "====================================================\n";
    }
}

// Sẵn sàng cho các file script test require_once __DIR__ . '/test_bootstrap.php';
