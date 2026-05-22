<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Auth-Token");
header("Content-Type: application/json; charset=utf-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

// Handle CORS Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'env.php';
require_once 'db_connect.php';

$JWT_SECRET = $_ENV['JWT_SECRET'] ?? "DOMATION_SECRET_KEY_2026";

function getSafeErrorMsg($e)
{
    if ($e instanceof mysqli_sql_exception) {
        error_log("DB Error: " . $e->getMessage());
        return "Lỗi cơ sở dữ liệu hệ thống. Vui lòng thử lại sau.";
    }
    return $e->getMessage();
}

function create_jwt($payload, $secret)
{
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(json_encode($payload)));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

function verify_jwt($jwt, $secret)
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3)
        return false;
    list($header, $payload, $signature) = $parts;
    $validSignature = hash_hmac('sha256', $header . "." . $payload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($validSignature));
    if (hash_equals($base64UrlSignature, $signature)) {
        $decoded = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);
        if (isset($decoded['exp']) && $decoded['exp'] < time())
            return false;
        return $decoded;
    }
    return false;
}

function getBearerToken()
{
    if (isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    if (isset($_GET['token'])) {
        return trim($_GET['token']);
    }

    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$action = $_GET['action'] ?? '';

// Require authentication for all endpoints except login
$publicActions = ['login', 'login_google', 'login_google_sale', 'submit_report', 'get_report_context', 'get_zalo_send_logs'];

if (!in_array($action, $publicActions)) {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: No token provided']);
        exit();
    }
    $decodedUser = verify_jwt($token, $JWT_SECRET);
    if (!$decodedUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: Invalid or expired token']);
        exit();
    }

    if ($decodedUser['role'] === 'sale' && !in_array($action, ['get_sale_portal_data', 'get_sale_lead_timeline'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Sale role cannot access admin APIs']);
        exit();
    }

    $adminOnlyActions = [
        'get_accounts',
        'get_admin_logs',
        'add_account',
        'edit_account',
        'delete_account',
        'check_delete_account',
        'save_settings',
        'get_settings',
        'add_consultant',
        'edit_consultant',
        'delete_consultant',
        'add_round',
        'edit_round',
        'delete_round',
        'add_rule',
        'edit_rule',
        'delete_rule',
        'reorder_rules',
        'add_connection',
        'edit_connection',
        'delete_connection',
        'toggle_connection',
        'toggle_require_both',
        'add_mapping',
        'edit_mapping',
        'delete_mapping',
        'approve_report',
        'reject_report',
        'get_reports',
        'reassign_lead',
        'force_sync',
        'get_ticket_settings',
        'save_ticket_settings', // Ticket notification config
        'unlink_zalo',
        'test_email',
        'block_lead'
    ];
    if (in_array($action, $adminOnlyActions) && $decodedUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Require Admin privileges']);
        exit();
    }
} else {
    $decodedUser = null; // Public actions have no user context
}
function logAdminAction($conn, $accountId, $action, $details = []) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $detailsJson = json_encode($details, JSON_UNESCAPED_UNICODE);
    $stmt = $conn->prepare("INSERT INTO admin_logs (account_id, action, details, ip_address) VALUES (?, ?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("isss", $accountId, $action, $detailsJson, $ip);
        $stmt->execute();
        $stmt->close();
        pruneAdminLogs($conn);
    }
}

function getTicketNotifyAdmins($conn) {
    $res = $conn->query("SELECT account_id FROM ticket_notify_settings");
    $adminIds = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $adminIds[] = (int) $row['account_id'];
        }
    }

    $admins = [];
    if (!empty($adminIds)) {
        $inPlaceholders = implode(',', array_fill(0, count($adminIds), '?'));
        $types = str_repeat('i', count($adminIds));
        $adminStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id IN ($inPlaceholders)");
        $adminStmt->bind_param($types, ...$adminIds);
        $adminStmt->execute();
        $adminRes = $adminStmt->get_result();
        if ($adminRes) {
            while ($r = $adminRes->fetch_assoc()) {
                $admins[] = $r;
            }
        }
        $adminStmt->close();
    } else {
        // Fallback: role = 'admin' OR id = 1
        $adminRes = $conn->query("SELECT id, name, email, zalo_chat_id FROM accounts WHERE role = 'admin' OR id = 1");
        if ($adminRes) {
            while ($r = $adminRes->fetch_assoc()) {
                $admins[] = $r;
            }
        }
    }
    return $admins;
}

switch ($action) {
    case 'get_zalo_send_logs':
        $logFile = __DIR__ . '/zalo_send_log.txt';
        if (file_exists($logFile)) {
            $content = file_get_contents($logFile);
            if (strlen($content) > 10000) {
                $content = substr($content, -10000);
            }
            echo json_encode(['success' => true, 'logs' => $content]);
        } else {
            echo json_encode(['success' => true, 'logs' => 'No logs found.']);
        }
        break;

    case 'get_import_history':
        if (!isset($decodedUser) || ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'assistant')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            exit();
        }

        // Count total import history records
        $countRes = $conn->query("
            SELECT COUNT(*) as cnt
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            WHERE l.source = 'Excel Import' 
               OR l.note LIKE '%Nhap du lieu cu%'
        ");
        $totalCount = (int) ($countRes->fetch_assoc()['cnt'] ?? 0);

        // Check for pagination
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 50;
        if ($page < 1) $page = 1;
        if ($pageSize < 1) $pageSize = 50;
        $offset = ($page - 1) * $pageSize;

        if (!isset($_GET['page'])) {
            $limitStr = "LIMIT 10000";
        } else {
            $limitStr = "LIMIT $pageSize OFFSET $offset";
        }

        $res = $conn->query("
            SELECT 
                dl.id as log_id,
                l.id as lead_id,
                l.name,
                l.phone,
                l.email,
                dl.status as distribution_status,
                dl.message as distribution_message,
                c.name as consultant_name,
                c.status as consultant_status,
                l.last_interaction_date
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            WHERE l.source = 'Excel Import' 
               OR l.note LIKE '%Nhap du lieu cu%'
            ORDER BY dl.id DESC
            $limitStr
        ");
        $data = [];
        while ($row = $res->fetch_assoc()) {
            $isDuplicate = (
                strpos($row['distribution_message'], 'Trung') !== false || 
                strpos($row['distribution_message'], 'trung') !== false || 
                $row['distribution_status'] === 'duplicate' || 
                $row['distribution_status'] === 'reminder'
            );
            $data[] = [
                'log_id' => (int)$row['log_id'],
                'lead_id' => (int)$row['lead_id'],
                'name' => $row['name'],
                'phone' => $row['phone'],
                'email' => $row['email'],
                'has_record' => $isDuplicate ? true : false,
                'consultant_name' => $row['consultant_name'],
                'consultant_status' => $row['consultant_status'],
                'last_interaction_date' => $row['last_interaction_date']
            ];
        }
        echo json_encode(['success' => true, 'data' => $data, 'total_count' => $totalCount]);
        break;

    case 'delete_import_history':
        if (!isset($decodedUser) || ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'assistant')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            exit();
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $logIds = $input['log_ids'] ?? [];
        $leadIds = $input['lead_ids'] ?? [];

        if (empty($logIds) && empty($leadIds)) {
            echo json_encode(['success' => false, 'message' => 'Không có bản ghi nào được chọn để xóa.']);
            break;
        }

        $conn->begin_transaction();
        try {
            if (!empty($logIds)) {
                $placeholders = implode(',', array_fill(0, count($logIds), '?'));
                $stmt = $conn->prepare("DELETE FROM distribution_logs WHERE id IN ($placeholders)");
                $types = str_repeat('i', count($logIds));
                $stmt->bind_param($types, ...$logIds);
                $stmt->execute();
                $stmt->close();
            }

            if (!empty($leadIds)) {
                $placeholders = implode(',', array_fill(0, count($leadIds), '?'));
                $stmt = $conn->prepare("DELETE FROM leads WHERE id IN ($placeholders) AND (source = 'Excel Import' OR note LIKE '%Nhap du lieu cu%')");
                $types = str_repeat('i', count($leadIds));
                $stmt->bind_param($types, ...$leadIds);
                $stmt->execute();
                $stmt->close();
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Xóa bản ghi thành công.']);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Lỗi khi xóa dữ liệu: ' . $e->getMessage()]);
        }
        break;

    case 'login':
        $input = json_decode(file_get_contents('php://input'), true);
        // FEATURE: Đăng nhập bằng Email thay vì username
        // Backward compatible: Super Admin (id=1) vẫn có thể dùng username nếu chưa có email
        $loginField = trim($input['email'] ?? $input['username'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($loginField) || empty($password)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập email và mật khẩu']);
            break;
        }

        // Tìm theo email trước, fallback sang username cho super admin
        $stmt = $conn->prepare("SELECT * FROM accounts WHERE email = ? OR (id = 1 AND username = ?) LIMIT 1");
        $stmt->bind_param("ss", $loginField, $loginField);
        $stmt->execute();
        $res = $stmt->get_result();
        $stmt->close();
        if ($res->num_rows > 0) {
            $user = $res->fetch_assoc();
            if (password_verify($password, $user['password_hash'])) {
                
                // Update last_login
                $upd = $conn->prepare("UPDATE accounts SET last_login = NOW() WHERE id = ?");
                if ($upd) {
                    $upd->bind_param("i", $user['id']);
                    $upd->execute();
                    $upd->close();
                }

                logAdminAction($conn, $user['id'], 'LOGIN', ['message' => 'User logged in successfully']);

                $payload = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'] ?? '',
                    'role' => $user['role'],
                    'exp' => time() + 86400
                ];
                $token = create_jwt($payload, $JWT_SECRET);
                echo json_encode([
                    'success' => true,
                    'token' => $token,
                    'user' => [
                        'username' => $user['username'],
                        'email' => $user['email'] ?? '',
                        'role' => $user['role'],
                        'name' => $user['name']
                    ]
                ]);
                exit;
            }
        }
        echo json_encode(['success' => false, 'message' => 'Email hoặc mật khẩu không chính xác']);
        break;

    case 'login_google':
        $input = json_decode(file_get_contents('php://input'), true);
        $credential = $input['credential'] ?? '';

        if (empty($credential)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin xác thực Google']);
            break;
        }

        // Verify ID token via Google Tokeninfo API
        $url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($credential);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            echo json_encode(['success' => false, 'message' => 'Token xác thực Google không hợp lệ hoặc đã hết hạn']);
            break;
        }

        $googleData = json_decode($response, true);
        $googleEmail = trim($googleData['email'] ?? '');
        $googleAud = $googleData['aud'] ?? '';

        $expectedClientId = '641158233158-nsg8a8tdsj3fdgb34dc9tugm8god7tho.apps.googleusercontent.com';
        if ($googleAud !== $expectedClientId) {
            echo json_encode(['success' => false, 'message' => 'Client ID không hợp lệ']);
            break;
        }

        if (empty($googleEmail)) {
            echo json_encode(['success' => false, 'message' => 'Không thể lấy email từ tài khoản Google']);
            break;
        }

        // Find user by email
        $stmt = $conn->prepare("SELECT * FROM accounts WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $googleEmail);
        $stmt->execute();
        $res = $stmt->get_result();
        $stmt->close();

        if ($res->num_rows > 0) {
            $user = $res->fetch_assoc();

            // Auto confirm email if not already
            if ((int) $user['is_confirmed'] === 0) {
                $stmtConfirm = $conn->prepare("UPDATE accounts SET is_confirmed = 1 WHERE id = ?");
                $stmtConfirm->bind_param("i", $user['id']);
                $stmtConfirm->execute();
                $stmtConfirm->close();
            }

            $payload = [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'] ?? '',
                'role' => $user['role'],
                'exp' => time() + 86400
            ];
            $token = create_jwt($payload, $JWT_SECRET);
            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => [
                    'username' => $user['username'],
                    'email' => $user['email'] ?? '',
                    'role' => $user['role'],
                    'name' => $user['name']
                ]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => "Email '$googleEmail' chưa được đăng ký trong hệ thống. Vui lòng liên hệ Admin."
            ]);
        }
        break;

    case 'login_google_sale':
        $input = json_decode(file_get_contents('php://input'), true);
        $credential = $input['credential'] ?? '';
        if (empty($credential)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin xác thực Google']);
            break;
        }

        $url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($credential);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            echo json_encode(['success' => false, 'message' => 'Token xác thực Google không hợp lệ hoặc đã hết hạn']);
            break;
        }

        $googleData = json_decode($response, true);
        $googleEmail = trim($googleData['email'] ?? '');
        $googleAud = $googleData['aud'] ?? '';

        $expectedClientId = '641158233158-nsg8a8tdsj3fdgb34dc9tugm8god7tho.apps.googleusercontent.com';
        if ($googleAud !== $expectedClientId) {
            echo json_encode(['success' => false, 'message' => 'Client ID không hợp lệ']);
            break;
        }

        if (empty($googleEmail)) {
            echo json_encode(['success' => false, 'message' => 'Không thể lấy email từ tài khoản Google']);
            break;
        }

        // 1. Check if email exists in accounts table as Admin
        $stmtAdmin = $conn->prepare("SELECT * FROM accounts WHERE email = ? LIMIT 1");
        $stmtAdmin->bind_param("s", $googleEmail);
        $stmtAdmin->execute();
        $resAdmin = $stmtAdmin->get_result();
        if ($resAdmin->num_rows > 0) {
            $adminUser = $resAdmin->fetch_assoc();
            $payload = [
                'id' => $adminUser['id'],
                'username' => $adminUser['username'],
                'email' => $adminUser['email'] ?? '',
                'role' => $adminUser['role'],
                'name' => $adminUser['name'],
                'exp' => time() + 86400 * 7
            ];
            $token = create_jwt($payload, $JWT_SECRET);
            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => [
                    'username' => $adminUser['username'],
                    'email' => $adminUser['email'] ?? '',
                    'role' => $adminUser['role'],
                    'name' => $adminUser['name']
                ]
            ]);
            $stmtAdmin->close();
            break;
        }
        $stmtAdmin->close();

        // 2. Check if email exists in consultants table as Sale
        $stmtSale = $conn->prepare("SELECT * FROM consultants WHERE email = ? LIMIT 1");
        $stmtSale->bind_param("s", $googleEmail);
        $stmtSale->execute();
        $resSale = $stmtSale->get_result();
        $sale = null;
        if ($resSale->num_rows > 0) {
            $sale = $resSale->fetch_assoc();
        }
        $stmtSale->close();

        if ($sale) {
            if ($sale['status'] !== 'active' && $sale['status'] !== 'leave') {
                echo json_encode([
                    'success' => false,
                    'message' => 'Tài khoản Tư vấn viên của bạn đã bị ngừng hoạt động.'
                ]);
                break;
            }

            $payload = [
                'id' => $sale['id'],
                'username' => $sale['email'],
                'email' => $sale['email'],
                'role' => 'sale',
                'name' => $sale['name'],
                'exp' => time() + 86400 * 7 // 7 days token for sales
            ];
            $token = create_jwt($payload, $JWT_SECRET);
            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => [
                    'username' => $sale['email'],
                    'email' => $sale['email'],
                    'role' => 'sale',
                    'name' => $sale['name'],
                    'consultant_id' => $sale['id']
                ]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => "Email '$googleEmail' chưa được cấu hình làm Tư vấn viên trong hệ thống. Vui lòng liên hệ Admin."
            ]);
        }
        $stmtSale->close();
        break;

    case 'get_sale_portal_data':
        $saleId = (int)$decodedUser['id'];
        $isSale = $decodedUser['role'] === 'sale';
        
        $search = trim($_GET['search'] ?? '');
        $roundFilter = isset($_GET['round_id']) && $_GET['round_id'] !== '' ? (int)$_GET['round_id'] : null;
        $saleFilterId = isset($_GET['sale_id']) && $_GET['sale_id'] !== '' ? (int)$_GET['sale_id'] : null;
        
        $dateMode = $_GET['date_mode'] ?? 'all';
        $startDate = $_GET['start_date'] ?? '';
        $endDate = $_GET['end_date'] ?? '';
        
        if ($isSale) {
            $where = ["dl.assigned_to = ?", "dl.status IN ('assigned', 'compensation')"];
            $params = [$saleId];
            $types = "i";
        } else {
            $where = ["dl.status IN ('assigned', 'compensation')"];
            $params = [];
            $types = "";
            if ($saleFilterId !== null) {
                $where[] = "dl.assigned_to = ?";
                $params[] = $saleFilterId;
                $types .= "i";
            }
        }
        
        if (!empty($search)) {
            $where[] = "(l.phone LIKE ? OR l.email LIKE ? OR l.name LIKE ?)";
            $searchParam = "%$search%";
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $types .= "sss";
        }
        
        if ($roundFilter !== null) {
            $where[] = "dl.round_id = ?";
            $params[] = $roundFilter;
            $types .= "i";
        }
        
        $today = date('Y-m-d');
        if ($dateMode === 'today') {
            $where[] = "dl.received_at >= ?";
            $where[] = "dl.received_at <= ?";
            $params[] = $today . ' 00:00:00';
            $params[] = $today . ' 23:59:59';
            $types .= "ss";
        } elseif ($dateMode === 'yesterday') {
            $yesterday = date('Y-m-d', strtotime('-1 day'));
            $where[] = "dl.received_at >= ?";
            $where[] = "dl.received_at <= ?";
            $params[] = $yesterday . ' 00:00:00';
            $params[] = $yesterday . ' 23:59:59';
            $types .= "ss";
        } elseif ($dateMode === '7_days') {
            $where[] = "dl.received_at >= ?";
            $params[] = date('Y-m-d', strtotime('-7 days')) . ' 00:00:00';
            $types .= "s";
        } elseif ($dateMode === '30_days') {
            $where[] = "dl.received_at >= ?";
            $params[] = date('Y-m-d', strtotime('-30 days')) . ' 00:00:00';
            $types .= "s";
        } elseif ($dateMode === 'this_month') {
            $where[] = "dl.received_at >= ?";
            $params[] = date('Y-m-01') . ' 00:00:00';
            $types .= "s";
        } elseif ($dateMode === 'last_month') {
            $where[] = "dl.received_at >= ?";
            $where[] = "dl.received_at < ?";
            $params[] = date('Y-m-01', strtotime('first day of last month')) . ' 00:00:00';
            $params[] = date('Y-m-01') . ' 00:00:00';
            $types .= "ss";
        } elseif ($dateMode === 'this_year') {
            $where[] = "dl.received_at >= ?";
            $params[] = date('Y-01-01') . ' 00:00:00';
            $types .= "s";
        } elseif ($dateMode === 'custom' && !empty($startDate) && !empty($endDate)) {
            $where[] = "dl.received_at >= ?";
            $where[] = "dl.received_at <= ?";
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
            $types .= "ss";
        }
        
        $whereClause = implode(" AND ", $where);
        
        // 1. Query leads
        $sqlLeads = "
            SELECT dl.id as log_id, dl.received_at, dl.status, dl.message, dl.round_id, dl.assigned_to,
                   l.id as lead_id, l.name as lead_name, l.phone, l.email as lead_email, l.source, l.type, l.note,
                   r.round_name,
                   c.name as sale_name, c.email as sale_email,
                   dr.status as report_status, dr.id as report_id, dr.reason as report_reason, dr.reject_reason as report_reject_reason
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            LEFT JOIN data_reports dr ON dr.lead_id = l.id AND dr.consultant_id = dl.assigned_to
            WHERE $whereClause
            ORDER BY dl.received_at DESC
        ";
        
        $stmtLeads = $conn->prepare($sqlLeads);
        if (!empty($types)) {
            $stmtLeads->bind_param($types, ...$params);
        }
        $stmtLeads->execute();
        $resLeads = $stmtLeads->get_result();
        $leads = [];
        while ($row = $resLeads->fetch_assoc()) {
            $leads[] = $row;
        }
        $stmtLeads->close();
        
        // 2. Query rounds
        if ($isSale) {
            $sqlRounds = "
                SELECT DISTINCT r.id, r.round_name 
                FROM distribution_rounds r
                JOIN round_consultants rc ON r.id = rc.round_id
                WHERE rc.consultant_id = ?
            ";
            $stmtR = $conn->prepare($sqlRounds);
            $stmtR->bind_param("i", $saleId);
        } else {
            $sqlRounds = "SELECT id, round_name FROM distribution_rounds";
            $stmtR = $conn->prepare($sqlRounds);
        }
        $stmtR->execute();
        $resR = $stmtR->get_result();
        $rounds = [];
        while ($row = $resR->fetch_assoc()) {
            $rounds[] = $row;
        }
        $stmtR->close();
        
        // 3. Ticket stats under active date filter
        if ($isSale) {
            $ticketWhere = ["consultant_id = ?"];
            $ticketParams = [$saleId];
            $ticketTypes = "i";
        } else {
            $ticketWhere = [];
            $ticketParams = [];
            $ticketTypes = "";
            if ($saleFilterId !== null) {
                $ticketWhere[] = "consultant_id = ?";
                $ticketParams[] = $saleFilterId;
                $ticketTypes .= "i";
            }
        }
        if ($dateMode === 'today') {
            $ticketWhere[] = "created_at >= ?";
            $ticketWhere[] = "created_at <= ?";
            $ticketParams[] = $today . ' 00:00:00';
            $ticketParams[] = $today . ' 23:59:59';
            $ticketTypes .= "ss";
        } elseif ($dateMode === 'yesterday') {
            $yesterday = date('Y-m-d', strtotime('-1 day'));
            $ticketWhere[] = "created_at >= ?";
            $ticketWhere[] = "created_at <= ?";
            $ticketParams[] = $yesterday . ' 00:00:00';
            $ticketParams[] = $yesterday . ' 23:59:59';
            $ticketTypes .= "ss";
        } elseif ($dateMode === '7_days') {
            $ticketWhere[] = "created_at >= ?";
            $ticketParams[] = date('Y-m-d', strtotime('-7 days')) . ' 00:00:00';
            $ticketTypes .= "s";
        } elseif ($dateMode === '30_days') {
            $ticketWhere[] = "created_at >= ?";
            $ticketParams[] = date('Y-m-d', strtotime('-30 days')) . ' 00:00:00';
            $ticketTypes .= "s";
        } elseif ($dateMode === 'this_month') {
            $ticketWhere[] = "created_at >= ?";
            $ticketParams[] = date('Y-m-01') . ' 00:00:00';
            $ticketTypes .= "s";
        } elseif ($dateMode === 'last_month') {
            $ticketWhere[] = "created_at >= ?";
            $ticketWhere[] = "created_at < ?";
            $ticketParams[] = date('Y-m-01', strtotime('first day of last month')) . ' 00:00:00';
            $ticketParams[] = date('Y-m-01') . ' 00:00:00';
            $ticketTypes .= "ss";
        } elseif ($dateMode === 'this_year') {
            $ticketWhere[] = "created_at >= ?";
            $ticketParams[] = date('Y-01-01') . ' 00:00:00';
            $ticketTypes .= "s";
        } elseif ($dateMode === 'custom' && !empty($startDate) && !empty($endDate)) {
            $ticketWhere[] = "created_at >= ?";
            $ticketWhere[] = "created_at <= ?";
            $ticketParams[] = $startDate . ' 00:00:00';
            $ticketParams[] = $endDate . ' 23:59:59';
            $ticketTypes .= "ss";
        }
        $ticketWhereClause = !empty($ticketWhere) ? implode(" AND ", $ticketWhere) : "1=1";
        
        $sqlTickets = "
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM data_reports
            WHERE $ticketWhereClause
        ";
        $stmtT = $conn->prepare($sqlTickets);
        if (!empty($ticketTypes)) {
            $stmtT->bind_param($ticketTypes, ...$ticketParams);
        }
        $stmtT->execute();
        $ticketStats = $stmtT->get_result()->fetch_assoc();
        $stmtT->close();
        
        // 4. Query distribution by round
        $sqlByRound = "
            SELECT r.round_name, COUNT(dl.id) as count
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            JOIN distribution_rounds r ON dl.round_id = r.id
            WHERE $whereClause
            GROUP BY dl.round_id
        ";
        $stmtBR = $conn->prepare($sqlByRound);
        if (!empty($types)) {
            $stmtBR->bind_param($types, ...$params);
        }
        $stmtBR->execute();
        $resBR = $stmtBR->get_result();
        $byRound = [];
        while ($row = $resBR->fetch_assoc()) {
            $byRound[] = $row;
        }
        $stmtBR->close();
        
        // 5. Query distribution by hour
        $sqlByHour = "
            SELECT HOUR(dl.received_at) as hr, COUNT(dl.id) as count
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            WHERE $whereClause
            GROUP BY HOUR(dl.received_at)
            ORDER BY hr ASC
        ";
        $stmtBH = $conn->prepare($sqlByHour);
        if (!empty($types)) {
            $stmtBH->bind_param($types, ...$params);
        }
        $stmtBH->execute();
        $resBH = $stmtBH->get_result();
        $byHour = array_fill(0, 24, 0);
        while ($row = $resBH->fetch_assoc()) {
            $byHour[(int)$row['hr']] = (int)$row['count'];
        }
        $stmtBH->close();
        
        // 6. Query active consultants list if user is admin
        $consultantsList = [];
        if (!$isSale) {
            $resC = $conn->query("SELECT id, name, email FROM consultants WHERE status = 'active' ORDER BY name ASC");
            if ($resC) {
                while ($row = $resC->fetch_assoc()) {
                    $consultantsList[] = $row;
                }
            }
        }
        
        echo json_encode([
            'success' => true,
            'leads' => $leads,
            'rounds' => $rounds,
            'consultants' => $consultantsList,
            'stats' => [
                'total_received' => count($leads),
                'tickets_total' => (int)($ticketStats['total'] ?? 0),
                'tickets_approved' => (int)($ticketStats['approved'] ?? 0),
                'tickets_rejected' => (int)($ticketStats['rejected'] ?? 0),
                'tickets_pending' => (int)($ticketStats['pending'] ?? 0)
            ],
            'by_round' => $byRound,
            'by_hour' => $byHour
        ]);
        break;

    case 'get_sale_lead_timeline':
        $saleId = (int)$decodedUser['id'];
        $isSale = $decodedUser['role'] === 'sale';
        $leadId = isset($_GET['lead_id']) ? (int)$_GET['lead_id'] : 0;
        
        if (empty($leadId)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu lead_id']);
            break;
        }
        
        // Security check for sale role: did this sale receive this lead?
        if ($isSale) {
            $stmtCheck = $conn->prepare("
                SELECT 1 
                FROM distribution_logs 
                WHERE lead_id = ? AND assigned_to = ? AND status IN ('assigned', 'compensation', 'reminder') 
                LIMIT 1
            ");
            $stmtCheck->bind_param("ii", $leadId, $saleId);
            $stmtCheck->execute();
            $hasAccess = $stmtCheck->get_result()->num_rows > 0;
            $stmtCheck->close();
            
            if (!$hasAccess) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden: Bạn không có quyền truy cập dữ liệu này']);
                break;
            }
        }
        
        require_once __DIR__ . '/webhook_logic.php';
        $timeline = getLeadHistoryTimeline($conn, $leadId);
        
        echo json_encode([
            'success' => true,
            'timeline' => $timeline
        ]);
        break;

    case 'get_stats':
        $todayStr = date('Y-m-d');
        $stmt = $conn->prepare("SELECT 
            COUNT(*) as total,
            SUM(IF(status='assigned',1,0)) as assigned,
            SUM(IF(status='duplicate',1,0)) as duplicates
        FROM distribution_logs WHERE received_at >= ? AND received_at <= ?");
        $todayStart = $todayStr . ' 00:00:00';
        $todayEnd = $todayStr . ' 23:59:59';
        $stmt->bind_param("ss", $todayStart, $todayEnd);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        echo json_encode([
            'success' => true,
            'data' => [
                'total_today' => (int) $row['total'],
                'assigned' => (int) $row['assigned'],
                'duplicates' => (int) $row['duplicates']
            ]
        ]);
        break;

    case 'get_logs':
        $date = $_GET['date'] ?? 'all';
        $dateCondition = "1=1";

        if ($date === 'today' || $date === 'Hôm nay') {
            $dateCondition = "dl.received_at >= CURDATE() AND dl.received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        } else if ($date === 'yesterday' || $date === 'Hôm qua') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND dl.received_at < CURDATE()";
        } else if ($date === '7days' || $date === '7 ngày qua') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } else if ($date === '30days' || $date === '30 ngày qua') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        } else if ($date === 'this_month' || $date === 'Tháng này') {
            $dateCondition = "dl.received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND dl.received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
        } else if ($date === 'last_month' || $date === 'Tháng trước') {
            $dateCondition = "dl.received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND dl.received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "dl.received_at >= '$start 00:00:00' AND dl.received_at <= '$end 23:59:59'";
        }

        $extraCondition = "1=1";
        $isFilteringActive = false;

        if (isset($_GET['status']) && $_GET['status'] !== 'all') {
            $status = $conn->real_escape_string($_GET['status']);
            $extraCondition .= " AND dl.status = '$status'";
            $isFilteringActive = true;
        }
        if (isset($_GET['exclude_status'])) {
            $excludeStatus = $conn->real_escape_string($_GET['exclude_status']);
            $extraCondition .= " AND dl.status != '$excludeStatus'";
        }
        if (isset($_GET['consultant']) && $_GET['consultant'] !== 'all') {
            $consultant = $conn->real_escape_string($_GET['consultant']);
            $extraCondition .= " AND c.name = '$consultant'";
            $isFilteringActive = true;
        }
        if (isset($_GET['round']) && $_GET['round'] !== 'all') {
            $round = $conn->real_escape_string($_GET['round']);
            $extraCondition .= " AND dr.round_name = '$round'";
            $isFilteringActive = true;
        }
        if (isset($_GET['search']) && trim($_GET['search']) !== '') {
            $search = $conn->real_escape_string(trim($_GET['search']));
            $extraCondition .= " AND (l.name LIKE '%$search%' OR l.phone LIKE '%$search%' OR l.email LIKE '%$search%')";
            $isFilteringActive = true;
        }

        // Apply silent exclusion rule if no filters active
        if (!$isFilteringActive) {
            $extraCondition .= " AND dl.status != 'silent'";
        }

        // Get total count first with all active filters
        $joinLeads = (strpos($extraCondition, 'l.') !== false) ? "LEFT JOIN leads l ON dl.lead_id = l.id" : "";
        $joinConsultants = (strpos($extraCondition, 'c.') !== false) ? "LEFT JOIN consultants c ON dl.assigned_to = c.id" : "";
        $joinRounds = (strpos($extraCondition, 'dr.') !== false) ? "LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id" : "";

        $countRes = $conn->query("
            SELECT COUNT(*) as cnt 
            FROM distribution_logs dl 
            $joinLeads 
            $joinConsultants
            $joinRounds
            WHERE $dateCondition AND $extraCondition
        ");
        $totalCount = (int) ($countRes->fetch_assoc()['cnt'] ?? 0);

        // Check for pagination
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 50;
        if ($page < 1) $page = 1;
        if ($pageSize < 1) $pageSize = 50;
        $offset = ($page - 1) * $pageSize;

        if (!isset($_GET['page'])) {
            $LIMIT = 500;
            if (isset($_GET['limit']) && $_GET['limit'] === 'all' && isset($decodedUser) && $decodedUser['role'] === 'admin') {
                $LIMIT = 50000; // Admin full dump limit
            }
            $limitStr = "LIMIT $LIMIT";
            $responseLimit = $LIMIT;
        } else {
            $limitStr = "LIMIT $pageSize OFFSET $offset";
            $responseLimit = $pageSize;
        }

        $res = $conn->query("
            SELECT 
                dl.id, 
                l.name as lead_name, 
                l.phone, 
                l.email, 
                l.source, 
                l.type,
                l.note,
                dl.status, 
                c.name as assigned_to_name, 
                dr.round_name, 
                dl.received_at as created_at,
                r.status as report_status
            FROM distribution_logs dl
            LEFT JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
            LEFT JOIN data_reports r ON r.lead_id = dl.lead_id AND r.consultant_id = dl.assigned_to AND r.round_id = dl.round_id
            WHERE $dateCondition AND $extraCondition
            ORDER BY dl.received_at DESC 
            $limitStr
        ");
        $data = [];
        while ($row = $res->fetch_assoc())
            $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data, 'total_count' => $totalCount, 'limit' => $responseLimit]);
        break;

    case 'export_csv':
        // BUG-CRIT-02 fix: Xác thực token TRƯỚC khi đổi Content-Type sang CSV
        // Nếu kiểm tra ở đây sau khi đã set header CSV, lỗi 401 sẽ không hiện được
        if (!isset($decodedUser) || !$decodedUser) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized: Token required to export data']);
            exit();
        }
        // Xử lý xuất CSV trực tiếp (Stream) để tránh tràn bộ nhớ RAM (OOM) với file > 100,000 dòng
        $date = $_GET['date'] ?? 'all';
        $dateCondition = "1=1";

        if ($date === 'today' || $date === 'Hôm nay') {
            $dateCondition = "dl.received_at >= CURDATE() AND dl.received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        } else if ($date === 'yesterday' || $date === 'Hôm qua') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND dl.received_at < CURDATE()";
        } else if ($date === '7days' || $date === '7 ngày qua') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } else if ($date === '30days' || $date === '30 ngày qua') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        } else if ($date === 'this_month' || $date === 'Tháng này') {
            $dateCondition = "dl.received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND dl.received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
        } else if ($date === 'last_month' || $date === 'Tháng trước') {
            $dateCondition = "dl.received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND dl.received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "dl.received_at >= '$start 00:00:00' AND dl.received_at <= '$end 23:59:59'";
        }

        // Add filters for export
        $statusFilter = $_GET['status'] ?? 'all';
        $consultantFilter = $_GET['consultant'] ?? 'all';
        $roundFilter = $_GET['round'] ?? 'all';
        $searchFilter = trim($_GET['search'] ?? '');

        $sqlFilters = "";
        $isFilteringActive = false;
        if ($statusFilter !== 'all') {
            $sqlFilters .= " AND dl.status = '" . $conn->real_escape_string($statusFilter) . "'";
            $isFilteringActive = true;
        }
        if ($consultantFilter !== 'all') {
            $sqlFilters .= " AND c.name = '" . $conn->real_escape_string($consultantFilter) . "'";
            $isFilteringActive = true;
        }
        if ($roundFilter !== 'all') {
            $sqlFilters .= " AND dr.round_name = '" . $conn->real_escape_string($roundFilter) . "'";
            $isFilteringActive = true;
        }
        if ($searchFilter !== '') {
            $s = $conn->real_escape_string($searchFilter);
            $sqlFilters .= " AND (l.name LIKE '%$s%' OR l.phone LIKE '%$s%' OR l.email LIKE '%$s%')";
            $isFilteringActive = true;
        }

        // Apply silent exclusion rule if no filters active
        if (!$isFilteringActive) {
            $sqlFilters .= " AND dl.status != 'silent'";
        }

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="export_' . date('Ymd_His') . '.csv"');
        // Vô hiệu hóa JSON header đã set ở trên
        header_remove('Content-Type');
        header('Content-Type: text/csv; charset=utf-8');

        $output = fopen('php://output', 'w');
        // Thêm BOM để Excel đọc đúng tiếng Việt
        fputs($output, "\xEF\xBB\xBF");
        fputcsv($output, ['ID', 'Họ Tên', 'SĐT', 'Email', 'Vòng', 'Phân bổ cho', 'Trạng thái', 'Nguồn', 'Ghi chú', 'Thời gian']);

        $res = $conn->query("
            SELECT 
                dl.id, l.name, l.phone, l.email, dr.round_name, c.name as assigned_to_name, 
                dl.status, l.source, l.note, dl.received_at
            FROM distribution_logs dl
            LEFT JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
            WHERE $dateCondition $sqlFilters
            ORDER BY dl.received_at DESC
        ", MYSQLI_USE_RESULT);

        if ($res) {
            $rowCount = 0;
            while ($row = $res->fetch_assoc()) {
                fputcsv($output, [
                    $row['id'],
                    $row['name'],
                    $row['phone'],
                    $row['email'],
                    $row['round_name'],
                    $row['assigned_to_name'],
                    $row['status'],
                    $row['source'],
                    str_replace("\n", " ", $row['note']), // Tránh vỡ form CSV
                    $row['received_at']
                ]);

                $rowCount++;
                if ($rowCount % 500 === 0) {
                    if (ob_get_level() > 0)
                        ob_flush();
                    flush();
                }
            }
        }
        fclose($output);
        exit(); // Kết thúc script ngay lập tức để không lọt JSON rác
        break;

    case 'get_consultants':
        $res = $conn->query("SELECT * FROM consultants ORDER BY created_at DESC");
        $data = [];
        while ($row = $res->fetch_assoc()) {
            if (isset($row['work_schedule']) && $row['work_schedule'] !== null) {
                $row['work_schedule'] = json_decode($row['work_schedule'], true);
            }
            $data[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_consultant':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $name = trim($input['name'] ?? '');
            $email = trim($input['email'] ?? '');
            $status = $input['status'] ?? 'active';
            $zalo_chat_id = trim($input['zalo_chat_id'] ?? '');
            // NEW-03 fix: validate required fields
            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Tên TVV không được để trống']);
                break;
            }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                echo json_encode(['success' => false, 'message' => 'Email không hợp lệ']);
                break;
            }
            // Check duplicate email
            $dupChk = $conn->prepare("SELECT id FROM consultants WHERE email = ?");
            $dupChk->bind_param("s", $email);
            $dupChk->execute();
            $isDup = $dupChk->get_result()->num_rows > 0;
            $dupChk->close();
            if ($isDup) {
                echo json_encode(['success' => false, 'message' => 'Email này đã tồn tại trong hệ thống']);
                break;
            }
            $work_start_time = trim($input['work_start_time'] ?? '00:00');
            $work_end_time = trim($input['work_end_time'] ?? '23:59');
            if (empty($work_start_time) || !preg_match('/^\d{2}:\d{2}$/', $work_start_time)) $work_start_time = '00:00';
            if (empty($work_end_time) || !preg_match('/^\d{2}:\d{2}$/', $work_end_time)) $work_end_time = '23:59';
            $work_schedule = isset($input['work_schedule']) ? (is_array($input['work_schedule']) ? json_encode($input['work_schedule']) : $input['work_schedule']) : null;

            $stmt = $conn->prepare("INSERT INTO consultants (name, email, status, zalo_chat_id, work_start_time, work_end_time, work_schedule) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sssssss", $name, $email, $status, $zalo_chat_id, $work_start_time, $work_end_time, $work_schedule);
            $stmt->execute();
            $newId = $conn->insert_id;
            $stmt->close();

            // Gửi Email Welcome kèm link Zalo Bot
            require_once 'mailer.php';
            $settingStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_link'");
            $botLink = "https://zalo.me/1185588456243371597"; // Default
            if ($settingStmt && $settingStmt->num_rows > 0) {
                $row = $settingStmt->fetch_assoc();
                if (!empty($row['setting_value']))
                    $botLink = $row['setting_value'];
            }
            sendWelcomeEmailToSale($newId, $email, $name, $botLink, true);
            logAdminAction($conn, $decodedUser['id'], 'ADD_CONSULTANT', ['id' => $newId, 'name' => $name, 'email' => $email, 'status' => $status]);

            echo json_encode(['success' => true, 'id' => $newId]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'edit_consultant':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($input['id'] ?? 0);
            $name = trim($input['name'] ?? '');
            $email = trim($input['email'] ?? '');
            $status = $input['status'] ?? 'active';
            $leave_start = !empty($input['leave_start']) ? $input['leave_start'] : null;
            $leave_end = !empty($input['leave_end']) ? $input['leave_end'] : null;
            $zalo_chat_id = !empty($input['zalo_chat_id']) ? trim($input['zalo_chat_id']) : null;

            if (!$id) {
                echo json_encode(['success' => false, 'message' => 'ID không hợp lệ']);
                break;
            }
            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Tên TVV không được để trống']);
                break;
            }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                echo json_encode(['success' => false, 'message' => 'Email không hợp lệ']);
                break;
            }
            // Check duplicate email — but exclude self
            $dupChk2 = $conn->prepare("SELECT id FROM consultants WHERE email = ? AND id != ?");
            $dupChk2->bind_param("si", $email, $id);
            $dupChk2->execute();
            $isDup = $dupChk2->get_result()->num_rows > 0;
            $dupChk2->close();
            if ($isDup) {
                echo json_encode(['success' => false, 'message' => 'Email này đã tồn tại trong hệ thống']);
                break;
            }
            $work_start_time = trim($input['work_start_time'] ?? '00:00');
            $work_end_time = trim($input['work_end_time'] ?? '23:59');
            if (empty($work_start_time) || !preg_match('/^\d{2}:\d{2}$/', $work_start_time)) $work_start_time = '00:00';
            if (empty($work_end_time) || !preg_match('/^\d{2}:\d{2}$/', $work_end_time)) $work_end_time = '23:59';
            $work_schedule = isset($input['work_schedule']) ? (is_array($input['work_schedule']) ? json_encode($input['work_schedule']) : $input['work_schedule']) : null;

            $stmt = $conn->prepare("UPDATE consultants SET name=?, email=?, status=?, leave_start=?, leave_end=?, zalo_chat_id=?, work_start_time=?, work_end_time=?, work_schedule=? WHERE id=?");
            $stmt->bind_param("sssssssssi", $name, $email, $status, $leave_start, $leave_end, $zalo_chat_id, $work_start_time, $work_end_time, $work_schedule, $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'EDIT_CONSULTANT', ['id' => $id, 'name' => $name, 'email' => $email, 'status' => $status]);
            }
            $stmt->close();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'delete_consultant':
        $conn->begin_transaction();
        try {
            $id = (int) ($_GET['id'] ?? 0);
            if (!$id)
                throw new Exception('ID không hợp lệ');

            // Check if consultant has any assigned leads in distribution_logs
            $checkLog = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ?");
            $checkLog->bind_param("i", $id);
            $checkLog->execute();
            $hasLogs = (int) $checkLog->get_result()->fetch_assoc()['cnt'] > 0;
            $checkLog->close();
            if ($hasLogs) {
                throw new Exception("TVV này đã nhận Data, không thể xóa để bảo toàn thống kê. Vui lòng chọn 'Ngưng hoạt động'.");
            }

            $stmtD1 = $conn->prepare("DELETE FROM round_consultants WHERE consultant_id = ?");
            $stmtD1->bind_param("i", $id);
            $stmtD1->execute();
            $stmtD1->close();
            
            $stmtD2 = $conn->prepare("DELETE FROM data_reports WHERE consultant_id = ?");
            $stmtD2->bind_param("i", $id);
            $stmtD2->execute();
            $stmtD2->close();
            
            $stmtD3 = $conn->prepare("DELETE FROM consultants WHERE id = ?");
            $stmtD3->bind_param("i", $id);
            $stmtD3->execute();
            $stmtD3->close();
            logAdminAction($conn, $decodedUser['id'], 'DELETE_CONSULTANT', ['id' => $id]);
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'unlink_zalo':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int) ($input['id'] ?? 0);
        $type = $input['type'] ?? ''; // 'consultant' or 'account'

        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'ID không hợp lệ']);
            break;
        }

        if ($type === 'consultant') {
            $stmt = $conn->prepare("UPDATE consultants SET zalo_chat_id = NULL WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $id);
                if ($stmt->execute()) {
                    logAdminAction($conn, $decodedUser['id'], 'UNLINK_ZALO_CONSULTANT', ['id' => $id]);
                    echo json_encode(['success' => true]);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Không thể hủy liên kết Zalo']);
                }
                $stmt->close();
            } else {
                echo json_encode(['success' => false, 'message' => 'Lỗi chuẩn bị truy vấn SQL']);
            }
        } else if ($type === 'account') {
            $stmt = $conn->prepare("UPDATE accounts SET zalo_chat_id = NULL WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $id);
                if ($stmt->execute()) {
                    logAdminAction($conn, $decodedUser['id'], 'UNLINK_ZALO_ACCOUNT', ['id' => $id]);
                    echo json_encode(['success' => true]);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Không thể hủy liên kết Zalo']);
                }
                $stmt->close();
            } else {
                echo json_encode(['success' => false, 'message' => 'Lỗi chuẩn bị truy vấn SQL']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Loại tài khoản không hợp lệ']);
        }
        break;

    case 'get_rounds':
        $res = $conn->query("SELECT r.*, 
                                    GROUP_CONCAT(c.name ORDER BY c.id ASC) as consultants, 
                                    GROUP_CONCAT(c.id ORDER BY c.id ASC) as consultant_ids,
                                    (SELECT c2.name FROM consultants c2 WHERE c2.id = r.last_assigned_consultant_id) as last_assigned_name
                               FROM distribution_rounds r 
                               LEFT JOIN round_consultants rc ON r.id = rc.round_id
                               LEFT JOIN consultants c ON rc.consultant_id = c.id AND c.status = 'active'
                               GROUP BY r.id");
        $fbRoundId = 0;
        $fbTypeStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_type' LIMIT 1");
        $fbType = ($fbTypeStmt && $fbTypeStmt->num_rows > 0) ? $fbTypeStmt->fetch_assoc()['setting_value'] : 'round';
        if ($fbType === 'round') {
            $fbStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_round_id' LIMIT 1");
            if ($fbStmt && $fbStmt->num_rows > 0) {
                $fbRoundId = (int) $fbStmt->fetch_assoc()['setting_value'];
            }
        }
        $data = [];
        $roundIds = [];
        while ($row = $res->fetch_assoc()) {
            $row['is_fallback'] = ((int) $row['id'] === $fbRoundId);
            $cIds = $row['consultant_ids'] ? explode(',', $row['consultant_ids']) : [];
            $cNames = $row['consultants'] ? explode(',', $row['consultants']) : [];

            $nextName = null;
            $nextId = null;
            if (!empty($cIds)) {
                $nextName = $cNames[0]; // default
                $nextId = $cIds[0];
                if ($row['last_assigned_consultant_id']) {
                    $idx = array_search($row['last_assigned_consultant_id'], $cIds);
                    if ($idx !== false && isset($cNames[$idx + 1])) {
                        $nextName = $cNames[$idx + 1];
                        $nextId = $cIds[$idx + 1];
                    } else {
                        // Loop back to start
                        $nextName = $cNames[0];
                        $nextId = $cIds[0];
                    }
                }
            }
            $row['next_assigned_name'] = $nextName;
            $row['next_consultant_id'] = $nextId;
            $row['ratios'] = [];
            $row['data_per_turns'] = [];
            $row['compensations'] = [];

            $data[$row['id']] = $row;
            $roundIds[] = $row['id'];
        }

        if (!empty($roundIds)) {
            $idsStr = implode(',', $roundIds);
            $ratioRes = $conn->query("SELECT round_id, consultant_id, receive_ratio, data_per_turn, compensation_count FROM round_consultants WHERE round_id IN ($idsStr)");
            while ($rr = $ratioRes->fetch_assoc()) {
                $rId = $rr['round_id'];
                $cId = $rr['consultant_id'];
                $data[$rId]['ratios'][$cId] = (int) $rr['receive_ratio'];
                $data[$rId]['data_per_turns'][$cId] = (int) ($rr['data_per_turn'] ?? 1);
                $data[$rId]['compensations'][$cId] = (int) $rr['compensation_count'];
            }
        }

        echo json_encode(['success' => true, 'data' => array_values($data)]);
        break;

    case 'add_round':
        $conn->begin_transaction();
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['round_name'] ?? '';
            $cc = $input['cc_emails'] ?? '';
            $status = $input['is_active'] ?? 1;
            $consultants = $input['consultants'] ?? [];
            $starting_consultant_id = $input['starting_consultant_id'] ?? null;

            $last_assigned = null;
            if ($starting_consultant_id && !empty($consultants)) {
                $sorted_consultants = $consultants;
                sort($sorted_consultants);
                $idx = array_search($starting_consultant_id, $sorted_consultants);
                if ($idx !== false) {
                    if ($idx === 0) {
                        $last_assigned = end($sorted_consultants);
                        reset($sorted_consultants);
                    } else {
                        $last_assigned = $sorted_consultants[$idx - 1];
                    }
                }
            }

            $stmt = $conn->prepare("INSERT INTO distribution_rounds (round_name, is_active, cc_emails, last_assigned_consultant_id) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("sisi", $name, $status, $cc, $last_assigned);
            $stmt->execute();
            $roundId = $conn->insert_id;
            $stmt->close();

            $ratios = $input['ratios'] ?? [];
            $per_turns = $input['data_per_turns'] ?? [];

            $compensations = $input['compensations'] ?? [];

            if (!empty($consultants)) {
                $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn, compensation_count) VALUES (?, ?, ?, ?, ?)");
                foreach ($consultants as $cid) {
                    $ratio = isset($ratios[$cid]) ? max(1, (int) $ratios[$cid]) : 1;
                    $perTurn = isset($per_turns[$cid]) ? max(1, (int) $per_turns[$cid]) : 1;
                    $comp = isset($compensations[$cid]) ? max(0, (int) $compensations[$cid]) : 0;
                    $stmtC->bind_param("iiiii", $roundId, $cid, $ratio, $perTurn, $comp);
                    $stmtC->execute();
                }
                $stmtC->close();
            }

            $is_fallback = filter_var($input['is_fallback'] ?? false, FILTER_VALIDATE_BOOLEAN);
            if ($is_fallback) {
                $fbStmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('fallback_round_id', ?)");
                $fbRoundIdStr = (string) $roundId;
                $fbStmt->bind_param("s", $fbRoundIdStr);
                $fbStmt->execute();
                $fbStmt->close();
                $conn->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('fallback_type', 'round')");
            }

            logAdminAction($conn, $decodedUser['id'], 'ADD_ROUND', ['id' => $roundId, 'round_name' => $name, 'consultants' => $consultants]);
            $conn->commit();
            echo json_encode(['success' => true, 'id' => $roundId]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'edit_round':
        $conn->begin_transaction();
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($input['id'] ?? 0);
            $name = $input['round_name'] ?? '';
            $cc = $input['cc_emails'] ?? '';
            $status = $input['is_active'] ?? 1;
            $consultants = $input['consultants'] ?? [];
            $starting_consultant_id = $input['starting_consultant_id'] ?? null;

            $last_assigned = null;
            if ($starting_consultant_id && !empty($consultants)) {
                $sorted_consultants = $consultants;
                sort($sorted_consultants);
                $idx = array_search($starting_consultant_id, $sorted_consultants);
                if ($idx !== false) {
                    if ($idx === 0) {
                        $last_assigned = end($sorted_consultants);
                        reset($sorted_consultants);
                    } else {
                        $last_assigned = $sorted_consultants[$idx - 1];
                    }
                }
            }

            if ($starting_consultant_id) {
                $stmt = $conn->prepare("UPDATE distribution_rounds SET round_name=?, is_active=?, cc_emails=?, last_assigned_consultant_id=? WHERE id=?");
                $stmt->bind_param("sisii", $name, $status, $cc, $last_assigned, $id);
            } else {
                $stmt = $conn->prepare("UPDATE distribution_rounds SET round_name=?, is_active=?, cc_emails=? WHERE id=?");
                $stmt->bind_param("sisi", $name, $status, $cc, $id);
            }
            $stmt->execute();
            $stmt->close();

            // Delete consultants that are no longer in this round
            if (empty($consultants)) {
                $stmtDel = $conn->prepare("DELETE FROM round_consultants WHERE round_id=?");
                $stmtDel->bind_param("i", $id);
                $stmtDel->execute();
                $stmtDel->close();
            } else {
                $placeholders = implode(',', array_fill(0, count($consultants), '?'));
                $stmtDel = $conn->prepare("DELETE FROM round_consultants WHERE round_id=? AND consultant_id NOT IN ($placeholders)");
                $params = array_merge([$id], $consultants);
                $types = str_repeat('i', count($params));
                $stmtDel->bind_param($types, ...$params);
                $stmtDel->execute();
                $stmtDel->close();
            }

            $ratios = $input['ratios'] ?? [];
            $per_turns = $input['data_per_turns'] ?? [];

            $compensations = $input['compensations'] ?? [];

            if (!empty($consultants)) {
                $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn, compensation_count) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE receive_ratio = VALUES(receive_ratio), data_per_turn = VALUES(data_per_turn), compensation_count = VALUES(compensation_count), current_turn_remaining = 0");
                foreach ($consultants as $cid) {
                    $ratio = isset($ratios[$cid]) ? max(1, (int) $ratios[$cid]) : 1;
                    $perTurn = isset($per_turns[$cid]) ? max(1, (int) $per_turns[$cid]) : 1;
                    $comp = isset($compensations[$cid]) ? max(0, (int) $compensations[$cid]) : 0;
                    $stmtC->bind_param("iiiii", $id, $cid, $ratio, $perTurn, $comp);
                    $stmtC->execute();
                }
                $stmtC->close();
            }

            $is_fallback = filter_var($input['is_fallback'] ?? false, FILTER_VALIDATE_BOOLEAN);
            if ($is_fallback) {
                $fbStmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('fallback_round_id', ?)");
                $fbRoundIdStr = (string) $id;
                $fbStmt->bind_param("s", $fbRoundIdStr);
                $fbStmt->execute();
                $fbStmt->close();
                $conn->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('fallback_type', 'round')");
            } else {
                $chkStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_round_id' LIMIT 1");
                if ($chkStmt && $chkStmt->num_rows > 0) {
                    $currFb = $chkStmt->fetch_assoc()['setting_value'];
                    if ((int) $currFb === $id) {
                        $conn->query("DELETE FROM system_settings WHERE setting_key = 'fallback_round_id'");
                    }
                }
            }

            logAdminAction($conn, $decodedUser['id'], 'EDIT_ROUND', ['id' => $id, 'round_name' => $name, 'consultants' => $consultants]);
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;


    case 'update_compensations':
        $conn->begin_transaction();
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $roundId = (int) ($input['round_id'] ?? 0);
            $compensations = $input['compensations'] ?? [];

            $notificationQueue = [];

            if ($roundId > 0 && !empty($compensations)) {
                // Fetch round name
                $rStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                $rStmt->bind_param("i", $roundId);
                $rStmt->execute();
                $rRes = $rStmt->get_result();
                $roundRow = $rRes->fetch_assoc();
                $roundName = $roundRow ? $roundRow['round_name'] : "Vòng ID $roundId";
                $rStmt->close();

                $stmtFetch = $conn->prepare("
                    SELECT rc.compensation_count, c.name, c.email
                    FROM round_consultants rc
                    JOIN consultants c ON rc.consultant_id = c.id
                    WHERE rc.round_id = ? AND rc.consultant_id = ?
                ");

                $stmtComp = $conn->prepare("UPDATE round_consultants SET compensation_count = ? WHERE round_id = ? AND consultant_id = ?");
                foreach ($compensations as $cid => $compCount) {
                    $c = (int) $cid;
                    $count = max(0, (int) $compCount);

                    $stmtFetch->bind_param("ii", $roundId, $c);
                    $stmtFetch->execute();
                    $fRes = $stmtFetch->get_result();
                    
                    if ($fRow = $fRes->fetch_assoc()) {
                        $oldCount = (int) $fRow['compensation_count'];
                        $delta = $count - $oldCount;
                        
                        $stmtComp->bind_param("iii", $count, $roundId, $c);
                        $stmtComp->execute();

                        if ($delta > 0) {
                            $notificationQueue[] = [
                                'consultant_id' => $c,
                                'email' => $fRow['email'],
                                'name' => $fRow['name'],
                                'round_name' => $roundName,
                                'delta' => $delta
                            ];
                        }
                    } else {
                        $stmtComp->bind_param("iii", $count, $roundId, $c);
                        $stmtComp->execute();
                    }
                }
            }
            logAdminAction($conn, $decodedUser['id'], 'UPDATE_COMPENSATIONS', ['round_id' => $roundId, 'compensations' => $compensations]);
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // Đã commit giao dịch thành công. Bắt đầu gửi thông báo ngoài transaction
        if (!empty($notificationQueue)) {
            try {
                require_once __DIR__ . '/mailer.php';
                require_once __DIR__ . '/zalo_bot.php';

                foreach ($notificationQueue as $notify) {
                    try {
                        if (!empty($notify['email'])) {
                            sendCompensationAddedEmailToSale($notify['email'], $notify['name'], $notify['round_name'], $notify['delta']);
                        }
                    } catch (Exception $mailEx) {
                        error_log("Error sending compensation email to sale " . $notify['consultant_id'] . ": " . $mailEx->getMessage());
                    }

                    try {
                        sendCompensationAddedZaloMessageToSale($notify['consultant_id'], $notify['name'], $notify['round_name'], $notify['delta']);
                    } catch (Exception $zaloEx) {
                        error_log("Error sending compensation Zalo to sale " . $notify['consultant_id'] . ": " . $zaloEx->getMessage());
                    }
                }
            } catch (Exception $notifyEx) {
                error_log("General notification error in update_compensations: " . $notifyEx->getMessage());
            }
        }

        echo json_encode(['success' => true]);
        break;

    case 'delete_round':
        $conn->begin_transaction();
        try {
            $id = (int) ($_GET['id'] ?? 0);

            // Check if round has any distribution logs
            $checkLog = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE round_id = ?");
            $checkLog->bind_param("i", $id);
            $checkLog->execute();
            $logCount = (int) ($checkLog->get_result()->fetch_assoc()['cnt'] ?? 0);
            $checkLog->close();
            if ($logCount > 0) {
                throw new Exception("Vòng này đã phân bổ Data, không thể xóa để bảo toàn thống kê. Vui lòng chuyển sang Ngừng hoạt động.");
            }

            $stmt1 = $conn->prepare("DELETE FROM round_consultants WHERE round_id=?");
            $stmt1->bind_param("i", $id);
            $stmt1->execute();
            $stmt1->close();

            $stmt2 = $conn->prepare("DELETE FROM data_reports WHERE round_id=?");
            $stmt2->bind_param("i", $id);
            $stmt2->execute();
            $stmt2->close();

            $stmt = $conn->prepare("DELETE FROM distribution_rounds WHERE id=?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $stmt->close();

            $chkStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_round_id' LIMIT 1");
            if ($chkStmt && $chkStmt->num_rows > 0) {
                $currFb = $chkStmt->fetch_assoc()['setting_value'];
                if ((int) $currFb === $id) {
                    $conn->query("DELETE FROM system_settings WHERE setting_key = 'fallback_round_id'");
                }
            }

            logAdminAction($conn, $decodedUser['id'], 'DELETE_ROUND', ['id' => $id]);
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'get_connections':
        $res = $conn->query("SELECT * FROM sheet_connections ORDER BY created_at DESC");
        $conns = [];
        while ($row = $res->fetch_assoc()) {
            $row['stats'] = [
                'total' => 0,
                'assigned' => 0,
                'duplicate' => 0,
                'reminder' => 0,
                'error' => 0
            ];
            $conns[] = $row;
        }

        // Fetch stats grouped by connection_id for the last 30 days to prevent full table join bottleneck
        $statsRes = $conn->query("
            SELECT 
                l.connection_id,
                l.source,
                COUNT(DISTINCT l.id) as total_leads,
                SUM(CASE WHEN dl.status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
                SUM(CASE WHEN dl.status = 'duplicate' THEN 1 ELSE 0 END) as duplicate_count,
                SUM(CASE WHEN dl.status = 'reminder' THEN 1 ELSE 0 END) as reminder_count,
                SUM(CASE WHEN dl.status = 'error' THEN 1 ELSE 0 END) as error_count
            FROM leads l
            LEFT JOIN distribution_logs dl ON l.id = dl.lead_id
            WHERE (l.connection_id IS NOT NULL OR l.source IS NOT NULL)
              AND l.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY l.connection_id, l.source
        ");

        $sourceStats = [];
        if ($statsRes) {
            while ($row = $statsRes->fetch_assoc()) {
                $sourceStats[] = $row; // Store all rows instead of keying by source
            }
        }

        foreach ($conns as &$c) {
            $src = $c['sheet_name'];
            $connId = $c['id'];

            // Sum up all matching stats (either by connection_id, or by fallback source if connection_id is null)
            foreach ($sourceStats as $stat) {
                if ($stat['connection_id'] == $connId || (empty($stat['connection_id']) && !empty($stat['source']) && $stat['source'] == $src)) {
                    $c['stats']['total'] += (int) $stat['total_leads'];
                    $c['stats']['assigned'] += (int) $stat['assigned_count'];
                    $c['stats']['duplicate'] += (int) $stat['duplicate_count'];
                    $c['stats']['reminder'] += (int) $stat['reminder_count'];
                    $c['stats']['error'] += (int) $stat['error_count'];
                }
            }
        }

        echo json_encode(['success' => true, 'data' => $conns]);
        break;

    case 'add_connection':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['sheet_name'] ?? '';
            $spreadsheetId = $input['spreadsheet_id'] ?? '';
            $webhookToken = $input['webhook_token'] ?? '';
            $isActive = (int) ($input['is_active'] ?? 1);
            $syncInterval = (int) ($input['sync_interval'] ?? 15);
            $requireBoth = (int) ($input['require_both_contact'] ?? 0);
            $connectionType = $input['connection_type'] ?? 'sheets';
            $syncMode = $input['sync_mode'] ?? 'all';
            $isSilent = (int) ($input['is_silent'] ?? 0);
            $syncSaleperson = (int) ($input['sync_saleperson'] ?? 0);
            $emailTemplate = $input['email_template'] ?? null;

            $stmt = $conn->prepare("INSERT INTO sheet_connections (sheet_name, spreadsheet_id, webhook_token, is_active, sync_interval, require_both_contact, connection_type, sync_mode, is_silent, sync_saleperson, email_template, is_initialized) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)");
            $stmt->bind_param("sssiiissiis", $name, $spreadsheetId, $webhookToken, $isActive, $syncInterval, $requireBoth, $connectionType, $syncMode, $isSilent, $syncSaleperson, $emailTemplate);
            if ($stmt->execute()) {
                $insertId = $stmt->insert_id;
                logAdminAction($conn, $decodedUser['id'], 'ADD_CONNECTION', ['id' => $insertId, 'sheet_name' => $name]);
            } else {
                $insertId = 0;
            }
            $stmt->close();
            echo json_encode(['success' => true, 'id' => $insertId]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'edit_connection':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($input['id'] ?? 0);
            $name = $input['sheet_name'] ?? '';
            $spreadsheetId = $input['spreadsheet_id'] ?? '';
            $isActive = (int) ($input['is_active'] ?? 1);
            $syncInterval = (int) ($input['sync_interval'] ?? 15);
            $requireBoth = (int) ($input['require_both_contact'] ?? 0);
            $connectionType = $input['connection_type'] ?? 'sheets';
            $syncMode = $input['sync_mode'] ?? 'all';
            $isSilent = (int) ($input['is_silent'] ?? 0);
            $syncSaleperson = (int) ($input['sync_saleperson'] ?? 0);
            $emailTemplate = $input['email_template'] ?? null;

            $stmt = $conn->prepare("UPDATE sheet_connections SET sheet_name=?, spreadsheet_id=?, is_active=?, sync_interval=?, require_both_contact=?, connection_type=?, sync_mode=?, is_silent=?, sync_saleperson=?, email_template=?, is_initialized=0, last_sync_at=NULL WHERE id=?");
            $stmt->bind_param("ssiiissiisi", $name, $spreadsheetId, $isActive, $syncInterval, $requireBoth, $connectionType, $syncMode, $isSilent, $syncSaleperson, $emailTemplate, $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'EDIT_CONNECTION', ['id' => $id, 'sheet_name' => $name]);
            }
            $stmt->close();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'delete_connection':
        $conn->begin_transaction();
        try {
            $id = (int) ($_GET['id'] ?? 0);

            $stmt1 = $conn->prepare("DELETE FROM field_mappings WHERE connection_id=?");
            $stmt1->bind_param("i", $id);
            $stmt1->execute();
            $stmt1->close();

            $stmt2 = $conn->prepare("DELETE FROM routing_rules WHERE connection_id=?");
            $stmt2->bind_param("i", $id);
            $stmt2->execute();
            $stmt2->close();

            $stmt3 = $conn->prepare("DELETE FROM sheet_sync_records WHERE connection_id=?");
            $stmt3->bind_param("i", $id);
            $stmt3->execute();
            $stmt3->close();

            $stmt = $conn->prepare("DELETE FROM sheet_connections WHERE id=?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $stmt->close();
            logAdminAction($conn, $decodedUser['id'], 'DELETE_CONNECTION', ['id' => $id]);
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'fetch_sheets':
        $sheetId = $_GET['id'] ?? '';
        if (empty($sheetId)) {
            echo json_encode(['success' => false, 'message' => 'Missing ID']);
            break;
        }
        $url = "https://docs.google.com/spreadsheets/d/" . trim($sheetId) . "/htmlview";
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15); // MISSING-FIX: Tránh server treo vô hạn khi Google Sheets không phản hồi
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        $html = curl_exec($ch);
        curl_close($ch);

        $sheets = [];

        // Pattern 1: JS items array (most reliable for modern Google Sheets htmlview)
        if (preg_match_all('/items\.push\(\{name:\s*"([^"]+)"/i', $html, $matches)) {
            $sheets = array_map(function ($val) {
                return str_replace('\/', '/', $val);
            }, $matches[1]);
        }

        // Pattern 2: HTML sheet buttons tab menu (for published public pages or older sheets)
        if (empty($sheets) && preg_match_all('/<li\s+id="sheet-button-.*?"><a\s+href=".*?">(.*?)<\/a><\/li>/i', $html, $matches)) {
            $sheets = $matches[1];
        }

        // Pattern 3: Naive JSON property fallback
        if (empty($sheets) && preg_match_all('/"name"\s*:\s*"([^"]+)"\s*,\s*"sheetId"/i', $html, $matches)) {
            $sheets = array_values(array_unique($matches[1]));
            $sheets = array_filter($sheets, function ($v) {
                return !in_array($v, ['Arial', 'Verdana', 'Helvetica', 'Times New Roman']);
            });
            $sheets = array_values($sheets);
        }

        echo json_encode(['success' => true, 'sheets' => $sheets]);
        break;

    case 'fetch_columns':
        $sheetId = $_GET['id'] ?? '';
        $sheetName = $_GET['name'] ?? '';
        if (empty($sheetId)) {
            echo json_encode(['success' => false, 'message' => 'Missing ID']);
            break;
        }

        $csvUrl = "https://docs.google.com/spreadsheets/d/" . trim($sheetId) . "/gviz/tq?tqx=out:csv";
        if (!empty($sheetName)) {
            $csvUrl .= "&sheet=" . urlencode($sheetName);
        }

        $ch = curl_init($csvUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15); // MISSING-FIX: Tránh server treo vô hạn khi Google Sheets không phản hồi
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($csvData)) {
            echo json_encode(['success' => false, 'message' => 'Failed to fetch spreadsheet columns']);
            break;
        }

        $columns = [];
        $stream = fopen("php://temp", "r+");
        fwrite($stream, $csvData);
        rewind($stream);

        $row = fgetcsv($stream);
        if ($row !== FALSE) {
            $columns = array_map(function ($h) {
                return trim($h ?? '', "\" ");
            }, $row);
            $columns = array_filter($columns, function ($c) {
                return $c !== '';
            });
            $columns = array_values($columns);
        }
        fclose($stream);

        echo json_encode(['success' => true, 'columns' => $columns]);
        break;

    case 'toggle_connection':
        try {
            $id = (int) ($_GET['id'] ?? 0);
            $active = (int) ($_GET['active'] ?? 0);
            $stmt = $conn->prepare("UPDATE sheet_connections SET is_active=? WHERE id=?");
            $stmt->bind_param("ii", $active, $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'TOGGLE_CONNECTION', ['id' => $id, 'is_active' => $active]);
            }
            $stmt->close();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'toggle_require_both':
        try {
            $id = (int) ($_GET['id'] ?? 0);
            $require = (int) ($_GET['require'] ?? 0);
            $stmt = $conn->prepare("UPDATE sheet_connections SET require_both_contact=? WHERE id=?");
            $stmt->bind_param("ii", $require, $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'TOGGLE_REQUIRE_BOTH', ['id' => $id, 'require_both_contact' => $require]);
            }
            $stmt->close();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'get_rules':
        $res = $conn->query("SELECT rr.*, r.round_name 
                               FROM routing_rules rr 
                               LEFT JOIN distribution_rounds r ON rr.target_round_id = r.id 
                               ORDER BY rr.priority ASC");
        $data = [];
        while ($row = $res->fetch_assoc())
            $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_rule':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $col = $input['condition_column'] ?? '';
            $op = $input['condition_operator'] ?? '';
            $val = $input['condition_value'] ?? '';
            $conditions_json = isset($input['conditions_json']) ? json_encode($input['conditions_json']) : null;
            $logical_operator = $input['logical_operator'] ?? 'AND';
            $target = (int) ($input['target_round_id'] ?? 0);
            $conn_id = isset($input['connection_id']) && $input['connection_id'] !== 'all' ? (string) $input['connection_id'] : null;

            // Ensure column can store comma-separated values
            $conn->query("ALTER TABLE routing_rules MODIFY connection_id VARCHAR(255) NULL");

            $stmt = $conn->prepare("INSERT INTO routing_rules (connection_id, condition_column, condition_operator, condition_value, target_round_id, conditions_json, logical_operator) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssiss", $conn_id, $col, $op, $val, $target, $conditions_json, $logical_operator);
            
            if (!$stmt->execute()) {
                // If it's a foreign key constraint error due to negative IDs
                if (strpos($stmt->error, 'foreign key constraint fails') !== false) {
                    $conn->query("ALTER TABLE routing_rules DROP FOREIGN KEY routing_rules_ibfk_1");
                    // Retry execution
                    if (!$stmt->execute()) {
                        throw new Exception($stmt->error);
                    }
                } else {
                    throw new Exception($stmt->error);
                }
            }
            $newRuleId = $conn->insert_id;
            logAdminAction($conn, $decodedUser['id'], 'ADD_RULE', ['id' => $newRuleId, 'target_round_id' => $target, 'logical_operator' => $logical_operator]);
            $stmt->close();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            // Self-healing attempt 2: maybe the constraint name is different
            if (strpos($e->getMessage(), 'foreign key constraint fails') !== false) {
                // Try to find the constraint name dynamically
                $res = $conn->query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'routing_rules' AND COLUMN_NAME = 'connection_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1");
                if ($res && $res->num_rows > 0) {
                    $fkName = $res->fetch_assoc()['CONSTRAINT_NAME'];
                    $conn->query("ALTER TABLE routing_rules DROP FOREIGN KEY " . $fkName);
                    // Retry again
                    $stmt->execute();
                    $newRuleId = $conn->insert_id;
                    logAdminAction($conn, $decodedUser['id'], 'ADD_RULE', ['id' => $newRuleId, 'target_round_id' => $target, 'logical_operator' => $logical_operator]);
                    $stmt->close();
                    echo json_encode(['success' => true]);
                    break;
                }
            }
            if (isset($stmt)) {
                $stmt->close();
            }
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'delete_rule':
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM routing_rules WHERE id=?");
        $stmt->bind_param("i", $id);
        if ($stmt->execute()) {
            logAdminAction($conn, $decodedUser['id'], 'DELETE_RULE', ['id' => $id]);
        }
        $stmt->close();
        echo json_encode(['success' => true]);
        break;

    case 'edit_rule':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($input['id'] ?? 0);
            $col = $input['condition_column'] ?? '';
            $op = $input['condition_operator'] ?? '';
            $val = $input['condition_value'] ?? '';
            $conditions_json = isset($input['conditions_json']) ? json_encode($input['conditions_json']) : null;
            $logical_operator = $input['logical_operator'] ?? 'AND';
            $target = (int) ($input['target_round_id'] ?? 0);
            $conn_id = isset($input['connection_id']) && $input['connection_id'] !== 'all' ? (string) $input['connection_id'] : null;

            // Ensure column can store comma-separated values
            $conn->query("ALTER TABLE routing_rules MODIFY connection_id VARCHAR(255) NULL");

            $stmt = $conn->prepare("UPDATE routing_rules SET connection_id=?, condition_column=?, condition_operator=?, condition_value=?, target_round_id=?, conditions_json=?, logical_operator=? WHERE id=?");
            $stmt->bind_param("ssssissi", $conn_id, $col, $op, $val, $target, $conditions_json, $logical_operator, $id);
            
            if (!$stmt->execute()) {
                // If it's a foreign key constraint error due to negative IDs
                if (strpos($stmt->error, 'foreign key constraint fails') !== false) {
                    $conn->query("ALTER TABLE routing_rules DROP FOREIGN KEY routing_rules_ibfk_1");
                    // Retry execution
                    if (!$stmt->execute()) {
                        throw new Exception($stmt->error);
                    }
                } else {
                    throw new Exception($stmt->error);
                }
            }
            logAdminAction($conn, $decodedUser['id'], 'EDIT_RULE', ['id' => $id, 'target_round_id' => $target, 'logical_operator' => $logical_operator]);
            $stmt->close();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            // Self-healing attempt 2: maybe the constraint name is different
            if (strpos($e->getMessage(), 'foreign key constraint fails') !== false) {
                // Try to find the constraint name dynamically
                $res = $conn->query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'routing_rules' AND COLUMN_NAME = 'connection_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1");
                if ($res && $res->num_rows > 0) {
                    $fkName = $res->fetch_assoc()['CONSTRAINT_NAME'];
                    $conn->query("ALTER TABLE routing_rules DROP FOREIGN KEY " . $fkName);
                    // Retry again
                    $stmt->execute();
                    logAdminAction($conn, $decodedUser['id'], 'EDIT_RULE', ['id' => $id, 'target_round_id' => $target, 'logical_operator' => $logical_operator]);
                    $stmt->close();
                    echo json_encode(['success' => true]);
                    break;
                }
            }
            if (isset($stmt)) {
                $stmt->close();
            }
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'reorder_rules':
        $conn->begin_transaction();
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $order = $input['order'] ?? [];
            $stmt = $conn->prepare("UPDATE routing_rules SET priority=? WHERE id=?");
            foreach ($order as $index => $id) {
                $id = (int) $id;
                $priority = $index + 1;
                $stmt->bind_param("ii", $priority, $id);
                $stmt->execute();
            }
            $stmt->close();
            logAdminAction($conn, $decodedUser['id'], 'REORDER_RULES', ['order' => $order]);
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    // --- REPORT DATA ENDPOINTS ---
    case 'get_report_context':
        // PUBLIC: Load lead/consultant/round info for the report page
        $lead_id = (int) ($_GET['lead_id'] ?? 0);
        $sale_id = (int) ($_GET['sale_id'] ?? 0);
        $round_id = (int) ($_GET['round_id'] ?? 0);

        if (!$lead_id || !$sale_id || !$round_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu tham số']);
            break;
        }

        // Verify ownership: lead must be assigned to this consultant in this round
        $verifyStmt = $conn->prepare("
            SELECT dl.id, l.name as lead_name, l.phone as lead_phone, l.source, l.note,
                   c.name as consultant_name, c.email as consultant_email,
                   dr.round_name, dl.received_at
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            JOIN consultants c ON dl.assigned_to = c.id
            JOIN distribution_rounds dr ON dl.round_id = dr.id
            WHERE dl.lead_id = ? AND dl.assigned_to = ? AND dl.round_id = ?
            ORDER BY dl.received_at DESC LIMIT 1
        ");
        $verifyStmt->bind_param("iii", $lead_id, $sale_id, $round_id);
        $verifyStmt->execute();
        $ctx = $verifyStmt->get_result()->fetch_assoc();

        if (!$ctx) {
            echo json_encode(['success' => false, 'message' => 'Đường dẫn không hợp lệ hoặc thông tin không khớp với hệ thống.']);
            break;
        }

        // Check if already has a pending report
        $pendingChk = $conn->prepare("SELECT id, status FROM data_reports WHERE lead_id=? AND consultant_id=? AND round_id=? ORDER BY created_at DESC LIMIT 1");
        $pendingChk->bind_param("iii", $lead_id, $sale_id, $round_id);
        $pendingChk->execute();
        $existingReport = $pendingChk->get_result()->fetch_assoc();

        echo json_encode([
            'success' => true,
            'data' => [
                'lead_name' => $ctx['lead_name'],
                'lead_phone' => $ctx['lead_phone'],
                'lead_source' => $ctx['source'],
                'lead_note' => $ctx['note'],
                'consultant_name' => $ctx['consultant_name'],
                'consultant_email' => $ctx['consultant_email'],
                'round_name' => $ctx['round_name'],
                'assigned_at' => $ctx['received_at'],
                'existing_report' => $existingReport ? $existingReport['status'] : null,
            ]
        ]);
        break;

    case 'submit_report':
        $input = json_decode(file_get_contents('php://input'), true);
        $lead_id = (int) ($input['lead_id'] ?? 0);
        $sale_id = (int) ($input['sale_id'] ?? 0);
        $round_id = (int) ($input['round_id'] ?? 0);
        $reason = trim($input['reason'] ?? '');

        if (!$lead_id || !$sale_id || !$round_id || empty($reason)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin bắt buộc']);
            break;
        }

        // SECURITY: Verify ownership — lead must truly belong to this consultant in this round
        $verifyStmt = $conn->prepare("
            SELECT id FROM distribution_logs 
            WHERE lead_id = ? AND assigned_to = ? AND round_id = ? 
            LIMIT 1
        ");
        $verifyStmt->bind_param("iii", $lead_id, $sale_id, $round_id);
        $verifyStmt->execute();
        $verifyRes = $verifyStmt->get_result();
        $verifyStmt->close();
        if ($verifyRes->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Thông tin không hợp lệ: Data này không thuộc về bạn trong vòng này.']);
            break;
        }

        // Prevent duplicate pending reports for same lead + consultant + round
        $checkStmt = $conn->prepare("SELECT id FROM data_reports WHERE lead_id=? AND consultant_id=? AND round_id=? AND status='pending'");
        $checkStmt->bind_param("iii", $lead_id, $sale_id, $round_id);
        $checkStmt->execute();
        $checkRes = $checkStmt->get_result();
        $checkStmt->close();
        if ($checkRes->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Bạn đã báo cáo Lead này và đang chờ duyệt!']);
            break;
        }

        // Fetch lead's connection_id
        $leadConnId = 0;
        $leadQuery = $conn->prepare("SELECT connection_id FROM leads WHERE id = ? LIMIT 1");
        $leadQuery->bind_param("i", $lead_id);
        $leadQuery->execute();
        $resLeadInfo = $leadQuery->get_result()->fetch_assoc();
        if ($resLeadInfo) {
            $leadConnId = (int)$resLeadInfo['connection_id'];
        }
        $leadQuery->close();

        // Auto-approve check using rules
        $autoAppEnabled = false;
        $enabledRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'ticket_auto_approve_enabled' LIMIT 1");
        if ($enabledRes && $row = $enabledRes->fetch_assoc()) {
            $autoAppEnabled = ($row['setting_value'] === '1' || $row['setting_value'] === 1 || $row['setting_value'] == 1);
        }

        $autoApproved = false;
        $matchedKeyword = '';
        $matchedRuleName = '';

        if ($autoAppEnabled) {
            $autoAppRulesSetting = '';
            $settingsRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'ticket_auto_approve_rules' LIMIT 1");
            if ($settingsRes && $row = $settingsRes->fetch_assoc()) {
                $autoAppRulesSetting = trim($row['setting_value']);
            }

            if (!empty($autoAppRulesSetting)) {
                $rules = json_decode($autoAppRulesSetting, true);
                if (is_array($rules)) {
                    $reasonLower = mb_strtolower($reason, 'UTF-8');
                    foreach ($rules as $rule) {
                        if (empty($rule['active'])) {
                            continue;
                        }

                        // 1. Check round condition
                        $roundMatch = false;
                        $ruleRounds = $rule['rounds'] ?? [];
                        if (empty($ruleRounds) || in_array('all', $ruleRounds) || in_array((string)$round_id, array_map('strval', $ruleRounds))) {
                            $roundMatch = true;
                        }
                        if (!$roundMatch) {
                            continue;
                        }

                        // 2. Check sale condition
                        $saleMatch = false;
                        $ruleSales = $rule['sales'] ?? [];
                        if (empty($ruleSales) || in_array('all', $ruleSales) || in_array((string)$sale_id, array_map('strval', $ruleSales))) {
                            $saleMatch = true;
                        }
                        if (!$saleMatch) {
                            continue;
                        }

                        // 3. Check source (connection_id) condition
                        $sourceMatch = false;
                        $ruleConnections = $rule['connections'] ?? [];
                        if (empty($ruleConnections) || in_array('all', $ruleConnections) || in_array((string)$leadConnId, array_map('strval', $ruleConnections))) {
                            $sourceMatch = true;
                        }
                        if (!$sourceMatch) {
                            continue;
                        }

                        // 4. Check keywords/reasons
                        $keywords = $rule['keywords'] ?? [];
                        if (!is_array($keywords) && is_string($keywords)) {
                            $keywords = array_map('trim', explode(',', $keywords));
                        }
                        $keywords = array_filter($keywords);

                        foreach ($keywords as $kw) {
                            $kwLower = mb_strtolower($kw, 'UTF-8');
                            if (mb_strpos($reasonLower, $kwLower) !== false) {
                                $autoApproved = true;
                                $matchedKeyword = $kw;
                                $matchedRuleName = $rule['name'] ?? 'Luật tự động';
                                break 2;
                            }
                        }
                    }
                }
            }
        }

        if ($autoApproved) {
            $conn->begin_transaction();
            try {
                // 1. Insert report as approved
                $stmt = $conn->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, status, resolved_at) VALUES (?, ?, ?, ?, 'approved', NOW())");
                $stmt->bind_param("iiis", $lead_id, $sale_id, $round_id, $reason);
                $stmt->execute();
                $report_id = $stmt->insert_id;
                $stmt->close();

                // 2. Mark lead as faulty
                $faultyMsg = "[LỖI - TỰ ĐỘNG DUYỆT (Luật: $matchedRuleName, Từ khóa: $matchedKeyword)]: " . $reason;
                $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
                $updLead->bind_param("si", $faultyMsg, $lead_id);
                $updLead->execute();
                $updLead->close();

                // 3. Mark distribution_logs as error
                $updLog = $conn->prepare("UPDATE distribution_logs SET status='error' WHERE lead_id=? AND assigned_to=? AND round_id=?");
                $updLog->bind_param("iii", $lead_id, $sale_id, $round_id);
                $updLog->execute();
                $updLog->close();

                // 4. Increment compensation_count for the consultant in that round
                $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id=? AND consultant_id=?");
                $updComp->bind_param("ii", $round_id, $sale_id);
                $updComp->execute();
                $updComp->close();

                logAdminAction($conn, 0, 'AUTO_APPROVE_REPORT', [
                    'report_id' => $report_id,
                    'lead_id' => $lead_id,
                    'consultant_id' => $sale_id,
                    'round_id' => $round_id,
                    'rule_name' => $matchedRuleName,
                    'keyword' => $matchedKeyword
                ]);

                $conn->commit();

                // Fetch Sale & Lead info for notifications
                $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
                $consultStmt->bind_param("i", $sale_id);
                $consultStmt->execute();
                $consultant = $consultStmt->get_result()->fetch_assoc();
                $consultStmt->close();

                $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
                $leadStmt->bind_param("i", $lead_id);
                $leadStmt->execute();
                $lead = $leadStmt->get_result()->fetch_assoc();
                $leadStmt->close();

                $cName = $consultant['name'] ?? 'Bạn';
                $lName = $lead['name'] ?? 'Khách hàng';
                $lPhone = $lead['phone'] ?? 'Không rõ';

                // Send Zalo to Sale
                require_once __DIR__ . '/zalo_bot.php';
                $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

                if (!empty($botToken) && !empty($consultant['zalo_chat_id'])) {
                    $zaloMsg = "[ TICKET ĐÃ ĐƯỢC TỰ ĐỘNG DUYỆT ]\n\n"
                        . "Chào $cName, báo cáo lỗi Data của bạn đã được HỆ THỐNG TỰ ĐỘNG PHÊ DUYỆT.\n\n"
                        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                        . "  • Khách hàng: $lName ($lPhone)\n"
                        . "  • Lỗi bạn báo: $reason\n"
                        . "  • Luật áp dụng: $matchedRuleName\n"
                        . "  • Từ khóa tự động: $matchedKeyword\n\n"
                        . "Hệ thống đã ghi nhận 1 lượt đền bù. Bạn sẽ nhận được Data mới vào lần phân bổ tiếp theo.";
                    sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
                }

                // Send Email to Sale
                if (!empty($consultant['email'])) {
                    require_once __DIR__ . '/mailer.php';
                    $emailSubj = "[Domation DATA] Ticket Lỗi Data Đã Được Tự Động Duyệt - $lName";
                    $emailBody = "<h3>Báo cáo lỗi Data được tự động phê duyệt</h3>
                                  <p>Chào $cName,</p>
                                  <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã được hệ thống tự động phê duyệt.</p>
                                  <p><strong>Luật áp dụng:</strong> $matchedRuleName</p>
                                  <p><strong>Từ khóa kích hoạt:</strong> $matchedKeyword</p>
                                  <p>Hệ thống đã tự động cộng 1 lượt đền bù cho bạn trong vòng phân bổ hiện tại.</p>";
                    sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, '');
                }

                // Notify Admins
                $adminEmails = getTicketNotifyAdmins($conn);

                if (!empty($adminEmails)) {
                    // Zalo to admins
                    if (!empty($botToken)) {
                        $adminChatIds = [];
                        foreach ($adminEmails as $adm) {
                            if (!empty($adm['zalo_chat_id'])) {
                                $adminChatIds[] = $adm['zalo_chat_id'];
                            }
                        }
                        if (!empty($adminChatIds)) {
                            $zaloAdminMsg = "[ TICKET TỰ ĐỘNG DUYỆT ]\n\n"
                                . "Hệ thống đã tự động duyệt báo cáo lỗi Data từ Sale:\n\n"
                                . "❖ THÔNG TIN BÁO CÁO:\n"
                                . "  • Sale báo cáo: $cName\n"
                                . "  • Khách hàng: $lName ($lPhone)\n\n"
                                . "❖ CHI TIẾT TỰ ĐỘNG DUYỆT:\n"
                                . "  • Lý do: $reason\n"
                                . "  • Từ khóa kích hoạt: $matchedKeyword\n\n"
                                . "Lượt đền bù đã được tự động cộng cho Sale.";
                            sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg);
                        }
                    }

                    // Email to admins
                    require_once __DIR__ . '/mailer.php';
                    $toAdmin = array_shift($adminEmails);
                    $ccList = array_map(fn($a) => $a['email'], $adminEmails);
                    $ccString = implode(',', array_filter($ccList));

                    $emailSubjAdmin = "[Domation DATA] Thông báo Ticket Tự động duyệt - Sale: $cName";
                    $emailBodyAdmin = "<h3>Thông báo Ticket Tự động duyệt</h3>
                                      <p>Hệ thống đã tự động duyệt báo cáo lỗi của Sale <strong>$cName</strong> đối với khách hàng <strong>$lName ($lPhone)</strong>.</p>
                                      <p><strong>Lý do lỗi:</strong> $reason</p>
                                      <p><strong>Từ khóa kích hoạt:</strong> $matchedKeyword</p>
                                      <p>Lượt đền bù đã được tự động cộng cho Sale thành công.</p>";
                    sendEmailNotification($toAdmin['email'], $emailSubjAdmin, 'Thông báo Hệ thống', $emailBodyAdmin, $ccString);
                }

                echo json_encode(['success' => true, 'auto_approved' => true]);
                break;
            } catch (Exception $e) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => 'Lỗi xử lý tự động duyệt: ' . $e->getMessage()]);
                break;
            }
        }

        $stmt = $conn->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiis", $lead_id, $sale_id, $round_id, $reason);
        $success = $stmt->execute();
        $ticketId = $conn->insert_id;
        $stmt->close();

        if ($success) {
            // FEATURE: Gửi email thông báo tới admin được thiết lập nhận ticket (dùng chung cấu hình báo cáo ngày)
            require_once __DIR__ . '/mailer.php';
            
            $adminEmails = getTicketNotifyAdmins($conn);

            if (!empty($adminEmails)) {
                // Lấy thông tin consultant và lead để gửi email
                $ctxForEmail = $conn->prepare("
                    SELECT l.name as lead_name, l.phone as lead_phone, l.email as lead_email, l.source as lead_source, l.type as lead_type, l.note as lead_note, c.name as consultant_name, c.zalo_chat_id, dr.round_name
                    FROM distribution_logs dl
                    LEFT JOIN leads l ON dl.lead_id = l.id
                    LEFT JOIN consultants c ON dl.assigned_to = c.id
                    LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
                    WHERE dl.lead_id = ? AND dl.assigned_to = ? AND dl.round_id = ?
                    LIMIT 1
                ");
                $ctxForEmail->bind_param("iii", $lead_id, $sale_id, $round_id);
                $ctxForEmail->execute();
                $ctxData = $ctxForEmail->get_result()->fetch_assoc();
                $ctxForEmail->close();

                $toAdmin = array_shift($adminEmails); // Admin đầu tiên là recipient chính
                $ccList = array_map(fn($a) => $a['email'], $adminEmails); // Còn lại là CC
                $ccString = implode(',', array_filter($ccList));

                // 1. Gửi Email
                sendTicketNotificationToAdmins(
                    $toAdmin['email'],
                    $toAdmin['name'],
                    $ctxData['lead_name'] ?? 'Khách hàng',
                    $ctxData['lead_phone'] ?? '',
                    $reason,
                    $ctxData['consultant_name'] ?? '',
                    $ctxData['round_name'] ?? '',
                    $ccString,
                    $ctxData['lead_email'] ?? '',
                    $ctxData['lead_source'] ?? '',
                    $ctxData['lead_type'] ?? '',
                    $ctxData['lead_note'] ?? ''
                );

                // 2. Gửi Zalo Message cho toàn bộ admin có zalo_chat_id
                require_once __DIR__ . '/zalo_bot.php';
                $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
                if (!empty($botToken)) {
                    $allAdmins = array_merge([$toAdmin], $adminEmails);
                    $leadName = $ctxData['lead_name'] ?? 'Khách hàng';
                    $leadPhone = $ctxData['lead_phone'] ?? 'Không rõ';
                    $leadEmail = $ctxData['lead_email'] ?? 'Không rõ';
                    $leadSource = $ctxData['lead_source'] ?? 'Không rõ';
                    $leadType = $ctxData['lead_type'] ?? 'Không rõ';
                    $leadNote = $ctxData['lead_note'] ?? 'Không rõ';
                    $consultName = $ctxData['consultant_name'] ?? 'Không rõ';

                    $zaloMsg = "[ YÊU CẦU DUYỆT TICKET ]\n\n"
                        . "Một nhân viên vừa gửi báo cáo lỗi Data:\n\n"
                        . "❖ THÔNG TIN BÁO CÁO:\n"
                        . "  • Sale báo cáo: $consultName\n"
                        . "  • Khách hàng: $leadName\n"
                        . "  • Số điện thoại: $leadPhone\n"
                        . "  • Email: $leadEmail\n"
                        . "  • Nguồn Data: $leadSource\n"
                        . "  • Loại Data: $leadType\n"
                        . "  • Ghi chú: $leadNote\n\n"
                        . "❖ LÝ DO LỖI:\n"
                        . "  $reason\n\n"
                        . "👉 Để DUYỆT nhanh, soạn:\n"
                        . "   /accept $ticketId [lý do duyệt]\n"
                        . "👉 Để TỪ CHỐI nhanh, soạn:\n"
                        . "   /reject $ticketId <lý do từ chối>";

                    $adminChatIds = [];
                    foreach ($allAdmins as $adm) {
                        if (!empty($adm['zalo_chat_id'])) {
                            $adminChatIds[] = $adm['zalo_chat_id'];
                        }
                    }
                    if (!empty($adminChatIds)) {
                        sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloMsg);
                    }
                }
            }
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Lỗi lưu báo cáo']);
        }
        break;


    case 'get_reports':
        // Retrieve query parameters
        $round_id = isset($_GET['round_id']) ? (int)$_GET['round_id'] : 0;
        $status = isset($_GET['status']) ? trim($_GET['status']) : 'all';
        $consultant = isset($_GET['consultant']) ? trim($_GET['consultant']) : '';
        $dateFrom = isset($_GET['dateFrom']) ? trim($_GET['dateFrom']) : '';
        $dateTo = isset($_GET['dateTo']) ? trim($_GET['dateTo']) : '';
        
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 50;
        if ($page < 1) $page = 1;
        if ($pageSize < 1) $pageSize = 50;
        $offset = ($page - 1) * $pageSize;

        // Build base condition and types/params for prepared statement
        $conds = [];
        $params = [];
        $types = "";

        if ($round_id > 0) {
            $conds[] = "r.round_id = ?";
            $params[] = $round_id;
            $types .= "i";
        }
        if ($consultant !== '' && $consultant !== 'all') {
            $conds[] = "c.name = ?";
            $params[] = $consultant;
            $types .= "s";
        }
        if ($dateFrom !== '') {
            $conds[] = "r.created_at >= ?";
            $params[] = $dateFrom . " 00:00:00";
            $types .= "s";
        }
        if ($dateTo !== '') {
            $conds[] = "r.created_at <= ?";
            $params[] = $dateTo . " 23:59:59";
            $types .= "s";
        }

        // Stats Condition
        $statsConds = $conds;
        $statsParams = $params;
        $statsTypes = $types;

        // Records Condition (includes status)
        $recordsConds = $conds;
        $recordsParams = $params;
        $recordsTypes = $types;
        if ($status !== 'all' && in_array($status, ['pending', 'approved', 'rejected'])) {
            $recordsConds[] = "r.status = ?";
            $recordsParams[] = $status;
            $recordsTypes .= "s";
        }

        $statsWhere = count($statsConds) > 0 ? "WHERE " . implode(" AND ", $statsConds) : "";
        $recordsWhere = count($recordsConds) > 0 ? "WHERE " . implode(" AND ", $recordsConds) : "";

        // Query 1: Get Stats per status (for badges)
        $statsSql = "
            SELECT r.status, COUNT(*) as cnt 
            FROM data_reports r
            JOIN leads l ON r.lead_id = l.id
            JOIN consultants c ON r.consultant_id = c.id
            JOIN distribution_rounds dr ON r.round_id = dr.id
            $statsWhere
            GROUP BY r.status
        ";
        $stmtStats = $conn->prepare($statsSql);
        if (count($statsParams) > 0) {
            $stmtStats->bind_param($statsTypes, ...$statsParams);
        }
        $stmtStats->execute();
        $resStats = $stmtStats->get_result();
        
        $stats = [
            'pending' => 0,
            'approved' => 0,
            'rejected' => 0,
            'all' => 0
        ];
        while ($row = $resStats->fetch_assoc()) {
            $st = $row['status'];
            $cnt = (int)$row['cnt'];
            if (isset($stats[$st])) {
                $stats[$st] = $cnt;
            }
            $stats['all'] += $cnt;
        }

        // Query 2: Get total records count for pagination
        $countSql = "
            SELECT COUNT(*) as cnt
            FROM data_reports r
            JOIN leads l ON r.lead_id = l.id
            JOIN consultants c ON r.consultant_id = c.id
            JOIN distribution_rounds dr ON r.round_id = dr.id
            $recordsWhere
        ";
        $stmtCount = $conn->prepare($countSql);
        if (count($recordsParams) > 0) {
            $stmtCount->bind_param($recordsTypes, ...$recordsParams);
        }
        $stmtCount->execute();
        $totalCount = (int)($stmtCount->get_result()->fetch_assoc()['cnt'] ?? 0);

        // Query 3: Get paginated records
        $recordsSql = "
            SELECT r.*, l.name as lead_name, l.phone as lead_phone, 
                   c.name as consultant_name, c.zalo_chat_id, dr.round_name
            FROM data_reports r
            JOIN leads l ON r.lead_id = l.id
            JOIN consultants c ON r.consultant_id = c.id
            JOIN distribution_rounds dr ON r.round_id = dr.id
            $recordsWhere
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ";
        $stmtRecords = $conn->prepare($recordsSql);
        
        // Append limit and offset to parameters
        $recordsParams[] = $pageSize;
        $recordsParams[] = $offset;
        $recordsTypes .= "ii";
        
        $stmtRecords->bind_param($recordsTypes, ...$recordsParams);
        $stmtRecords->execute();
        $resRecords = $stmtRecords->get_result();

        $data = [];
        if ($resRecords) {
            while ($row = $resRecords->fetch_assoc()) {
                $data[] = $row;
            }
        }

        // Query 4: Get unique consultants who have reports
        $consultantsRes = $conn->query("
            SELECT DISTINCT c.name 
            FROM data_reports r 
            JOIN consultants c ON r.consultant_id = c.id 
            ORDER BY c.name ASC
        ");
        $consultants = [];
        if ($consultantsRes) {
            while ($row = $consultantsRes->fetch_assoc()) {
                $consultants[] = $row['name'];
            }
        }

        echo json_encode([
            'success' => true,
            'data' => $data,
            'stats' => $stats,
            'consultants' => $consultants,
            'total_count' => $totalCount,
            'page' => $page,
            'pageSize' => $pageSize
        ]);
        break;

    case 'approve_report':
        $input = json_decode(file_get_contents('php://input'), true);
        $report_id = (int) ($input['id'] ?? 0);
        $approval_reason = trim($input['approval_reason'] ?? '');
        $new_consultant_id = isset($input['new_consultant_id']) ? (int) $input['new_consultant_id'] : 0;
        if (!$report_id) {
            echo json_encode(['success' => false, 'message' => 'ID báo cáo không hợp lệ']);
            break;
        }

        $conn->begin_transaction();
        try {
            // 1. Get report info (with consultant_name)
            $stmt = $conn->prepare("
                SELECT r.lead_id, r.consultant_id, r.round_id, r.reason, r.status, dr.cc_emails, c.name as consultant_name
                FROM data_reports r
                LEFT JOIN distribution_rounds dr ON r.round_id = dr.id
                LEFT JOIN consultants c ON r.consultant_id = c.id
                WHERE r.id = ? FOR UPDATE
            ");
            $stmt->bind_param("i", $report_id);
            $stmt->execute();
            $report = $stmt->get_result()->fetch_assoc();

            if (!$report || $report['status'] !== 'pending') {
                throw new Exception("Báo cáo không tồn tại hoặc đã được xử lý.");
            }

            $newConsultantName = '';
            if ($new_consultant_id > 0) {
                // Fetch new consultant details and make sure they exist and are active
                $newConsultStmt = $conn->prepare("SELECT name, status FROM consultants WHERE id = ? LIMIT 1");
                $newConsultStmt->bind_param("i", $new_consultant_id);
                $newConsultStmt->execute();
                $newCInfo = $newConsultStmt->get_result()->fetch_assoc();
                $newConsultStmt->close();

                if (!$newCInfo) {
                    throw new Exception("Tư vấn viên mới nhận nhắc lại không tồn tại.");
                }
                if ($newCInfo['status'] !== 'active') {
                    throw new Exception("Tư vấn viên mới nhận nhắc lại đang không hoạt động.");
                }
                $newConsultantName = $newCInfo['name'];
            }

            // 2. Mark report as approved
            $updRep = $conn->prepare("UPDATE data_reports SET status='approved', approval_reason=?, resolved_at=NOW() WHERE id=?");
            $updRep->bind_param("si", $approval_reason, $report_id);
            $updRep->execute();

            // 3. Mark lead as faulty (Append to note and optionally assign to new consultant)
            $faultyMsg = "[LỖI - ĐÃ DUYỆT]: " . $report['reason'];
            if (!empty($approval_reason)) {
                $faultyMsg .= " | Lý do duyệt: " . $approval_reason;
            }
            if ($new_consultant_id > 0) {
                $faultyMsg .= " | Nhắc lại cho TVV: " . $newConsultantName;
                $updLead = $conn->prepare("UPDATE leads SET assigned_to = ?, note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
                $updLead->bind_param("isi", $new_consultant_id, $faultyMsg, $report['lead_id']);
            } else {
                $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
                $updLead->bind_param("si", $faultyMsg, $report['lead_id']);
            }
            $updLead->execute();

            // Mark distribution_logs as error
            $updLog = $conn->prepare("UPDATE distribution_logs SET status='error' WHERE lead_id=? AND assigned_to=? AND round_id=?");
            $updLog->bind_param("iii", $report['lead_id'], $report['consultant_id'], $report['round_id']);
            $updLog->execute();

            // 4. Increment compensation_count for the consultant in that round
            $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id=? AND consultant_id=?");
            $updComp->bind_param("ii", $report['round_id'], $report['consultant_id']);
            $updComp->execute();

            // 5. Create reminder distribution log if new consultant selected
            if ($new_consultant_id > 0) {
                $reminderMsg = "Nhắc lại do duyệt trùng từ báo cáo của " . ($report['consultant_name'] ?? 'Tư vấn viên cũ') . ".";
                if (!empty($approval_reason)) {
                    $reminderMsg .= " Lý do duyệt: " . $approval_reason;
                }
                $stmtRemLog = $conn->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, 'reminder', ?)");
                $stmtRemLog->bind_param("iiis", $report['lead_id'], $new_consultant_id, $report['round_id'], $reminderMsg);
                $stmtRemLog->execute();
                $stmtRemLog->close();
            }

            logAdminAction($conn, $decodedUser['id'], 'APPROVE_REPORT', [
                'report_id' => $report_id, 
                'lead_id' => $report['lead_id'], 
                'consultant_id' => $report['consultant_id'], 
                'round_id' => $report['round_id'],
                'approval_reason' => $approval_reason,
                'new_consultant_id' => $new_consultant_id
            ]);
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // Đã commit DB thành công. Bắt đầu xử lý thông báo ngoài giao dịch DB
        try {
            // Lấy thông tin admin thực hiện
            $adminName = 'Quản trị viên';
            $adminAccountId = 0;
            if (isset($decodedUser['id'])) {
                $adminAccountId = (int) $decodedUser['id'];
                $admQuery = $conn->prepare("SELECT name FROM accounts WHERE id = ? LIMIT 1");
                $admQuery->bind_param("i", $decodedUser['id']);
                $admQuery->execute();
                $admRes = $admQuery->get_result()->fetch_assoc();
                if ($admRes && !empty($admRes['name'])) {
                    $adminName = $admRes['name'];
                }
                $admQuery->close();
            }

            // Lấy thông tin Sale & Lead để gửi thông báo
            $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $consultStmt->bind_param("i", $report['consultant_id']);
            $consultStmt->execute();
            $consultant = $consultStmt->get_result()->fetch_assoc();

            $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
            $leadStmt->bind_param("i", $report['lead_id']);
            $leadStmt->execute();
            $lead = $leadStmt->get_result()->fetch_assoc();

            $cName = $consultant['name'] ?? 'Tư vấn viên';
            $lName = $lead['name'] ?? 'Khách hàng';
            $lPhone = $lead['phone'] ?? 'Không rõ';

            // Lấy danh sách Ticket Admins nhận thông báo
            $adminEmails = getTicketNotifyAdmins($conn);

            // Thông báo qua Zalo Bot
            require_once __DIR__ . '/zalo_bot.php';
            $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
            $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

            // Zalo cho Sale
            if (!empty($botToken) && !empty($consultant['zalo_chat_id'])) {
                try {
                    $zaloMsg = "[ TICKET ĐÃ ĐƯỢC DUYỆT ]\n\n"
                        . "Chào $cName, báo cáo lỗi Data của bạn đã ĐƯỢC PHÊ DUYỆT bởi $adminName.\n\n"
                        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                        . "  • Khách hàng: $lName ($lPhone)\n"
                        . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                        . "❖ LÝ DO DUYỆT:\n"
                        . "  " . (!empty($approval_reason) ? $approval_reason : "Không có lý do cụ thể") . "\n\n"
                        . "Hệ thống đã ghi nhận 1 lượt đền bù. Bạn sẽ nhận được Data mới vào lần phân bổ tiếp theo.";
                    sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
                } catch (Exception $zEx1) {
                    error_log("Error sending Zalo message to consultant in approve_report: " . $zEx1->getMessage());
                }
            }

            // Zalo cho các Ticket Admins (trừ admin thực hiện nếu có zalo_chat_id)
            if (!empty($botToken) && !empty($adminEmails)) {
                $adminChatIds = [];
                foreach ($adminEmails as $adm) {
                    if (!empty($adm['zalo_chat_id']) && (int)$adm['id'] !== $adminAccountId) {
                        $adminChatIds[] = $adm['zalo_chat_id'];
                    }
                }
                if (!empty($adminChatIds)) {
                    try {
                        $zaloAdminMsg = "[ THÔNG BÁO TICKET ĐÃ DUYỆT ]\n\n"
                            . "Admin $adminName đã duyệt ticket của Sale $cName.\n\n"
                            . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                            . "  • Khách hàng: $lName ($lPhone)\n"
                            . "  • Lỗi báo cáo: {$report['reason']}\n\n"
                            . "❖ LÝ DO DUYỆT:\n"
                            . "  " . (!empty($approval_reason) ? $approval_reason : "Không có lý do cụ thể");
                        sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg);
                    } catch (Exception $zEx2) {
                        error_log("Error sending Zalo message to multiple admins in approve_report: " . $zEx2->getMessage());
                    }
                }
            }

            // Thông báo qua Email cho Sale (kèm CC)
            if (!empty($consultant['email'])) {
                try {
                    require_once __DIR__ . '/mailer.php';

                    // Gom danh sách CC (Round CC + Ticket Admins, lọc trùng và loại bỏ email của Sale nhận số)
                    $ccEmailsArr = [];
                    if (!empty($report['cc_emails'])) {
                        $parts = explode(',', $report['cc_emails']);
                        foreach ($parts as $p) {
                            $p = trim($p);
                            if (!empty($p) && filter_var($p, FILTER_VALIDATE_EMAIL)) {
                                $ccEmailsArr[] = strtolower($p);
                            }
                        }
                    }
                    foreach ($adminEmails as $adm) {
                        if (!empty($adm['email'])) {
                            $email = trim($adm['email']);
                            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                                $ccEmailsArr[] = strtolower($email);
                            }
                        }
                    }
                    $ccEmailsArr = array_unique($ccEmailsArr);
                    $saleEmail = strtolower(trim($consultant['email']));
                    $ccEmailsArr = array_filter($ccEmailsArr, fn($e) => $e !== $saleEmail);
                    $ccString = implode(',', $ccEmailsArr);

                    $emailSubj = "[Domation DATA] Ticket Lỗi Data Đã Được Duyệt - $lName";
                    $emailBody = "<h3>Báo cáo lỗi Data được phê duyệt</h3>
                                  <p>Chào $cName,</p>
                                  <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã được Quản trị viên <strong>$adminName</strong> duyệt thành công.</p>
                                  <p><strong>Lý do duyệt:</strong> " . (!empty($approval_reason) ? htmlspecialchars($approval_reason) : "Không có lý do cụ thể") . "</p>
                                  <p>Hệ thống đã tự động cộng 1 lượt đền bù cho bạn trong vòng phân bổ hiện tại.</p>";
                    sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, $ccString);
                } catch (Exception $emailEx) {
                    error_log("Error sending email in approve_report: " . $emailEx->getMessage());
                }
            }

            // --- ADD REASSIGN REMINDER NOTIFICATION ---
            if ($new_consultant_id > 0) {
                try {
                    // Fetch new consultant details again for notification
                    $newConsultStmt2 = $conn->prepare("SELECT name, email, zalo_chat_id, status FROM consultants WHERE id = ? LIMIT 1");
                    $newConsultStmt2->bind_param("i", $new_consultant_id);
                    $newConsultStmt2->execute();
                    $newC = $newConsultStmt2->get_result()->fetch_assoc();
                    $newConsultStmt2->close();

                    if ($newC && $newC['status'] === 'active') {
                        // Fetch complete lead details
                        $leadDetailsStmt = $conn->prepare("SELECT name, phone, email, source, type, note FROM leads WHERE id = ? LIMIT 1");
                        $leadDetailsStmt->bind_param("i", $report['lead_id']);
                        $leadDetailsStmt->execute();
                        $lDetails = $leadDetailsStmt->get_result()->fetch_assoc();
                        $leadDetailsStmt->close();

                        // Fetch round name
                        $roundName = '';
                        if ($report['round_id'] > 0) {
                            $roundStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ? LIMIT 1");
                            $roundStmt->bind_param("i", $report['round_id']);
                            $roundStmt->execute();
                            $roundName = $roundStmt->get_result()->fetch_assoc()['round_name'] ?? '';
                            $roundStmt->close();
                        }

                        if ($lDetails) {
                            require_once __DIR__ . '/mailer.php';
                            require_once __DIR__ . '/zalo_bot.php';
                            require_once __DIR__ . '/webhook_logic.php';

                            $timeline = getLeadHistoryTimeline($conn, $report['lead_id']);

                            // Send Zalo reminder
                            try {
                                sendLeadReminderZaloMessageToSale(
                                    $new_consultant_id,
                                    $newC['name'],
                                    $lDetails['name'],
                                    $lDetails['phone'],
                                    $lDetails['note'],
                                    $lDetails['source'],
                                    $roundName,
                                    $timeline,
                                    $report['lead_id'],
                                    $lDetails['email'],
                                    $lDetails['type']
                                );
                            } catch (Exception $zaloEx) {
                                error_log("Error sending reassigned duplicate reminder Zalo: " . $zaloEx->getMessage());
                            }

                            // Send Email reminder (kèm CC)
                            try {
                                sendLeadReminderEmailToSale(
                                    $newC['email'],
                                    $newC['name'],
                                    $lDetails['name'],
                                    $lDetails['phone'],
                                    $lDetails['note'],
                                    $lDetails['source'],
                                    $report['cc_emails'] ?? '',
                                    $roundName,
                                    $timeline,
                                    $report['lead_id']
                                );
                            } catch (Exception $mailEx) {
                                error_log("Error sending reassigned duplicate reminder email: " . $mailEx->getMessage());
                            }
                        }
                    }
                } catch (Exception $newCEx) {
                    error_log("Error sending reassigned notifications: " . $newCEx->getMessage());
                }
            }

        } catch (Exception $notifyOuterEx) {
            error_log("Outer notification error in approve_report: " . $notifyOuterEx->getMessage());
        }

        echo json_encode(['success' => true]);
        break;

    case 'reject_report':
        $input = json_decode(file_get_contents('php://input'), true);
        $report_id = (int) ($input['id'] ?? 0);
        $reject_reason = trim($input['reject_reason'] ?? '');

        if (!$report_id) {
            echo json_encode(['success' => false, 'message' => 'ID báo cáo không hợp lệ']);
            break;
        }

        if (empty($reject_reason)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập lý do từ chối']);
            break;
        }

        $conn->begin_transaction();
        try {
            // Check status first — prevent rejecting already-processed reports
            $chkStmt = $conn->prepare("
                SELECT r.lead_id, r.consultant_id, r.round_id, r.reason, r.status, dr.cc_emails
                FROM data_reports r
                LEFT JOIN distribution_rounds dr ON r.round_id = dr.id
                WHERE r.id = ? FOR UPDATE
            ");
            $chkStmt->bind_param("i", $report_id);
            $chkStmt->execute();
            $report = $chkStmt->get_result()->fetch_assoc();

            if (!$report || $report['status'] !== 'pending') {
                throw new Exception("Báo cáo không tồn tại hoặc đã được xử lý rồi.");
            }

            $stmt = $conn->prepare("UPDATE data_reports SET status='rejected', reject_reason=?, resolved_at=NOW() WHERE id=?");
            $stmt->bind_param("si", $reject_reason, $report_id);
            $stmt->execute();

            logAdminAction($conn, $decodedUser['id'], 'REJECT_REPORT', [
                'report_id' => $report_id, 
                'lead_id' => $report['lead_id'], 
                'consultant_id' => $report['consultant_id'], 
                'round_id' => $report['round_id'], 
                'reject_reason' => $reject_reason
            ]);
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // Đã commit DB thành công. Bắt đầu xử lý thông báo ngoài giao dịch DB
        try {
            // Lấy thông tin admin thực hiện
            $adminName = 'Quản trị viên';
            $adminAccountId = 0;
            if (isset($decodedUser['id'])) {
                $adminAccountId = (int) $decodedUser['id'];
                $admQuery = $conn->prepare("SELECT name FROM accounts WHERE id = ? LIMIT 1");
                $admQuery->bind_param("i", $decodedUser['id']);
                $admQuery->execute();
                $admRes = $admQuery->get_result()->fetch_assoc();
                if ($admRes && !empty($admRes['name'])) {
                    $adminName = $admRes['name'];
                }
                $admQuery->close();
            }

            // Lấy thông tin Sale & Lead để gửi thông báo
            $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $consultStmt->bind_param("i", $report['consultant_id']);
            $consultStmt->execute();
            $consultant = $consultStmt->get_result()->fetch_assoc();

            $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
            $leadStmt->bind_param("i", $report['lead_id']);
            $leadStmt->execute();
            $lead = $leadStmt->get_result()->fetch_assoc();

            $cName = $consultant['name'] ?? 'Tư vấn viên';
            $lName = $lead['name'] ?? 'Khách hàng';
            $lPhone = $lead['phone'] ?? 'Không rõ';

            // Lấy danh sách Ticket Admins nhận thông báo
            $adminEmails = getTicketNotifyAdmins($conn);

            // Thông báo qua Zalo Bot
            require_once __DIR__ . '/zalo_bot.php';
            $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
            $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

            // Zalo cho Sale
            if (!empty($botToken) && !empty($consultant['zalo_chat_id'])) {
                try {
                    $zaloMsg = "[ TICKET BỊ TỪ CHỐI ]\n\n"
                        . "Chào $cName, báo cáo lỗi Data của bạn đã BỊ TỪ CHỐI bởi $adminName.\n\n"
                        . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                        . "  • Khách hàng: $lName ($lPhone)\n"
                        . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                        . "❖ LÝ DO TỪ CHỐI:\n"
                        . "  $reject_reason\n\n"
                        . "Bạn sẽ không được đền bù Data cho trường hợp này.";
                    sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
                } catch (Exception $zEx1) {
                    error_log("Error sending Zalo to sale in reject_report: " . $zEx1->getMessage());
                }
            }

            // Zalo cho các Ticket Admins (trừ admin thực hiện)
            if (!empty($botToken) && !empty($adminEmails)) {
                $adminChatIds = [];
                foreach ($adminEmails as $adm) {
                    if (!empty($adm['zalo_chat_id']) && (int)$adm['id'] !== $adminAccountId) {
                        $adminChatIds[] = $adm['zalo_chat_id'];
                    }
                }
                if (!empty($adminChatIds)) {
                    try {
                        $zaloAdminMsg = "[ THÔNG BÁO TICKET BỊ TỪ CHỐI ]\n\n"
                            . "Admin $adminName đã từ chối ticket của Sale $cName.\n\n"
                            . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                            . "  • Khách hàng: $lName ($lPhone)\n"
                            . "  • Lỗi báo cáo: {$report['reason']}\n\n"
                            . "❖ LÝ DO TỪ CHỐI:\n"
                            . "  $reject_reason";
                        sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg);
                    } catch (Exception $zEx2) {
                        error_log("Error sending Zalo to multiple admins in reject_report: " . $zEx2->getMessage());
                    }
                }
            }

            // Thông báo qua Email (gửi cho Sale kèm CC)
            if (!empty($consultant['email'])) {
                try {
                    require_once __DIR__ . '/mailer.php';

                    // Gom danh sách CC (Round CC + Ticket Admins, lọc trùng và loại bỏ email của Sale nhận số)
                    $ccEmailsArr = [];
                    if (!empty($report['cc_emails'])) {
                        $parts = explode(',', $report['cc_emails']);
                        foreach ($parts as $p) {
                            $p = trim($p);
                            if (!empty($p) && filter_var($p, FILTER_VALIDATE_EMAIL)) {
                                $ccEmailsArr[] = strtolower($p);
                            }
                        }
                    }
                    foreach ($adminEmails as $adm) {
                        if (!empty($adm['email'])) {
                            $email = trim($adm['email']);
                            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                                $ccEmailsArr[] = strtolower($email);
                            }
                        }
                    }
                    $ccEmailsArr = array_unique($ccEmailsArr);
                    $saleEmail = strtolower(trim($consultant['email']));
                    $ccEmailsArr = array_filter($ccEmailsArr, fn($e) => $e !== $saleEmail);
                    $ccString = implode(',', $ccEmailsArr);

                    $emailSubj = "[Domation DATA] Ticket Lỗi Data Bị Từ Chối - $lName";
                    $emailBody = "<h3>Báo cáo lỗi Data bị từ chối</h3>
                                  <p>Chào $cName,</p>
                                  <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã bị Quản trị viên <strong>$adminName</strong> từ chối.</p>
                                  <p><strong>Lý do từ chối:</strong> " . htmlspecialchars($reject_reason) . "</p>
                                  <p>Bạn sẽ không được nhận Data đền bù cho trường hợp này.</p>";
                    sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, $ccString);
                } catch (Exception $emailEx) {
                    error_log("Error sending email in reject_report: " . $emailEx->getMessage());
                }
            }
        } catch (Exception $notifyOuterEx) {
            error_log("Outer notification error in reject_report: " . $notifyOuterEx->getMessage());
        }

        echo json_encode(['success' => true]);
        break;

    case 'get_mappings':
        $res = $conn->query("SELECT * FROM field_mappings ORDER BY created_at DESC");
        $data = [];
        while ($row = $res->fetch_assoc())
            $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_mapping':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $conn_id = (int)($input['connection_id'] ?? 0);
            $sheet_col = trim($input['sheet_column'] ?? '');
            $sys_field = trim($input['system_field'] ?? '');
            $custom_label = isset($input['custom_label']) ? trim($input['custom_label']) : null;
            if (empty($custom_label)) {
                $custom_label = null;
            }

            if ($conn_id <= 0 || empty($sheet_col) || empty($sys_field)) {
                throw new Exception("Dữ liệu đầu vào không hợp lệ.");
            }

            // Check connection exists
            $connCheck = $conn->prepare("SELECT id FROM sheet_connections WHERE id = ?");
            $connCheck->bind_param("i", $conn_id);
            $connCheck->execute();
            if (!$connCheck->get_result()->fetch_assoc()) {
                $connCheck->close();
                throw new Exception("Kết nối không tồn tại.");
            }
            $connCheck->close();

            // Validate unique system fields
            $uniqueFields = ['phone', 'email', 'name', 'assigned_to', 'saleperson'];
            if (in_array($sys_field, $uniqueFields)) {
                $checkStmt = $conn->prepare("SELECT id FROM field_mappings WHERE connection_id = ? AND system_field = ?");
                $checkStmt->bind_param("is", $conn_id, $sys_field);
                $checkStmt->execute();
                if ($checkStmt->get_result()->fetch_assoc()) {
                    $checkStmt->close();
                    throw new Exception("Trường hệ thống này đã được liên kết với một cột khác.");
                }
                $checkStmt->close();
            }

            // Validate exact duplicate mapping
            $dupStmt = $conn->prepare("SELECT id FROM field_mappings WHERE connection_id = ? AND LOWER(sheet_column) = LOWER(?) AND system_field = ?");
            $dupStmt->bind_param("iss", $conn_id, $sheet_col, $sys_field);
            $dupStmt->execute();
            if ($dupStmt->get_result()->fetch_assoc()) {
                $dupStmt->close();
                throw new Exception("Cột này đã được liên kết với trường hệ thống này.");
            }
            $dupStmt->close();

            $stmt = $conn->prepare("INSERT INTO field_mappings (connection_id, sheet_column, system_field, custom_label) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("isss", $conn_id, $sheet_col, $sys_field, $custom_label);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'ADD_MAPPING', ['connection_id' => $conn_id, 'sheet_column' => $sheet_col, 'system_field' => $sys_field]);
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'edit_mapping':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($input['id'] ?? 0);
            $sheet_col = trim($input['sheet_column'] ?? '');
            $sys_field = trim($input['system_field'] ?? '');
            $custom_label = isset($input['custom_label']) ? trim($input['custom_label']) : null;
            if (empty($custom_label)) {
                $custom_label = null;
            }

            if ($id <= 0 || empty($sheet_col) || empty($sys_field)) {
                throw new Exception("Dữ liệu đầu vào không hợp lệ.");
            }

            // Get connection_id and check if mapping exists
            $mappingCheck = $conn->prepare("SELECT connection_id FROM field_mappings WHERE id = ?");
            $mappingCheck->bind_param("i", $id);
            $mappingCheck->execute();
            $mappingRow = $mappingCheck->get_result()->fetch_assoc();
            if (!$mappingRow) {
                $mappingCheck->close();
                throw new Exception("Mapping không tồn tại.");
            }
            $conn_id = (int)$mappingRow['connection_id'];
            $mappingCheck->close();

            // Validate unique system fields
            $uniqueFields = ['phone', 'email', 'name', 'assigned_to', 'saleperson'];
            if (in_array($sys_field, $uniqueFields)) {
                $checkStmt = $conn->prepare("SELECT id FROM field_mappings WHERE connection_id = ? AND system_field = ? AND id != ?");
                $checkStmt->bind_param("isi", $conn_id, $sys_field, $id);
                $checkStmt->execute();
                if ($checkStmt->get_result()->fetch_assoc()) {
                    $checkStmt->close();
                    throw new Exception("Trường hệ thống này đã được liên kết với một cột khác.");
                }
                $checkStmt->close();
            }

            // Validate exact duplicate mapping
            $dupStmt = $conn->prepare("SELECT id FROM field_mappings WHERE connection_id = ? AND LOWER(sheet_column) = LOWER(?) AND system_field = ? AND id != ?");
            $dupStmt->bind_param("issi", $conn_id, $sheet_col, $sys_field, $id);
            $dupStmt->execute();
            if ($dupStmt->get_result()->fetch_assoc()) {
                $dupStmt->close();
                throw new Exception("Cột này đã được liên kết với trường hệ thống này.");
            }
            $dupStmt->close();

            $stmt = $conn->prepare("UPDATE field_mappings SET sheet_column=?, system_field=?, custom_label=? WHERE id=?");
            $stmt->bind_param("sssi", $sheet_col, $sys_field, $custom_label, $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'EDIT_MAPPING', ['id' => $id, 'sheet_column' => $sheet_col, 'system_field' => $sys_field]);
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'delete_mapping':
        try {
            $id = (int) ($_GET['id'] ?? 0);
            $stmt = $conn->prepare("DELETE FROM field_mappings WHERE id=?");
            $stmt->bind_param("i", $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'DELETE_MAPPING', ['id' => $id]);
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'get_settings':
        $res = $conn->query("SELECT * FROM system_settings");
        $data = [];
        while ($row = $res->fetch_assoc()) {
            $data[$row['setting_key']] = $row['setting_value'];
        }
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'save_settings':
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            echo json_encode(['success' => false, 'message' => 'Invalid data']);
            break;
        }
        $stmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES (?, ?)");
        foreach ($input as $k => $v) {
            // Array values (e.g. daily_report_admins) must be JSON-encoded before storage
            if (is_array($v)) {
                $v = json_encode($v, JSON_UNESCAPED_UNICODE);
            }
            $stmt->bind_param("ss", $k, $v);
            $stmt->execute();
        }
        logAdminAction($conn, $decodedUser['id'], 'SAVE_SETTINGS', ['keys' => array_keys($input)]);
        echo json_encode(['success' => true]);
        break;

    case 'test_email':
        $input = json_decode(file_get_contents('php://input'), true);
        $email = trim($input['email'] ?? '');
        $type = $input['type'] ?? 'system';

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'Email không hợp lệ']);
            break;
        }

        require_once __DIR__ . '/mailer.php';

        if ($type === 'assignment') {
            // Send a REAL-FORMAT email using the actual template with mock data
            // Mock IDs that clearly don't exist in DB (0 = test mode)
            $mockLeadId = 0;
            $mockConsultantId = 0;
            $mockRoundId = 0;

            // Build frontend URL for the report link (same logic as real emails)
            $frontendUrl = '';
            $urlSetting = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key='frontend_url' LIMIT 1");
            if ($urlSetting && $urlSetting->num_rows > 0) {
                $frontendUrl = rtrim($urlSetting->fetch_assoc()['setting_value'], '/');
            }
            if (empty($frontendUrl)) {
                $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $frontendUrl = $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
            }
            // For test, use ?test=1 — frontend shows mock data, disables submit
            $reportUrl = $frontendUrl . "/report-data?test=1";

            // Mock lead data — realistic Vietnamese customer
            $mockPhone = '0912 345 678';
            $mockName = 'Trần Thị Mai Anh';
            $mockEmail = 'maianh.tran@gmail.com';
            $mockSource = 'Facebook Ads — Chiến dịch Tuyển sinh T5/2026';
            $mockType = 'Học viên tiềm năng';
            $mockNote = "Quan tâm: Khóa Marketing Online\nNgân sách: 5–10 triệu\nThời gian học: Buổi tối / Cuối tuần\nGhi chú: Đã nhắn tin fanpage hỏi lịch khai giảng";
            $mockRound = 'Vòng A — Facebook Inbound';
            $consultantName = 'Bạn (Test)';

            $formattedNote = nl2br(htmlspecialchars($mockNote));
            $formattedSource = htmlspecialchars($mockSource);
            $formattedType = htmlspecialchars($mockType);
            $formattedEmail = htmlspecialchars($mockEmail);
            $phoneEncoded = urlencode(str_replace(' ', '', $mockPhone));

            $subject = "[TEST] Bạn vừa nhận được Lead {$mockName} — {$mockRound}";

            $content = '
                <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin-bottom:28px;border-radius:0 8px 8px 0;font-size:14px;color:#856404;">
                    ⚠️ <strong>Email thử nghiệm</strong> — Đây là email kiểm tra hệ thống, không phải Data thật.
                </div>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
                    Chào <strong>' . htmlspecialchars($consultantName) . '</strong>,<br><br>
                    Hệ thống vừa phân bổ tự động cho bạn 1 khách hàng mới từ ' . (!empty($mockRound) ? 'vòng ' . htmlspecialchars($mockRound) : 'chiến dịch Inbound') . '.
                </p>
                
                <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 24px; margin: 30px 0; border-radius: 0 12px 12px 0;">
                    <p style="color: #0f172a; font-size: 16px; margin: 0 0 15px 0; font-weight: bold; line-height: 1.6; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                        Thông tin chi tiết Khách hàng:
                    </p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.6; color: #334155;">
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; width: 140px; vertical-align: top; color: #64748b;">Họ và Tên:</td>
                            <td style="padding: 6px 0; font-weight: 700; color: #0f172a; vertical-align: top;">' . htmlspecialchars($mockName) . '</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Số điện thoại:</td>
                            <td style="padding: 6px 0; font-weight: 700; color: #d97706; vertical-align: top;">' . htmlspecialchars($mockPhone) . '</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Email:</td>
                            <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . $formattedEmail . '</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Nguồn Data:</td>
                            <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . $formattedSource . '</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Loại Data:</td>
                            <td style="padding: 6px 0; color: #0f172a; vertical-align: top;">' . $formattedType . '</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Ghi chú / Khác:</td>
                            <td style="padding: 6px 0; color: #0f172a; vertical-align: top; line-height: 1.5;">' . $formattedNote . '</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; vertical-align: top; color: #64748b;">Vòng phân bổ:</td>
                            <td style="padding: 6px 0; font-weight: 500; color: #334155; vertical-align: top;">' . htmlspecialchars($mockRound) . '</td>
                        </tr>
                    </table>
                </div>
                
                <div style="text-align: center; margin-bottom: 20px;">
                </div>

                <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px dashed #cbd5e1;">
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 12px;">Nếu Data này bị sai SĐT, Spam hoặc trùng lặp, vui lòng nhấn nút bên dưới để báo cáo và nhận Data bù.</p>
                    <a href="' . $reportUrl . '" style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 7px 22px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
                        BÁO CÁO DATA
                    </a>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 10px;">(Trong email test, link sẽ mở trang xem thử — không gửi báo cáo thật)</p>
                </div>
            ';

            $success = sendEmailNotification($email, $subject, "Có Data Mới Về!", $content);
        } else if ($type === 'zalo_sale') {
            sendWelcomeEmailToSale(99, $email, "Sale Test", "https://zalo.me/1185588456243371597");
            $success = true;
        } else if ($type === 'zalo_admin') {
            sendWelcomeEmailToAdminTicket(1, $email, "Admin Test", "https://zalo.me/1185588456243371597");
            $success = true;
        } else if ($type === 'ticket_admin') {
            sendTicketNotificationToAdmins($email, "Admin Test", "Khách Nguyễn Văn A", "0912345678", "Gọi không nghe máy, khách chặn số", "Sale Test", "Vòng A");
            $success = true;
        } else if ($type === 'ticket_sale_success') {
            sendQuickMessageEmailToSale($email, "Sale Test", "Admin đã duyệt Ticket của bạn cho khách hàng Nguyễn Văn A. Bạn đã được cộng lại 1 Data vào vòng phân bổ tiếp theo.");
            $success = true;
        } else if ($type === 'ticket_sale_fail') {
            sendQuickMessageEmailToSale($email, "Sale Test", "Admin ĐÃ TỪ CHỐI Ticket của bạn cho khách hàng Nguyễn Văn A. Lý do: Số điện thoại vẫn đổ chuông bình thường.");
            $success = true;
        } else if ($type === 'admin_confirm') {
            sendAdminConfirmationEmail($email, "Admin Test", "https://open.domation.net/confirm?token=123456");
            $success = true;
        } else if ($type === 'daily_report') {
            $statsHtml = "<li>Sale Test 1: <b>15</b> data</li><li>Sale Test 2: <b>12</b> data</li>";
            sendDailyReportEmailToAdmins($email, "Admin Test", 27, $statsHtml, 3);
            $success = true;
        } else {
            $subject = "Test Cấu hình Email từ DOMATION";
            $body = "<p>Nếu bạn nhận được email này, nghĩa là cấu hình gửi mail của bạn (Amazon SES hoặc AppScript) đang hoạt động hoàn hảo!</p><p style='color:#64748b;font-size:14px;'>Gửi lúc: " . date('d/m/Y H:i:s') . "</p>";
            $success = sendEmailNotification($email, $subject, "Kết nối thành công ✅", $body);
        }

        echo json_encode(['success' => $success, 'message' => $success ? 'Email đã được gửi thành công!' : 'Gửi email thất bại, kiểm tra cấu hình.']);
        break;

    case 'alter_schema':
        $sql = "ALTER TABLE sheet_connections ADD COLUMN connection_type VARCHAR(20) DEFAULT 'sheets' AFTER spreadsheet_id";
        if ($conn->query($sql)) {
            echo json_encode(['success' => true, 'message' => 'Schema updated successfully']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Schema update failed: ' . $conn->error]);
        }
        break;


    case 'get_accounts':
        // Include email field for display and ticket notification settings
        $res = $conn->query("SELECT id, username, name, email, role, created_at, zalo_chat_id, is_confirmed, last_login FROM accounts ORDER BY created_at DESC");
        $data = [];
        while ($row = $res->fetch_assoc())
            $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'get_admin_logs':
        $res = $conn->query("SELECT al.*, a.name as account_name, a.email as account_email 
                             FROM admin_logs al 
                             LEFT JOIN accounts a ON al.account_id = a.id 
                             ORDER BY al.created_at DESC 
                             LIMIT 1000");
        $data = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $data[] = $row;
            }
        }
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_account':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $username = trim($input['username'] ?? '');
            $password = $input['password'] ?? '';
            $name = trim($input['name'] ?? '');
            $role = $input['role'] ?? 'viewer';
            $email = trim($input['email'] ?? '');
            $zalo_chat_id = trim($input['zalo_chat_id'] ?? '');

            if (empty($username) || empty($password) || empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Tên hiển thị, username và mật khẩu là bắt buộc']);
                break;
            }
            // FEATURE: Email bắt buộc cho tất cả tài khoản (trừ Super Admin id=1 là tài khoản đặc biệt)
            if (empty($email)) {
                echo json_encode(['success' => false, 'message' => 'Email là bắt buộc để đăng nhập']);
                break;
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                echo json_encode(['success' => false, 'message' => 'Định dạng email không hợp lệ']);
                break;
            }

            $hash = password_hash($password, PASSWORD_DEFAULT);
            $token = bin2hex(random_bytes(32));

            $stmt = $conn->prepare("INSERT INTO accounts (username, password_hash, name, role, email, is_confirmed, confirm_token, zalo_chat_id) VALUES (?, ?, ?, ?, ?, 0, ?, ?)");
            $stmt->bind_param("sssssss", $username, $hash, $name, $role, $email, $token, $zalo_chat_id);

            if ($stmt->execute()) {
                $newId = $conn->insert_id;

                // Build confirm link
                $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                $basePath = preg_replace('/\/api\.php.*$/i', '', $_SERVER['REQUEST_URI'] ?? '');
                $confirmLink = $proto . '://' . $host . $basePath . '/confirm.php?token=' . $token . '&p=' . base64_encode($password);

                require_once 'mailer.php';
                sendAdminConfirmationEmail($email, $name, $confirmLink);
                logAdminAction($conn, $decodedUser['id'], 'ADD_ACCOUNT', ['id' => $newId, 'username' => $username, 'name' => $name, 'role' => $role, 'email' => $email]);

                echo json_encode(['success' => true, 'id' => $newId]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Username hoặc Email có thể đã tồn tại']);
            }
        } catch (Exception $e) {
            $msg = $e->getMessage();
            if (strpos($msg, 'Duplicate entry') !== false || $e->getCode() === 1062) {
                $msg = 'Username hoặc Email có thể đã tồn tại';
            }
            echo json_encode(['success' => false, 'message' => $msg]);
        }
        break;

    case 'edit_account':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($input['id'] ?? 0);
            $username = trim($input['username'] ?? '');
            $password = $input['password'] ?? '';
            $name = trim($input['name'] ?? '');
            $role = $input['role'] ?? 'viewer';
            $email = trim($input['email'] ?? '');
            $zalo_chat_id = trim($input['zalo_chat_id'] ?? '');

            // FEATURE: Email bắt buộc cho tất cả tài khoản không phải Super Admin (id=1)
            if ($id !== 1) {
                if (empty($email)) {
                    echo json_encode(['success' => false, 'message' => 'Email là bắt buộc để đăng nhập']);
                    break;
                }
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    echo json_encode(['success' => false, 'message' => 'Định dạng email không hợp lệ']);
                    break;
                }
            }

            // Đảm bảo nếu email trống (chỉ được phép đối với Super Admin id=1) thì lưu là NULL thay vì chuỗi rỗng
            // để tránh lỗi vi phạm UNIQUE constraint trong MySQL (nhiều dòng có thể là NULL, nhưng chỉ có một dòng có thể là '')
            $dbEmail = empty($email) ? null : $email;

            if (!empty($password)) {
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $conn->prepare("UPDATE accounts SET username=?, password_hash=?, name=?, role=?, email=?, zalo_chat_id=? WHERE id=?");
                $stmt->bind_param("ssssssi", $username, $hash, $name, $role, $dbEmail, $zalo_chat_id, $id);
            } else {
                $stmt = $conn->prepare("UPDATE accounts SET username=?, name=?, role=?, email=?, zalo_chat_id=? WHERE id=?");
                $stmt->bind_param("sssssi", $username, $name, $role, $dbEmail, $zalo_chat_id, $id);
            }

            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'EDIT_ACCOUNT', ['id' => $id, 'username' => $username, 'name' => $name, 'role' => $role, 'email' => $email]);
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Cập nhật thất bại, username hoặc email có thể bị trùng']);
            }
        } catch (Exception $e) {
            $msg = $e->getMessage();
            if (strpos($msg, 'Duplicate entry') !== false || $e->getCode() === 1062) {
                $msg = 'Cập nhật thất bại, username hoặc email có thể bị trùng';
            }
            echo json_encode(['success' => false, 'message' => $msg]);
        }
        break;

    case 'update_profile':
        $input = json_decode(file_get_contents('php://input'), true);
        $name = $input['name'] ?? '';
        $email = $input['email'] ?? '';
        $userId = $decodedUser['id'];

        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tên không được để trống']);
            break;
        }

        $upd = $conn->prepare("UPDATE accounts SET name = ?, email = ? WHERE id = ?");
        $upd->bind_param("ssi", $name, $email, $userId);
        if ($upd->execute()) {
            logAdminAction($conn, $userId, 'UPDATE_PROFILE', ['name' => $name, 'email' => $email]);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Lỗi khi cập nhật hồ sơ']);
        }
        break;

    case 'change_password':
        $input = json_decode(file_get_contents('php://input'), true);
        $old_pass = $input['old_password'] ?? '';
        $new_pass = $input['new_password'] ?? '';
        $userId = $decodedUser['id'];

        $stmt = $conn->prepare("SELECT password_hash FROM accounts WHERE id = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $res = $stmt->get_result();
        
        if ($row = $res->fetch_assoc()) {
            if (password_verify($old_pass, $row['password_hash'])) {
                $hash = password_hash($new_pass, PASSWORD_DEFAULT);
                $upd = $conn->prepare("UPDATE accounts SET password_hash = ? WHERE id = ?");
                $upd->bind_param("si", $hash, $userId);
                $upd->execute();
                logAdminAction($conn, $userId, 'CHANGE_PASSWORD', []);
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Mật khẩu cũ không chính xác']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy tài khoản']);
        }
        break;

    case 'check_delete_account':
        $id = (int) ($_GET['id'] ?? 0);

        // 1. Check fallback_type and fallback_admin_id
        $isFallback = false;
        $stmtFb = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_type' LIMIT 1");
        $stmtFb->execute();
        $resFb = $stmtFb->get_result();
        $fbType = $resFb->fetch_assoc()['setting_value'] ?? 'round';

        if ($fbType === 'admin') {
            $stmtFbAdmin = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_admin_id' LIMIT 1");
            $stmtFbAdmin->execute();
            $resFbAdmin = $stmtFbAdmin->get_result();
            $fbAdminId = (int) ($resFbAdmin->fetch_assoc()['setting_value'] ?? 0);
            if ($fbAdminId === $id) {
                $isFallback = true;
            }
        }

        // 2. Check ticket_notify_settings
        $isTicket = false;
        $stmtTick = $conn->prepare("SELECT COUNT(*) as cnt FROM ticket_notify_settings WHERE account_id = ?");
        $stmtTick->bind_param("i", $id);
        $stmtTick->execute();
        $resTick = $stmtTick->get_result()->fetch_assoc();
        $stmtTick->close();
        if (($resTick['cnt'] ?? 0) > 0) {
            $isTicket = true;
        }

        // 3. Fetch other admins (role = 'admin' and id != $id)
        $otherAdmins = [];
        $stmtOther = $conn->prepare("SELECT id, name, username, email FROM accounts WHERE role = 'admin' AND id != ?");
        $stmtOther->bind_param("i", $id);
        $stmtOther->execute();
        $resOther = $stmtOther->get_result();
        if ($resOther) {
            while ($row = $resOther->fetch_assoc()) {
                $otherAdmins[] = $row;
            }
        }

        echo json_encode([
            'success' => true,
            'in_use' => ($isFallback || $isTicket),
            'usage' => [
                'fallback' => $isFallback,
                'ticket' => $isTicket
            ],
            'other_admins' => $otherAdmins
        ]);
        break;

    case 'delete_account':
        $id = (int) ($_GET['id'] ?? 0);
        if ($id === 1) { // Prevent deleting default super admin
            echo json_encode(['success' => false, 'message' => 'Không thể xóa tài khoản Super Admin']);
            break;
        }

        $replacementId = (int) ($_GET['replacement_id'] ?? $_POST['replacement_id'] ?? 0);

        // Check if in use
        $isFallback = false;
        $stmtFb = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_type' LIMIT 1");
        $stmtFb->execute();
        $resFb = $stmtFb->get_result();
        $fbType = $resFb->fetch_assoc()['setting_value'] ?? 'round';

        if ($fbType === 'admin') {
            $stmtFbAdmin = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'fallback_admin_id' LIMIT 1");
            $stmtFbAdmin->execute();
            $resFbAdmin = $stmtFbAdmin->get_result();
            $fbAdminId = (int) ($resFbAdmin->fetch_assoc()['setting_value'] ?? 0);
            if ($fbAdminId === $id) {
                $isFallback = true;
            }
        }

        $isTicket = false;
        $stmtTick = $conn->prepare("SELECT COUNT(*) as cnt FROM ticket_notify_settings WHERE account_id = ?");
        $stmtTick->bind_param("i", $id);
        $stmtTick->execute();
        $resTick = $stmtTick->get_result()->fetch_assoc();
        $stmtTick->close();
        if (($resTick['cnt'] ?? 0) > 0) {
            $isTicket = true;
        }

        if (($isFallback || $isTicket) && $replacementId <= 0) {
            echo json_encode([
                'success' => false,
                'message' => 'Tài khoản đang nhận fallback hoặc ticket, yêu cầu chọn admin thay thế trước khi xóa.'
            ]);
            break;
        }

        $conn->begin_transaction();
        try {
            if ($replacementId > 0) {
                // Verify replacement is admin
                $stmtVerify = $conn->prepare("SELECT id FROM accounts WHERE id = ? AND role = 'admin' LIMIT 1");
                $stmtVerify->bind_param("i", $replacementId);
                $stmtVerify->execute();
                if ($stmtVerify->get_result()->num_rows === 0) {
                    throw new Exception("Admin thay thế không hợp lệ");
                }

                // Transfer fallback
                if ($isFallback) {
                    $stmtUpdFb = $conn->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'fallback_admin_id'");
                    $stmtUpdFb->bind_param("s", $replacementId);
                    $stmtUpdFb->execute();
                }

                // Transfer ticket notify settings
                if ($isTicket) {
                    $stmtDelTick = $conn->prepare("DELETE FROM ticket_notify_settings WHERE account_id = ?");
                    $stmtDelTick->bind_param("i", $id);
                    $stmtDelTick->execute();
                    $stmtDelTick->close();

                    $stmtInsTick = $conn->prepare("INSERT IGNORE INTO ticket_notify_settings (account_id) VALUES (?)");
                    $stmtInsTick->bind_param("i", $replacementId);
                    $stmtInsTick->execute();
                    $stmtInsTick->close();
                }
            }

            // Finally, delete the account
            $stmtDelAcc = $conn->prepare("DELETE FROM accounts WHERE id = ?");
            $stmtDelAcc->bind_param("i", $id);
            $stmtDelAcc->execute();

            logAdminAction($conn, $decodedUser['id'], 'DELETE_ACCOUNT', ['id' => $id]);
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống: ' . $e->getMessage()]);
        }
        break;

    case 'resend_confirm_email':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int) ($input['id'] ?? 0);

        $stmtAcc = $conn->prepare("SELECT email, name FROM accounts WHERE id = ?");
        $stmtAcc->bind_param("i", $id);
        $stmtAcc->execute();
        $res = $stmtAcc->get_result();
        if ($res && $res->num_rows > 0) {
            $account = $res->fetch_assoc();
            if (empty($account['email'])) {
                echo json_encode(['success' => false, 'message' => 'Tài khoản này chưa có email']);
                break;
            }

            $token = bin2hex(random_bytes(32));
            $stmt = $conn->prepare("UPDATE accounts SET confirm_token = ?, is_confirmed = 0 WHERE id = ?");
            $stmt->bind_param("si", $token, $id);
            if ($stmt->execute()) {
                $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                $basePath = preg_replace('/\/api\.php.*$/i', '', $_SERVER['REQUEST_URI'] ?? '');
                $confirmLink = $proto . '://' . $host . $basePath . '/confirm.php?token=' . $token;

                require_once 'mailer.php';
                sendAdminConfirmationEmail($account['email'], $account['name'], $confirmLink);

                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Không thể tạo lại token']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy tài khoản']);
        }
        break;

    case 'resend_zalo_verify_account':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int) ($input['id'] ?? 0);
        $stmtAcc = $conn->prepare("SELECT email, name FROM accounts WHERE id = ?");
        $stmtAcc->bind_param("i", $id);
        $stmtAcc->execute();
        $res = $stmtAcc->get_result();
        if ($res && $res->num_rows > 0) {
            $account = $res->fetch_assoc();
            if (empty($account['email'])) {
                echo json_encode(['success' => false, 'message' => 'Tài khoản này chưa có email để nhận thông báo']);
                break;
            }
            require_once 'mailer.php';
            $settingStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_link'");
            $botLink = "https://zalo.me/1185588456243371597"; // Default
            if ($settingStmt && $settingStmt->num_rows > 0) {
                $row = $settingStmt->fetch_assoc();
                if (!empty($row['setting_value'])) $botLink = $row['setting_value'];
            }
            sendWelcomeEmailToAdminTicket($id, $account['email'], $account['name'], $botLink, true);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy tài khoản']);
        }
        break;

    case 'resend_zalo_verify_consultant':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int) ($input['id'] ?? 0);
        $stmtCon = $conn->prepare("SELECT email, name FROM consultants WHERE id = ?");
        $stmtCon->bind_param("i", $id);
        $stmtCon->execute();
        $res = $stmtCon->get_result();
        if ($res && $res->num_rows > 0) {
            $consultant = $res->fetch_assoc();
            if (empty($consultant['email'])) {
                echo json_encode(['success' => false, 'message' => 'Tư vấn viên này chưa có email']);
                break;
            }
            require_once 'mailer.php';
            $settingStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_link'");
            $botLink = "https://zalo.me/1185588456243371597"; // Default
            if ($settingStmt && $settingStmt->num_rows > 0) {
                $row = $settingStmt->fetch_assoc();
                if (!empty($row['setting_value'])) $botLink = $row['setting_value'];
            }
            sendWelcomeEmailToSale($id, $consultant['email'], $consultant['name'], $botLink, true);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy tư vấn viên']);
        }
        break;

    // ── TICKET NOTIFICATION SETTINGS ──────────────────────────────────────────
    case 'get_ticket_settings':
        // Trả về danh sách account_id được chọn nhận thông báo ticket
        $res = $conn->query("SELECT account_id FROM ticket_notify_settings");
        $ids = [];
        if ($res)
            while ($r = $res->fetch_assoc())
                $ids[] = (int) $r['account_id'];
        echo json_encode(['success' => true, 'data' => $ids]);
        break;

    case 'save_ticket_settings':
        $input = json_decode(file_get_contents('php://input'), true);
        $adminIds = array_map('intval', $input['admin_ids'] ?? []);

        // Lấy danh sách admin đang nhận thông báo trước khi lưu
        $existingRes = $conn->query("SELECT account_id FROM ticket_notify_settings");
        $existingIds = [];
        if ($existingRes) {
            while ($row = $existingRes->fetch_assoc()) {
                $existingIds[] = (int) $row['account_id'];
            }
        }

        // Tìm các admin mới được thêm vào (chuyển từ Tắt sang Bật)
        $newlyAddedIds = array_diff($adminIds, $existingIds);

        $conn->begin_transaction();
        try {
            // Xóa toàn bộ cấu hình cũ rồi insert lại
            $conn->query("DELETE FROM ticket_notify_settings");
            if (!empty($adminIds)) {
                $insStmt = $conn->prepare("INSERT IGNORE INTO ticket_notify_settings (account_id) VALUES (?)");
                foreach ($adminIds as $aid) {
                    if ($aid > 0) {
                        $insStmt->bind_param("i", $aid);
                        $insStmt->execute();
                    }
                }
            }
            logAdminAction($conn, $decodedUser['id'], 'SAVE_TICKET_SETTINGS', ['admin_ids' => $adminIds]);
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Lỗi lưu cấu hình: ' . getSafeErrorMsg($e)]);
            break;
        }

        // Chỉ gửi thông báo Zalo và email cho admin mới được bật
        if (!empty($newlyAddedIds)) {
            try {
                require_once 'mailer.php';
                require_once 'zalo_bot.php';

                $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

                $stmtLink = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_link' LIMIT 1");
                $botLink = $stmtLink->fetch_assoc()['setting_value'] ?? 'https://zalo.me/1185588456243371597';

                $newIdsStr = implode(',', $newlyAddedIds);
                $resAdmins = $conn->query("SELECT id, email, name, zalo_chat_id FROM accounts WHERE id IN ($newIdsStr)");
                if ($resAdmins) {
                    while ($admin = $resAdmins->fetch_assoc()) {
                        try {
                            if (!empty($admin['email'])) {
                                sendAdminAddedToTicketEmail($admin['email'], $admin['name']);
                            }
                        } catch (Exception $emailEx) {
                            error_log("Failed to send email to admin " . $admin['id'] . ": " . $emailEx->getMessage());
                        }

                        try {
                            if (!empty($botToken) && !empty($admin['zalo_chat_id'])) {
                                $zName = $admin['name'] ?: 'Quản trị viên';
                                $zaloMsg = "[ PHÂN QUYỀN TICKET ]\n\n"
                                    . "Chào $zName,\n"
                                    . "Bạn vừa được cấp quyền xử lý Báo cáo lỗi (Ticket) từ hệ thống Domation DATA.\n\n"
                                    . "Từ bây giờ, hệ thống sẽ tự động gửi thông báo cho bạn mỗi khi có Ticket mới chờ duyệt.";
                                sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg);
                            }
                        } catch (Exception $zaloEx) {
                            error_log("Failed to send Zalo message to admin " . $admin['id'] . ": " . $zaloEx->getMessage());
                        }
                    }
                }
            } catch (Exception $notifyEx) {
                error_log("General notification error in save_ticket_settings: " . $notifyEx->getMessage());
            }
        }

        echo json_encode(['success' => true]);
        break;

    case 'force_sync':
        $id = (int) ($_GET['id'] ?? 0);
        if ($id) {
            ob_start();
            try {
                // Mock CLI arguments for cron_sync.php
                $argv = ['cron_sync.php', $id];
                require __DIR__ . '/cron_sync.php';
                $output = ob_get_clean();
                logAdminAction($conn, $decodedUser['id'], 'FORCE_SYNC', ['connection_id' => $id]);
                echo json_encode(['success' => true, 'output' => $output]);
            } catch (Exception $e) {
                ob_end_clean();
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid ID']);
        }
        break;

    case 'get_dashboard_stats':
        $date = $_GET['date'] ?? 'Hôm nay';

        // Define date filters - SARGable for performance
        $dateCondition = "received_at >= CURDATE() AND received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        $prevDateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND received_at < CURDATE()";

        if ($date === 'Hôm qua') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND received_at < CURDATE()";
            $prevDateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        } else if ($date === '7 ngày qua') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            $prevDateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } else if ($date === '30 ngày qua') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
            $prevDateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        } else if ($date === 'Tháng này') {
            $dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
            $prevDateCondition = "received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
        } else if ($date === 'Tháng trước') {
            $dateCondition = "received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
            $prevDateCondition = "received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 2 MONTH) AND received_at < DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "received_at >= '$start 00:00:00' AND received_at <= '$end 23:59:59'";
            $diff = max(1, (strtotime($end) - strtotime($start)) / 86400);
            $prevDateCondition = "received_at >= DATE_SUB('$start', INTERVAL $diff DAY) AND received_at < '$start'";
        }

        // Query current period stats using GROUP BY for index optimization
        $statsSql = "SELECT status, COUNT(*) as cnt FROM distribution_logs WHERE $dateCondition AND status != 'silent' GROUP BY status";
        $statsResRaw = $conn->query($statsSql);
        $statsRes = ['total' => 0, 'distributed' => 0, 'duplicates' => 0, 'errors' => 0];
        if ($statsResRaw) {
            while ($row = $statsResRaw->fetch_assoc()) {
                $status = $row['status'];
                $cnt = (int) $row['cnt'];
                $statsRes['total'] += $cnt;
                if ($status === 'assigned' || $status === 'compensation')
                    $statsRes['distributed'] += $cnt;
                else if ($status === 'duplicate' || $status === 'reminder')
                    $statsRes['duplicates'] += $cnt;
                else if ($status === 'error')
                    $statsRes['errors'] += $cnt;
                else if ($status === 'rule_6_month')
                    $statsRes['distributed'] += $cnt;
            }
        }

        // Query previous period stats for % change
        $prevStatsSql = "SELECT status, COUNT(*) as cnt FROM distribution_logs WHERE $prevDateCondition AND status != 'silent' GROUP BY status";
        $prevStatsResRaw = $conn->query($prevStatsSql);
        $prevStatsRes = ['total' => 0, 'distributed' => 0, 'duplicates' => 0, 'errors' => 0];
        if ($prevStatsResRaw) {
            while ($row = $prevStatsResRaw->fetch_assoc()) {
                $status = $row['status'];
                $cnt = (int) $row['cnt'];
                $prevStatsRes['total'] += $cnt;
                if ($status === 'assigned' || $status === 'compensation')
                    $prevStatsRes['distributed'] += $cnt;
                else if ($status === 'duplicate' || $status === 'reminder')
                    $prevStatsRes['duplicates'] += $cnt;
                else if ($status === 'error')
                    $prevStatsRes['errors'] += $cnt;
                else if ($status === 'rule_6_month')
                    $prevStatsRes['distributed'] += $cnt;
            }
        }

        $calcChange = function ($current, $prev) {
            $current = (int) $current;
            $prev = (int) $prev;
            if ($prev == 0)
                return $current > 0 ? '+100%' : '0%';
            $change = (($current - $prev) / $prev) * 100;
            return ($change > 0 ? '+' : '') . number_format($change, 1) . '%';
        };

        // Query hourly/daily chart data
        $chartMode = $_GET['chart_mode'] ?? '';
        $useHourly = ($chartMode === 'hour') || ($chartMode !== 'day' && ($date === 'Hôm nay' || $date === 'Hôm qua'));

        $chartData = [];
        if ($useHourly) {
            $hourlySql = "SELECT HOUR(received_at) as h, COUNT(*) as vol FROM distribution_logs WHERE $dateCondition AND status != 'silent' GROUP BY HOUR(received_at) ORDER BY h ASC";
            $res = $conn->query($hourlySql);
            $hourlyMap = [];
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $hourlyMap[(int)$row['h']] = (int)$row['vol'];
                }
            }
            for ($i = 0; $i <= 23; $i++) {
                $vol = $hourlyMap[$i] ?? 0;
                $chartData[] = ['time' => str_pad($i, 2, '0', STR_PAD_LEFT) . 'h', 'volume' => $vol];
            }
        } else {
            // For daily
            $dailySql = "SELECT DATE(received_at) as d, COUNT(*) as vol FROM distribution_logs WHERE $dateCondition AND status != 'silent' GROUP BY DATE(received_at) ORDER BY d ASC";
            $res = $conn->query($dailySql);
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $chartData[] = ['time' => date('d/m', strtotime($row['d'])), 'volume' => (int)$row['vol']];
                }
            }
        }

        // Query Top Consultants
        $topConsultantsSql = "SELECT c.name, COUNT(dl.id) as data_count 
                              FROM distribution_logs dl 
                              JOIN consultants c ON dl.assigned_to = c.id 
                              WHERE $dateCondition AND dl.status IN ('assigned', 'compensation', 'error', 'rule_6_month') 
                              GROUP BY c.id ORDER BY data_count DESC";
        $topConsultantsRes = $conn->query($topConsultantsSql);
        $topConsultants = [];
        $totalAssignedForTop = max(1, (int) $statsRes['distributed']);
        $colors = ['#7c3aed', '#3b82f6', '#f59e0b', '#10b981'];
        $i = 0;
        while ($row = $topConsultantsRes->fetch_assoc()) {
            $percent = round(($row['data_count'] / $totalAssignedForTop) * 100, 1);
            $topConsultants[] = [
                'name' => $row['name'],
                'data' => (int) $row['data_count'],
                'percent' => $percent,
                'color' => $colors[$i % 4]
            ];
            $i++;
        }

        // Query Round Ratio
        $roundRatioSql = "SELECT dr.round_name, COUNT(dl.id) as count 
                          FROM distribution_logs dl 
                          JOIN distribution_rounds dr ON dl.round_id = dr.id 
                          WHERE $dateCondition AND dl.status IN ('assigned', 'compensation', 'error', 'rule_6_month') 
                          GROUP BY dr.id ORDER BY count DESC";
        $roundRatioRes = $conn->query($roundRatioSql);
        $roundRatio = [];
        $totalDistributed = max(1, (int) $statsRes['distributed']);
        $roundColors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
        $j = 0;
        while ($row = $roundRatioRes->fetch_assoc()) {
            $percent = round(($row['count'] / $totalDistributed) * 100, 1);
            $roundRatio[] = [
                'round' => $row['round_name'],
                'count' => (int) $row['count'],
                'percent' => $percent,
                'color' => $roundColors[$j % 5]
            ];
            $j++;
        }
        // Query Source Ratio (fallback to l.source if sc.sheet_name is null)
        $sourceSql = "SELECT COALESCE(sc.sheet_name, l.source) as source, COUNT(dl.id) as count 
                      FROM distribution_logs dl 
                      JOIN leads l ON dl.lead_id = l.id
                      LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
                      WHERE $dateCondition AND dl.status != 'silent'
                      GROUP BY COALESCE(sc.sheet_name, l.source) ORDER BY count DESC";
        $sourceResRaw = $conn->query($sourceSql);
        $sourceStats = [];
        if ($sourceResRaw) {
            $colors = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
            $i = 0;
            while ($row = $sourceResRaw->fetch_assoc()) {
                $sourceStats[] = [
                    'name' => $row['source'] ?: 'Không xác định',
                    'value' => (int) $row['count'],
                    'color' => $colors[$i % count($colors)]
                ];
                $i++;
            }
        }

        // Query Error Stats by Consultant
        $errorSql = "SELECT c.name, COUNT(dl.id) as count 
                     FROM distribution_logs dl 
                     JOIN consultants c ON dl.assigned_to = c.id
                     WHERE $dateCondition AND dl.status = 'error'
                     GROUP BY c.id ORDER BY count DESC";
        $errorResRaw = $conn->query($errorSql);
        $errorStats = [];
        if ($errorResRaw) {
            while ($row = $errorResRaw->fetch_assoc()) {
                $errorStats[] = [
                    'name' => $row['name'],
                    'errors' => (int) $row['count']
                ];
            }
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'total_today' => (int) $statsRes['total'],
                'distributed_today' => (int) $statsRes['distributed'],
                'duplicates' => (int) $statsRes['duplicates'],
                'errors' => (int) $statsRes['errors'],
                'total_change' => $calcChange($statsRes['total'], $prevStatsRes['total']),
                'distributed_change' => $calcChange($statsRes['distributed'], $prevStatsRes['distributed']),
                'duplicates_change' => $calcChange($statsRes['duplicates'], $prevStatsRes['duplicates']),
                'errors_change' => $calcChange($statsRes['errors'], $prevStatsRes['errors']),
                'chartData' => $chartData,
                'topConsultants' => $topConsultants,
                'roundRatio' => $roundRatio,
                'sourceStats' => $sourceStats,
                'errorStats' => $errorStats
            ]
        ]);
        break;

    case 'reassign_lead':
        $input = json_decode(file_get_contents('php://input'), true);
        $log_id = (int) ($input['log_id'] ?? 0);
        $new_consultant_id = (int) ($input['new_consultant_id'] ?? 0);
        $compensate_old_sale = isset($input['compensate_old_sale']) ? (bool)$input['compensate_old_sale'] : false;

        if (!$log_id || !$new_consultant_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID Log hoặc ID TVV mới']);
            break;
        }

        // 1. Fetch lead details, old consultant details, and new consultant details
        $stmt = $conn->prepare("
            SELECT dl.lead_id, dl.round_id, dl.assigned_to as old_consultant_id, c_old.name as old_consultant_name, dl.status as log_status, l.name as lead_name, l.phone, l.email as lead_email, l.note, l.source, l.type, r.cc_emails
            FROM distribution_logs dl
            LEFT JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            LEFT JOIN consultants c_old ON dl.assigned_to = c_old.id
            WHERE dl.id = ?
        ");
        $stmt->bind_param("i", $log_id);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy log phân bổ']);
            break;
        }
        $log_data = $res->fetch_assoc();
        $lead_id = $log_data['lead_id'];
        $old_consultant_id = $log_data['old_consultant_id'] ? (int)$log_data['old_consultant_id'] : null;
        $old_consultant_name = $log_data['old_consultant_name'] ?? '';
        $cc_emails = $log_data['cc_emails'] ?? '';
        $lead_phone = $log_data['phone'] ?? '';
        $lead_email = $log_data['lead_email'] ?? '';
        $log_status = $log_data['log_status'] ?? '';

        // Check if this lead is duplicate (has duplicate history)
        $isDuplicateLead = false;
        if ($log_status === 'reminder') {
            $isDuplicateLead = true;
        } else if (!empty($lead_phone) || !empty($lead_email)) {
            $dupQuery = "SELECT id FROM leads WHERE id != ? AND (";
            $dupParams = [$lead_id];
            $dupTypes = 'i';
            $orParts = [];
            if (!empty($lead_phone)) {
                $orParts[] = "phone = ?";
                $dupParams[] = $lead_phone;
                $dupTypes .= 's';
            }
            if (!empty($lead_email)) {
                $orParts[] = "email = ?";
                $dupParams[] = $lead_email;
                $dupTypes .= 's';
            }
            $dupQuery .= implode(" OR ", $orParts) . ") LIMIT 1";
            
            $stmtDup = $conn->prepare($dupQuery);
            if ($stmtDup) {
                $stmtDup->bind_param($dupTypes, ...$dupParams);
                $stmtDup->execute();
                $resDup = $stmtDup->get_result();
                if ($resDup->num_rows > 0) {
                    $isDuplicateLead = true;
                }
                $stmtDup->close();
            }
        }

        // Fetch new consultant details
        $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
        $stmtC->bind_param("i", $new_consultant_id);
        $stmtC->execute();
        $resC = $stmtC->get_result();
        if ($resC->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy Tư vấn viên']);
            break;
        }
        $cons_data = $resC->fetch_assoc();
        $new_cons_name = $cons_data['name'];
        $new_cons_email = $cons_data['email'];

        $conn->begin_transaction();
        try {
            // 2. Perform updates
            $newLogStatus = $isDuplicateLead ? 'reminder' : 'assigned';

            // Update distribution_logs
            $stmtU1 = $conn->prepare("UPDATE distribution_logs SET assigned_to = ?, status = ? WHERE id = ?");
            $stmtU1->bind_param("isi", $new_consultant_id, $newLogStatus, $log_id);
            $stmtU1->execute();

            // Update leads
            $stmtU2 = $conn->prepare("UPDATE leads SET assigned_to = ? WHERE id = ?");
            $stmtU2->bind_param("ii", $new_consultant_id, $lead_id);
            $stmtU2->execute();

            if ($compensate_old_sale && $old_consultant_id) {
                // Check if the consultant is enrolled in the round
                $chkEnroll = $conn->prepare("SELECT 1 FROM round_consultants WHERE round_id = ? AND consultant_id = ? LIMIT 1");
                $chkEnroll->bind_param("ii", $log_data['round_id'], $old_consultant_id);
                $chkEnroll->execute();
                $hasEnroll = $chkEnroll->get_result()->num_rows > 0;
                $chkEnroll->close();

                if ($hasEnroll) {
                    $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                    $updComp->bind_param("ii", $log_data['round_id'], $old_consultant_id);
                    $updComp->execute();
                    $updComp->close();
                } else {
                    // If not enrolled, insert a record with compensation count = 1
                    $insComp = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn, compensation_count) VALUES (?, ?, 1, 1, 1)");
                    $insComp->bind_param("ii", $log_data['round_id'], $old_consultant_id);
                    $insComp->execute();
                    $insComp->close();
                }
            }

            logAdminAction($conn, $decodedUser['id'], 'REASSIGN_LEAD', [
                'log_id' => $log_id,
                'lead_id' => $lead_id,
                'lead_name' => $log_data['lead_name'],
                'phone' => $log_data['phone'],
                'old_consultant_id' => $old_consultant_id,
                'old_consultant_name' => $old_consultant_name,
                'new_consultant_id' => $new_consultant_id,
                'new_consultant_name' => $new_cons_name,
                'is_duplicate' => $isDuplicateLead,
                'compensated' => $compensate_old_sale
            ]);
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // Đã commit giao dịch thành công. Bắt đầu gửi thông báo ngoài transaction
        try {
            require_once __DIR__ . '/mailer.php';
            require_once __DIR__ . '/zalo_bot.php';
            require_once __DIR__ . '/webhook_logic.php'; // For getLeadHistoryTimeline

            // Notify old consultant of compensation if applicable
            if ($compensate_old_sale && $old_consultant_id) {
                try {
                    $oldConsultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
                    $oldConsultStmt->bind_param("i", $old_consultant_id);
                    $oldConsultStmt->execute();
                    $oldConsultant = $oldConsultStmt->get_result()->fetch_assoc();
                    $oldConsultStmt->close();

                    if ($oldConsultant) {
                        $oldCName = $oldConsultant['name'];
                        $oldCEmail = $oldConsultant['email'];
                        $oldCZalo = $oldConsultant['zalo_chat_id'];
                        $lName = $log_data['lead_name'] ?: 'Khách hàng ẩn danh';

                        $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                        $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

                        if (!empty($botToken) && !empty($oldCZalo)) {
                            try {
                                $zaloMsg = "[ ĐỀN BÙ DATA ]\n\n"
                                    . "Chào $oldCName, Lead \"$lName\" của bạn đã được chuyển giao cho Tư vấn viên khác.\n\n"
                                    . "Hệ thống đã tự động ghi nhận 1 lượt đền bù data mới cho bạn ở vòng này.";
                                sendZaloMessage($botToken, $oldCZalo, $zaloMsg);
                            } catch (Exception $zEx) {
                                error_log("Error sending Zalo compensation to old sale: " . $zEx->getMessage());
                            }
                        }

                        if (!empty($oldCEmail)) {
                            try {
                                $emailSubj = "[Domation DATA] Thông báo đền bù Data - $lName";
                                $emailBody = "<h3>Đền bù Data do chuyển giao lại</h3>
                                              <p>Chào $oldCName,</p>
                                              <p>Lead <strong>$lName</strong> đã được chuyển giao cho Tư vấn viên khác.</p>
                                              <p>Hệ thống đã tự động cộng thêm 1 lượt đền bù cho bạn trong vòng phân bổ này.</p>";
                                sendEmailNotification($oldCEmail, $emailSubj, 'Thông báo đền bù', $emailBody, '');
                            } catch (Exception $eEx) {
                                error_log("Error sending email compensation to old sale: " . $eEx->getMessage());
                            }
                        }
                    }
                } catch (Exception $oldSaleEx) {
                    error_log("Error processing compensation notification for old sale: " . $oldSaleEx->getMessage());
                }
            }

            // Fetch round name
            $roundNameStr = '';
            $roundId = (int) ($log_data['round_id'] ?? 0);
            if ($roundId) {
                try {
                    $rStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                    $rStmt->bind_param("i", $roundId);
                    $rStmt->execute();
                    $rRes = $rStmt->get_result();
                    if ($rRes->num_rows > 0)
                        $roundNameStr = $rRes->fetch_assoc()['round_name'] ?? '';
                    $rStmt->close();
                } catch (Exception $rEx) {
                    error_log("Error fetching round name in reassign_lead: " . $rEx->getMessage());
                }
            }

            if ($isDuplicateLead) {
                try {
                    $timeline = getLeadHistoryTimeline($conn, $lead_id);
                    try {
                        sendLeadReminderEmailToSale(
                            $new_cons_email,
                            $new_cons_name,
                            $log_data['lead_name'] ?: 'Khách hàng ẩn danh',
                            $log_data['phone'] ?: '',
                            $log_data['note'] ?: '',
                            $log_data['source'] ?: '',
                            $cc_emails,
                            $roundNameStr,
                            $timeline,
                            $lead_id
                        );
                    } catch (Exception $eEx) {
                        error_log("Error sending duplicate reminder email to new sale: " . $eEx->getMessage());
                    }

                    try {
                        sendLeadReminderZaloMessageToSale(
                            $new_consultant_id,
                            $new_cons_name,
                            $log_data['lead_name'] ?: 'Khách hàng ẩn danh',
                            $log_data['phone'] ?: '',
                            $log_data['note'] ?: '',
                            $log_data['source'] ?: '',
                            $roundNameStr,
                            $timeline,
                            $lead_id,
                            $log_data['lead_email'] ?: '',
                            $log_data['type'] ?: ''
                        );
                    } catch (Exception $zEx) {
                        error_log("Error sending duplicate reminder Zalo to new sale: " . $zEx->getMessage());
                    }
                } catch (Exception $dupEx) {
                    error_log("Error processing duplicate reminders in reassign_lead: " . $dupEx->getMessage());
                }
            } else {
                try {
                    try {
                        sendLeadAssignedEmailToSale(
                            $new_cons_email,
                            $new_cons_name,
                            $log_data['lead_name'] ?: 'Khach hang an danh',
                            $log_data['phone'] ?: '',
                            $log_data['note'] ?: '',
                            $log_data['source'] ?: '',
                            $cc_emails,
                            $roundNameStr,
                            $lead_id,
                            $new_consultant_id,
                            $roundId
                        );
                    } catch (Exception $eEx) {
                        error_log("Error sending assignment email to new sale: " . $eEx->getMessage());
                    }

                    try {
                        sendLeadAssignedZaloMessageToSale(
                            $new_consultant_id,
                            $new_cons_name,
                            $log_data['lead_name'] ?: 'Khach hang an danh',
                            $log_data['phone'] ?: '',
                            $log_data['note'] ?: '',
                            $log_data['source'] ?: '',
                            $roundNameStr,
                            $lead_id,
                            $roundId,
                            $log_data['lead_email'] ?: '',
                            $log_data['type'] ?: ''
                        );
                    } catch (Exception $zEx) {
                        error_log("Error sending assignment Zalo to new sale: " . $zEx->getMessage());
                    }
                } catch (Exception $assignEx) {
                    error_log("Error processing assignment notifications in reassign_lead: " . $assignEx->getMessage());
                }
            }
        } catch (Exception $notifyOuterEx) {
            error_log("Outer notification error in reassign_lead: " . $notifyOuterEx->getMessage());
        }

        echo json_encode(['success' => true]);
        break;

    case 'block_lead':
        $input = json_decode(file_get_contents('php://input'), true);
        $log_id = (int) ($input['log_id'] ?? 0);
        $compensate_sale = isset($input['compensate_sale']) ? (bool)$input['compensate_sale'] : false;
        $reason = trim($input['reason'] ?? '');

        if (!$log_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID Log phân bổ']);
            break;
        }

        // 1. Fetch details of lead, consultant, and round
        $stmt = $conn->prepare("
            SELECT dl.lead_id, dl.round_id, dl.assigned_to as old_consultant_id, c_old.name as old_consultant_name, 
                   c_old.email as old_consultant_email, c_old.zalo_chat_id as old_consultant_zalo,
                   l.name as lead_name, l.phone as lead_phone, l.email as lead_email, l.note as lead_note, 
                   r.round_name
            FROM distribution_logs dl
            LEFT JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            LEFT JOIN consultants c_old ON dl.assigned_to = c_old.id
            WHERE dl.id = ?
        ");
        $stmt->bind_param("i", $log_id);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy log phân bổ']);
            $stmt->close();
            break;
        }
        $log_data = $res->fetch_assoc();
        $stmt->close();

        $lead_id = $log_data['lead_id'];
        $round_id = $log_data['round_id'] ? (int)$log_data['round_id'] : null;
        $old_consultant_id = $log_data['old_consultant_id'] ? (int)$log_data['old_consultant_id'] : null;
        $old_consultant_name = $log_data['old_consultant_name'] ?? '';
        $old_consultant_email = $log_data['old_consultant_email'] ?? '';
        $old_consultant_zalo = $log_data['old_consultant_zalo'] ?? '';
        $lead_phone = trim($log_data['lead_phone'] ?? '');
        $lead_email = trim($log_data['lead_email'] ?? '');
        $lead_name = $log_data['lead_name'] ?: 'Khách hàng ẩn danh';
        $round_name = $log_data['round_name'] ?? 'Không rõ';

        if (empty($lead_phone) && empty($lead_email)) {
            echo json_encode(['success' => false, 'message' => 'Lead không có Số điện thoại hoặc Email để chặn']);
            break;
        }

        $conn->begin_transaction();
        try {
            // 2. Add contact to global_exclusion_contacts
            $settingsStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_exclusion_contacts' LIMIT 1");
            $currentContactsStr = '';
            if ($settingsStmt && $sRow = $settingsStmt->fetch_assoc()) {
                $currentContactsStr = $sRow['setting_value'] ?? '';
            }

            $currentContacts = array_map('trim', explode(',', strtolower($currentContactsStr)));
            // Remove empty values
            $currentContacts = array_filter($currentContacts);

            $newContactsAdded = [];
            if (!empty($lead_phone)) {
                $newContactsAdded[] = strtolower($lead_phone);
            }
            if (!empty($lead_email)) {
                $newContactsAdded[] = strtolower($lead_email);
            }

            foreach ($newContactsAdded as $c) {
                if (!in_array($c, $currentContacts)) {
                    $currentContacts[] = $c;
                }
            }

            $updatedContactsStr = implode(',', $currentContacts);

            $updSettings = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('global_exclusion_contacts', ?)");
            $updSettings->bind_param("s", $updatedContactsStr);
            $updSettings->execute();
            $updSettings->close();

            // Clear db memory cache for system settings if any
            if (isset($GLOBALS['system_settings_cache'])) {
                unset($GLOBALS['system_settings_cache']);
            }

            // 3. Update Lead status to blacklisted and append reason to note
            $newNote = trim(($log_data['lead_note'] ?? '') . "\n[Bị chặn bởi Admin lúc " . date('Y-m-d H:i:s') . ". Lý do: " . $reason . "]");
            $updLead = $conn->prepare("UPDATE leads SET status = 'blacklisted', note = ? WHERE id = ?");
            $updLead->bind_param("si", $newNote, $lead_id);
            $updLead->execute();
            $updLead->close();

            // 4. Update distribution_logs status
            $logMsgAdd = "\n[Chặn bởi Admin lúc " . date('Y-m-d H:i:s') . ". Lý do: " . $reason . ". Bù: " . ($compensate_sale ? "Có" : "Không") . "]";
            $updLog = $conn->prepare("UPDATE distribution_logs SET status = 'blacklisted', message = CONCAT(message, ?) WHERE id = ?");
            $updLog->bind_param("si", $logMsgAdd, $log_id);
            $updLog->execute();
            $updLog->close();

            // 5. Compensate Sale if requested
            if ($compensate_sale && $old_consultant_id && $round_id) {
                // Check if enrolled in round_consultants
                $chkEnroll = $conn->prepare("SELECT 1 FROM round_consultants WHERE round_id = ? AND consultant_id = ? LIMIT 1");
                $chkEnroll->bind_param("ii", $round_id, $old_consultant_id);
                $chkEnroll->execute();
                $hasEnroll = $chkEnroll->get_result()->num_rows > 0;
                $chkEnroll->close();

                if ($hasEnroll) {
                    $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                    $updComp->bind_param("ii", $round_id, $old_consultant_id);
                    $updComp->execute();
                    $updComp->close();
                } else {
                    $insComp = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn, compensation_count) VALUES (?, ?, 1, 1, 1)");
                    $insComp->bind_param("ii", $round_id, $old_consultant_id);
                    $insComp->execute();
                    $insComp->close();
                }
            }

            // 6. Log admin action
            logAdminAction($conn, $decodedUser['id'], 'BLOCK_LEAD_BLACKLIST', [
                'log_id' => $log_id,
                'lead_id' => $lead_id,
                'lead_name' => $lead_name,
                'phone' => $lead_phone,
                'email' => $lead_email,
                'old_consultant_id' => $old_consultant_id,
                'old_consultant_name' => $old_consultant_name,
                'round_name' => $round_name,
                'compensated' => $compensate_sale,
                'reason' => $reason
            ]);

            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // 7. Send Notifications out of transaction
        if ($compensate_sale && $old_consultant_id) {
            try {
                require_once __DIR__ . '/mailer.php';
                require_once __DIR__ . '/zalo_bot.php';

                $maskedPhone = '';
                if (!empty($lead_phone)) {
                    $trimmed = trim($lead_phone);
                    if (strlen($trimmed) <= 6) {
                        $maskedPhone = substr($trimmed, 0, 2) . str_repeat('*', strlen($trimmed) - 2);
                    } else {
                        $maskedPhone = substr($trimmed, 0, 3) . '****' . substr($trimmed, -3);
                    }
                }

                // Send Zalo Notification
                $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

                if (!empty($botToken) && !empty($old_consultant_zalo)) {
                    try {
                        $zaloMsg = "[ ĐỀN BÙ DATA - BLACKLIST ]\n\n"
                            . "Chào $old_consultant_name, Lead \"$lead_name\"" . (!empty($maskedPhone) ? " ($maskedPhone)" : "") . " của bạn đã bị Admin đưa vào Danh sách đen (Blacklist).\n\n"
                            . "Hệ thống đã tự động cộng đền bù cho bạn 1 lượt data ở vòng \"$round_name\".";
                        sendZaloMessage($botToken, $old_consultant_zalo, $zaloMsg);
                    } catch (Exception $zEx) {
                        error_log("Error sending block lead Zalo: " . $zEx->getMessage());
                    }
                }

                // Send Email Notification
                if (!empty($old_consultant_email)) {
                    try {
                        $emailSubj = "[Domation DATA] Thông báo đền bù do chặn Lead - $lead_name";
                        $emailBody = "<h3>Đền bù Data do chặn Blacklist</h3>
                                      <p>Chào $old_consultant_name,</p>
                                      <p>Lead <strong>$lead_name</strong>" . (!empty($maskedPhone) ? " ($maskedPhone)" : "") . " đã bị Admin đưa vào Danh sách đen (Blacklist).</p>
                                      <p>Hệ thống đã tự động cộng thêm 1 lượt đền bù cho bạn trong vòng phân bổ <strong>$round_name</strong>.</p>";
                        sendEmailNotification($old_consultant_email, $emailSubj, 'Thông báo đền bù Blacklist', $emailBody, '');
                    } catch (Exception $eEx) {
                        error_log("Error sending block lead email: " . $eEx->getMessage());
                    }
                }
            } catch (Exception $notifyEx) {
                error_log("General notification error in block_lead: " . $notifyEx->getMessage());
            }
        }

        echo json_encode(['success' => true]);
        break;

    case 'send_quick_zalo_message':
        $input = json_decode(file_get_contents('php://input'), true);
        $consultant_id = (int) ($input['consultant_id'] ?? 0);
        $account_id = (int) ($input['account_id'] ?? 0);
        $message = trim($input['message'] ?? '');

        if (empty($message)) {
            echo json_encode(['success' => false, 'message' => 'Nội dung tin nhắn không được để trống']);
            break;
        }

        $targetName = '';
        $targetEmail = '';
        $targetZaloChatId = '';
        $isAccount = false;

        if ($account_id > 0) {
            $stmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM accounts WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $account_id);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            if (!$user) {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy tài khoản quản trị']);
                break;
            }
            $targetName = $user['name'];
            $targetEmail = $user['email'];
            $targetZaloChatId = $user['zalo_chat_id'];
            $isAccount = true;
        } else if ($consultant_id > 0) {
            $stmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $consultant_id);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            if (!$user) {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy Tư vấn viên']);
                break;
            }
            $targetName = $user['name'];
            $targetEmail = $user['email'];
            $targetZaloChatId = $user['zalo_chat_id'];
        } else {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin người nhận']);
            break;
        }

        $sentZalo = false;
        $sentEmail = false;

        // 1. Send Zalo
        require_once __DIR__ . '/zalo_bot.php';
        $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
        $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

        if (!empty($botToken) && !empty($targetZaloChatId)) {
            $zaloMsg = "[ TIN NHẮN TỪ BAN QUẢN TRỊ ]\n\n"
                . "Chào {$targetName},\n\n"
                . $message;
            $sentZalo = sendZaloMessage($botToken, $targetZaloChatId, $zaloMsg);
        }

        // 2. Send Email
        if (!empty($targetEmail)) {
            require_once __DIR__ . '/mailer.php';
            sendQuickMessageEmailToSale($targetEmail, $targetName, $message);
            $sentEmail = true;
        }

        if ($sentZalo && $sentEmail) {
            echo json_encode(['success' => true, 'message' => 'Đã gửi tin nhắn thành công qua cả Zalo Bot và Email!']);
        } else if ($sentZalo) {
            echo json_encode(['success' => true, 'message' => 'Đã gửi tin nhắn thành công qua Zalo Bot!']);
        } else if ($sentEmail) {
            if (!empty($targetZaloChatId)) {
                echo json_encode(['success' => true, 'message' => 'Đã gửi qua Email thành công, nhưng gửi qua Zalo Bot thất bại (kiểm tra lại Token Zalo Bot hoặc kết nối).']);
            } else {
                echo json_encode(['success' => true, 'message' => 'Đã gửi qua Email thành công (Tài khoản chưa liên kết Zalo Bot nên không thể gửi qua Zalo).']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Gửi thất bại. Người nhận chưa cấu hình Email và chưa liên kết Zalo Bot.']);
        }
        break;

    case 'preview_routing':
        require_once __DIR__ . '/webhook_logic.php';

        $input = json_decode(file_get_contents('php://input'), true);
        $data = $input['data'] ?? [];
        $connectionId = isset($input['connection_id']) ? ($input['connection_id'] === 'all' || $input['connection_id'] === '' ? null : (int)$input['connection_id']) : null;
        $connectionType = $input['connection_type'] ?? 'manual';

        $phone = normalizePhone($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $name = trim($data['name'] ?? '');
        $source = trim($data['source'] ?? '');
        $type = trim($data['type'] ?? '');
        $note = trim($data['note'] ?? '');

        // Fetch connection settings if connectionId is provided
        $isSilent = 0;
        $syncSaleperson = 0;
        if ($connectionId > 0) {
            $cStmt = $conn->prepare("SELECT is_silent, sync_saleperson FROM sheet_connections WHERE id = ? LIMIT 1");
            if ($cStmt) {
                $cStmt->bind_param("i", $connectionId);
                $cStmt->execute();
                $cRes = $cStmt->get_result();
                if ($cRes->num_rows > 0) {
                    $cRow = $cRes->fetch_assoc();
                    $isSilent = (int)$cRow['is_silent'];
                    $syncSaleperson = (int)$cRow['sync_saleperson'];
                }
                $cStmt->close();
            }
        }

        // Check CRM duplicate
        $crmCheckResult = checkCRMInteraction($conn, $phone, $email);
        $dupCheckMonths = (int)get_system_setting($conn, 'duplicate_check_months');
        if ($dupCheckMonths <= 0) {
            $dupCheckMonths = 6;
        }

        if ($isSilent === 1) {
            if ($crmCheckResult['isDuplicate'] && !empty($crmCheckResult['assignedTo'])) {
                $assignedTo = $crmCheckResult['assignedTo'];
                $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                $stmtC->bind_param("i", $assignedTo);
                $stmtC->execute();
                $cRow = $stmtC->get_result()->fetch_assoc();
                $stmtC->close();
                $consultantName = $cRow ? $cRow['name'] : 'Không rõ';
                $consultantEmail = $cRow ? $cRow['email'] : '';
                
                echo json_encode([
                    'success' => true,
                    'is_duplicate' => true,
                    'is_silent' => true,
                    'consultant' => [
                        'consultant_id' => $assignedTo,
                        'name' => $consultantName,
                        'email' => $consultantEmail,
                        'round_name' => 'Đồng bộ ngầm (Silent Sync)',
                        'reason' => 'Khách trùng khớp thuộc Sale: ' . $consultantName . '. Sẽ chỉ lưu thông tin mới và gửi nhắc nhở.'
                    ],
                    'trace' => [
                        [
                            'description' => 'Kiểm tra trùng lặp CRM (Đồng bộ ngầm)',
                            'status' => 'matched',
                            'reason' => "Khách hàng trùng trong CRM thuộc Sale: $consultantName. Đồng bộ ngầm không định tuyến chia số."
                        ]
                    ]
                ]);
                exit();
            } else {
                echo json_encode([
                    'success' => true,
                    'is_duplicate' => false,
                    'is_silent' => true,
                    'consultant' => null,
                    'message' => 'Dòng dữ liệu mới hoàn toàn. Đồng bộ ngầm, không định tuyến chia số.',
                    'trace' => [
                        [
                            'description' => 'Kiểm tra trùng lặp CRM (Đồng bộ ngầm)',
                            'status' => 'skipped',
                            'reason' => 'Khách hàng mới hoàn toàn hoặc không có Sale sở hữu hợp lệ. Đồng bộ ngầm không định tuyến.'
                        ]
                    ]
                ]);
                exit();
            }
        }

        // Regular duplicate checking
        if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
            $assignedTo = $crmCheckResult['assignedTo'];
            $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
            $stmtC->bind_param("i", $assignedTo);
            $stmtC->execute();
            $cRow = $stmtC->get_result()->fetch_assoc();
            $stmtC->close();
            
            if ($cRow) {
                echo json_encode([
                    'success' => true,
                    'is_duplicate' => true,
                    'consultant' => [
                        'consultant_id' => $assignedTo,
                        'name' => $cRow['name'],
                        'email' => $cRow['email'],
                        'round_name' => 'Nhắc lại - trùng dưới ' . $dupCheckMonths . ' tháng',
                        'reason' => 'Khách cũ đăng ký lại trong hạn định ' . $dupCheckMonths . ' tháng. Chuyển thẳng cho Sale cũ: ' . $cRow['name'] . '.'
                    ],
                    'trace' => [
                        [
                            'description' => 'Kiểm tra trùng lặp CRM',
                            'status' => 'matched',
                            'reason' => 'Phát hiện số điện thoại/email trùng trong hệ thống. Tương tác cuối cách đây ' . number_format($crmCheckResult['monthsSinceLastInteraction'], 1) . ' tháng (< hạn định ' . $dupCheckMonths . ' tháng). Chuyển thẳng cho Sale cũ: ' . $cRow['name'] . '.'
                        ]
                    ]
                ]);
                exit();
            }
        }

        // Fetch all rules from routing_rules
        $rulesRes = $conn->query("SELECT rr.*, r.round_name FROM routing_rules rr LEFT JOIN distribution_rounds r ON rr.target_round_id = r.id ORDER BY rr.priority ASC");
        $rules = [];
        if ($rulesRes) {
            while ($rRow = $rulesRes->fetch_assoc()) {
                $rules[] = $rRow;
            }
        }

        $trace = [];
        $assignedRoundId = null;
        $matchedRule = null;
        $injectedFields = [];

        // Check if there was a duplicate, but the consultant is inactive or on leave, or if duplicate check threshold was exceeded
        if ($crmCheckResult['originalAssignedTo']) {
            $stmtC = $conn->prepare("SELECT name, status FROM consultants WHERE id = ?");
            $stmtC->bind_param("i", $crmCheckResult['originalAssignedTo']);
            $stmtC->execute();
            $cRow = $stmtC->get_result()->fetch_assoc();
            $stmtC->close();
            
            $saleName = $cRow ? $cRow['name'] : 'Không rõ';
            $saleStatus = $cRow ? $cRow['status'] : 'inactive';
            
            if ($saleStatus !== 'active') {
                $statusText = $saleStatus === 'leave' ? 'đang nghỉ phép' : 'không hoạt động';
                $trace[] = [
                    'rule_id' => 0,
                    'description' => 'Kiểm tra trùng lặp CRM',
                    'status' => 'skipped',
                    'reason' => "Phát hiện trùng với Sale cũ: $saleName nhưng Sale này $statusText. Tiến hành quét quy tắc để chia mới."
                ];
            } else if ($crmCheckResult['monthsSinceLastInteraction'] >= $dupCheckMonths) {
                $trace[] = [
                    'rule_id' => 0,
                    'description' => 'Kiểm tra trùng lặp CRM',
                    'status' => 'skipped',
                    'reason' => "Trùng khách cũ của Sale: $saleName nhưng tương tác cuối cách đây " . number_format($crmCheckResult['monthsSinceLastInteraction'], 1) . " tháng (>= hạn định " . $dupCheckMonths . " tháng). Tiến hành quét quy tắc để chia mới."
                ];
            }
        } else {
            $trace[] = [
                'rule_id' => 0,
                'description' => 'Kiểm tra trùng lặp CRM',
                'status' => 'skipped',
                'reason' => 'Không phát hiện số điện thoại hoặc email trùng lặp trong hệ thống.'
            ];
        }

        foreach ($rules as $index => $rule) {
            $ruleNum = $index + 1;
            $ruleDesc = "Quy tắc #$ruleNum: " . ($rule['round_name'] ?? 'Không rõ');
            
            // Check connection restriction
            if (!empty($rule['connection_id'])) {
                $ruleConnIds = array_map('trim', explode(',', (string)$rule['connection_id']));
                $isMatched = false;
                foreach ($ruleConnIds as $ruleConnIdStr) {
                    $ruleConnId = (int)$ruleConnIdStr;
                    if ($ruleConnId === -1 && $connectionType === 'sheets') { $isMatched = true; break; }
                    if ($ruleConnId === -2 && $connectionType === 'landing_page') { $isMatched = true; break; }
                    if ($ruleConnId === -3 && $connectionType === 'manual') { $isMatched = true; break; }
                    if ($ruleConnId > 0 && $ruleConnId == $connectionId) { $isMatched = true; break; }
                }
                
                if (!$isMatched) {
                    $trace[] = [
                        'rule_id' => $rule['id'],
                        'description' => $ruleDesc,
                        'status' => 'skipped',
                        'reason' => 'Không áp dụng cho nguồn kết nối hiện tại (' . htmlspecialchars($connectionType) . ').'
                    ];
                    continue;
                }
            }

            // Check conditions
            $isMatch = false;
            $conditionsDetail = [];
            
            if (!empty($rule['conditions_json'])) {
                $parsed = json_decode($rule['conditions_json'], true);
                if (is_array($parsed) && count($parsed) > 0) {
                    $branches = [];
                    if (isset($parsed[0]['col'])) {
                        $branches = [['conditions' => $parsed]];
                    } else if (isset($parsed[0][0]['col'])) {
                        foreach ($parsed as $b) {
                            $branches[] = ['conditions' => $b];
                        }
                    } else if (isset($parsed[0]['conditions'])) {
                        $branches = $parsed;
                    }

                    $logicalOp = strtoupper($rule['logical_operator'] ?? 'AND');
                    
                    foreach ($branches as $bIdx => $branchObj) {
                        $conds = $branchObj['conditions'] ?? [];
                        $branchMatch = ($logicalOp === 'AND'); 
                        if ($logicalOp === 'OR' && empty($conds)) $branchMatch = true;
                        
                        $branchCondsDetail = [];
                        foreach ($conds as $cond) {
                            $resVal = evaluateSingleCondition($data, $source, $type, $cond['col'], $cond['op'], $cond['val'], $connectionId);
                            $branchCondsDetail[] = [
                                'col' => $cond['col'],
                                'op' => $cond['op'],
                                'val' => $cond['val'],
                                'matched' => $resVal
                            ];
                            if ($logicalOp === 'AND') {
                                if (!$resVal) {
                                    $branchMatch = false;
                                }
                            } else { 
                                if ($resVal) {
                                    $branchMatch = true;
                                }
                            }
                        }
                        
                        if ($branchMatch) {
                            $isMatch = true;
                            if (isset($branchObj['inject']) && !empty($branchObj['inject']['enabled']) && !empty($branchObj['inject']['fields'])) {
                                foreach ($branchObj['inject']['fields'] as $f) {
                                    if (!empty($f['col'])) {
                                        $injectedFields[$f['col']] = $f['val'];
                                    }
                                }
                            }
                            $conditionsDetail = $branchCondsDetail;
                            break;
                        } else if (empty($conditionsDetail)) {
                            $conditionsDetail = $branchCondsDetail;
                        }
                    }
                }
            } else {
                $resVal = evaluateSingleCondition($data, $source, $type, $rule['condition_column'], $rule['condition_operator'], $rule['condition_value'], $connectionId);
                $isMatch = $resVal;
                $conditionsDetail[] = [
                    'col' => $rule['condition_column'],
                    'op' => $rule['condition_operator'],
                    'val' => $rule['condition_value'],
                    'matched' => $resVal
                ];
            }

            if ($isMatch) {
                $assignedRoundId = (int)$rule['target_round_id'];
                $matchedRule = $rule;
                $trace[] = [
                    'rule_id' => $rule['id'],
                    'description' => $ruleDesc,
                    'status' => 'matched',
                    'reason' => 'Khớp toàn bộ điều kiện quy tắc.',
                    'conditions' => $conditionsDetail
                ];
                break;
            } else {
                $trace[] = [
                    'rule_id' => $rule['id'],
                    'description' => $ruleDesc,
                    'status' => 'failed',
                    'reason' => 'Điều kiện kiểm tra không khớp.',
                    'conditions' => $conditionsDetail
                ];
            }
        }

        // Fallback checks
        $isFallback = false;
        $isFallbackAdmin = false;
        $fallbackAdminName = '';
        if (!$assignedRoundId) {
            $fbSettings = [];
            $fbRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('fallback_type', 'fallback_round_id', 'fallback_admin_id')");
            if ($fbRes) {
                while ($row = $fbRes->fetch_assoc()) {
                    $fbSettings[$row['setting_key']] = $row['setting_value'];
                }
            }
            $fbType = $fbSettings['fallback_type'] ?? 'round';
            if ($fbType === 'admin') {
                $fbAdminId = (int) ($fbSettings['fallback_admin_id'] ?? 0);
                if ($fbAdminId > 0) {
                    $admStmt = $conn->prepare("SELECT name FROM accounts WHERE id = ? AND role = 'admin' LIMIT 1");
                    $admStmt->bind_param("i", $fbAdminId);
                    $admStmt->execute();
                    $admRes = $admStmt->get_result();
                    if ($admRes->num_rows > 0) {
                        $fallbackAdminName = $admRes->fetch_assoc()['name'];
                        $isFallbackAdmin = true;
                    }
                }
            } else {
                $fbRoundId = (int) ($fbSettings['fallback_round_id'] ?? 0);
                if ($fbRoundId > 0) {
                    $assignedRoundId = $fbRoundId;
                    $isFallback = true;
                }
            }
        }

        $consultant = null;
        if ($assignedRoundId) {
            $simulated = simulateNextConsultantInRound($conn, $assignedRoundId);
            if ($simulated) {
                $consultant = [
                    'consultant_id' => $simulated['id'],
                    'name' => $simulated['name'],
                    'email' => $simulated['email'] ?? '',
                    'receive_ratio' => $simulated['receive_ratio'],
                    'data_per_turn' => $simulated['data_per_turn'],
                    'current_turn_remaining' => $simulated['current_turn_remaining'],
                    'skip_count' => $simulated['skip_count'] ?? 0,
                    'compensation_count' => $simulated['compensation_count'] ?? 0,
                    'is_compensation' => (intval($simulated['compensation_count'] ?? 0) > 0),
                    'is_mid_turn' => (intval($simulated['current_turn_remaining'] ?? 0) > 0)
                ];

                $stmtR = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                $stmtR->bind_param("i", $assignedRoundId);
                $stmtR->execute();
                $rRes = $stmtR->get_result();
                if ($rRes->num_rows > 0) {
                    $consultant['round_name'] = $rRes->fetch_assoc()['round_name'];
                } else {
                    $consultant['round_name'] = 'Không rõ';
                }
            }
        } else if ($isFallbackAdmin) {
            $consultant = [
                'consultant_id' => 0,
                'name' => $fallbackAdminName,
                'email' => 'Admin Fallback',
                'round_name' => 'Không có (Fallback về Admin)'
            ];
        }

        echo json_encode([
            'success' => true,
            'round_id' => $assignedRoundId,
            'consultant' => $consultant,
            'is_fallback' => $isFallback,
            'is_fallback_admin' => $isFallbackAdmin,
            'injected_fields' => $injectedFields,
            'trace' => $trace
        ]);
        break;

    case 'batch_check_duplicates':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $leads = $input['leads'] ?? [];
        
        $results = [];
        foreach ($leads as $lead) {
            $phone = normalizePhone($lead['phone'] ?? '');
            $email = trim($lead['email'] ?? '');
            $name = trim($lead['name'] ?? '');
            
            $crmCheck = checkCRMInteraction($conn, $phone, $email, true);
            
            $leadId = null;
            $assignedName = 'Không rõ';
            $lastInteractionDate = null;
            
            if ($crmCheck['originalAssignedTo']) {
                $where = [];
                $params = [];
                $types = '';
                if (!empty($phone)) {
                    $where[] = "l.phone = ?";
                    $params[] = $phone;
                    $types .= 's';
                }
                if (!empty($email)) {
                    $where[] = "l.email = ?";
                    $params[] = $email;
                    $types .= 's';
                }
                if (!empty($where)) {
                    $whereClause = implode(" OR ", $where);
                    $stmt = $conn->prepare("SELECT l.id, l.last_interaction_date, c.name as consultant_name FROM leads l LEFT JOIN consultants c ON l.assigned_to = c.id WHERE $whereClause ORDER BY l.last_interaction_date DESC LIMIT 1");
                    if ($stmt) {
                        $stmt->bind_param($types, ...$params);
                        $stmt->execute();
                        $res = $stmt->get_result();
                        if ($res->num_rows > 0) {
                            $row = $res->fetch_assoc();
                            $leadId = $row['id'];
                            $assignedName = $row['consultant_name'] ?? 'Không rõ';
                            $lastInteractionDate = $row['last_interaction_date'];
                        }
                        $stmt->close();
                    }
                }
            }
            
            $results[] = [
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'is_duplicate' => $crmCheck['isDuplicate'],
                'has_record' => !empty($crmCheck['originalAssignedTo']),
                'assigned_to' => $crmCheck['originalAssignedTo'],
                'consultant_name' => $assignedName,
                'consultant_status' => $crmCheck['consultantStatus'],
                'last_interaction_date' => $lastInteractionDate,
                'months_since_last_interaction' => $crmCheck['monthsSinceLastInteraction']
            ];
        }
        
        echo json_encode([
            'success' => true,
            'results' => $results
        ]);
        break;

    case 'batch_import_leads':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $leads = $input['leads'] ?? [];
        // Tat ca dữ liệu ánh xạ luon luon silent (khong dinh tuyen, khong bao sale)
        $isSilent = 1;
        $syncSaleperson = 0;
        
        $importedCount = 0;
        $duplicateCount = 0;
        $newCount = 0;
        
        try {
            foreach ($leads as $lead) {
                $phone = normalizePhone($lead['phone'] ?? '');
                $email = trim($lead['email'] ?? '');
                $name = trim($lead['name'] ?? '');
                $customDateRaw = trim($lead['date'] ?? '');
                $customDate = normalizeDate($customDateRaw);
                $salepersonVal = trim($lead['saleperson'] ?? '');
                
                if (empty($phone) && empty($email)) {
                    continue;
                }
                
                // Acquire lock for this lead
                $lockKey = '';
                if (!empty($phone)) {
                    $lockKey = 'webhook_lead_phone_' . $phone;
                } else if (!empty($email)) {
                    $lockKey = 'webhook_lead_email_' . md5($email);
                } else {
                    $lockKey = 'webhook_lead_empty_' . md5(json_encode($lead));
                }
                
                $lockAcquired = false;
                $lockStmt = $conn->prepare("SELECT GET_LOCK(?, 5) as get_lock");
                if ($lockStmt) {
                    $lockStmt->bind_param("s", $lockKey);
                    $lockStmt->execute();
                    $lockRes = $lockStmt->get_result()->fetch_assoc();
                    $lockStmt->close();
                    if ($lockRes && $lockRes['get_lock'] == 1) {
                        $lockAcquired = true;
                    }
                }
                
                if (!$lockAcquired) {
                    error_log("Excel Import: Skip locked lead (Phone: $phone, Email: $email)");
                    continue;
                }
                
                $conn->begin_transaction();
                try {
                    $fileConsultantId = null;
                    if (!empty($salepersonVal)) {
                        $fileConsultantId = findConsultantByEmailOrName($conn, $salepersonVal);
                    }
                    
                    $crmCheck = checkCRMInteraction($conn, $phone, $email, true);
                    
                    if ($isSilent == 1) {
                        if ($crmCheck['isDuplicate']) {
                            $ownerId = !empty($crmCheck['assignedTo']) ? $crmCheck['assignedTo'] : $fileConsultantId;
                            $leadId = updateLead($conn, $phone, $email, $ownerId, 'Excel Import', 'Excel', '', null, $customDate, $name);
                            $duplicateCount++;
                            logDistribution($conn, $leadId, $ownerId, null, 'silent', 'Chi dong bo check trung, khong dinh tuyen (Trung so).');
                        } else {
                            $ownerId = $fileConsultantId;
                            $leadId = insertLead($conn, [], $ownerId, $phone, $email, $name, 'Excel Import', 'Excel', '', null, $customDate);
                            $newCount++;
                            logDistribution($conn, $leadId, $ownerId, null, 'silent', 'Chi dong bo check trung, khong dinh tuyen (Moi).');
                        }
                    } else {
                        if ($crmCheck['isDuplicate']) {
                            $assignedTo = !empty($crmCheck['assignedTo']) ? $crmCheck['assignedTo'] : $fileConsultantId;
                            $leadId = updateLead($conn, $phone, $email, $assignedTo, 'Excel Import', 'Excel', '', null, $customDate, $name);
                            logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Trung so tu file Excel nhap vao.');
                            $duplicateCount++;
                            
                            if ($syncSaleperson == 1 && !empty($assignedTo)) {
                                $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
                                $stmtC->bind_param("i", $assignedTo);
                                $stmtC->execute();
                                $cRow = $stmtC->get_result()->fetch_assoc();
                                $stmtC->close();
                                if ($cRow && $cRow['status'] === 'active') {
                                    require_once __DIR__ . '/mailer.php';
                                    require_once __DIR__ . '/zalo_bot.php';
                                    sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, 'Trung so tu file Excel nhap vao', 'Excel Import', '', '', [], $leadId);
                                    sendLeadReminderZaloMessageToSale($assignedTo, $cRow['name'], $name, $phone, 'Trung so tu file Excel nhap vao', 'Excel Import', '', [], $leadId, $email, 'Excel');
                                }
                            }
                        } else {
                            $assignedToId = $fileConsultantId;
                            $isFromRules = false;
                            if (empty($assignedToId)) {
                                $rowData = $lead;
                                $rowData['phone'] = $phone;
                                $rowData['email'] = $email;
                                $rowData['name'] = $name;
                                $rulesResult = evaluateRules($conn, $rowData, 'Excel Import', 'Excel', null, 'sheets');
                                $assignedToId = $rulesResult['consultant_id'] ?? null;
                                $isFromRules = true;
                            }
                            
                            $leadId = insertLead($conn, [], $assignedToId, $phone, $email, $name, 'Excel Import', 'Excel', '', null, $customDate);
                            $newCount++;
                            
                            if ($assignedToId) {
                                $roundId = ($isFromRules && isset($rulesResult['round_id'])) ? $rulesResult['round_id'] : null;
                                $logMsg = $isFromRules ? 'Phan chia tu dong tu file Excel.' : 'Phan chia cho Sale tu file Excel.';
                                logDistribution($conn, $leadId, $assignedToId, $roundId, 'success', $logMsg);
                                
                                $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                                $stmtC->bind_param("i", $assignedToId);
                                $stmtC->execute();
                                $cRow = $stmtC->get_result()->fetch_assoc();
                                $stmtC->close();
                                if ($cRow) {
                                    require_once __DIR__ . '/mailer.php';
                                    require_once __DIR__ . '/zalo_bot.php';
                                    sendLeadAssignedEmailToSale($cRow['email'], $cRow['name'], $name, $phone, 'Lead moi tu file Excel', 'Excel Import', '', '', $leadId, $assignedToId, $roundId ?? 0);
                                    sendLeadAssignedZaloMessageToSale($assignedToId, $cRow['name'], $name, $phone, 'Lead moi tu file Excel', 'Excel Import', '', $leadId, $roundId ?? 0, $email, 'Excel');
                                }
                            } else {
                                logDistribution($conn, $leadId, null, null, 'no_consultant', 'Khong co Sale nhan tu file Excel.');
                            }
                        }
                    }
                    $conn->commit();
                    $importedCount++;
                } catch (Exception $e) {
                    $conn->rollback();
                    error_log("Excel Import error on lead (Phone: $phone): " . $e->getMessage());
                } finally {
                    $relStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
                    if ($relStmt) {
                        $relStmt->bind_param("s", $lockKey);
                        $relStmt->execute();
                        $relStmt->close();
                    }
                }
            }
            echo json_encode([
                'success' => true,
                'message' => "Da nhap thanh cong $importedCount leads ($newCount moi, $duplicateCount trung).",
                'imported_count' => $importedCount,
                'new_count' => $newCount,
                'duplicate_count' => $duplicateCount
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Loi import: ' . $e->getMessage()]);
        }
        break;

    case 'check_sheet_duplicates':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $connectionId = isset($input['connection_id']) ? (int)$input['connection_id'] : 0;
        
        if ($connectionId <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID kết nối không hợp lệ.']);
            break;
        }
        
        // Fetch connection info
        $connStmt = $conn->prepare("SELECT sheet_name, spreadsheet_id FROM sheet_connections WHERE id = ? AND is_active = 1");
        $connStmt->bind_param("i", $connectionId);
        $connStmt->execute();
        $connRes = $connStmt->get_result();
        if ($connRes->num_rows === 0) {
            $connStmt->close();
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy kết nối hoặc kết nối chưa kích hoạt.']);
            break;
        }
        $connItem = $connRes->fetch_assoc();
        $connStmt->close();
        
        // Fetch mappings
        $mapStmt = $conn->prepare("SELECT sheet_column, system_field, custom_label FROM field_mappings WHERE connection_id = ?");
        $mapStmt->bind_param("i", $connectionId);
        $mapStmt->execute();
        $mappingsResult = $mapStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $mapStmt->close();
        
        $mappings = [];
        foreach ($mappingsResult as $mRow) {
            $sysField = $mRow['system_field'];
            if (!isset($mappings[$sysField])) {
                $mappings[$sysField] = [];
            }
            $mappings[$sysField][] = [
                'sheet_column' => $mRow['sheet_column'],
                'custom_label' => $mRow['custom_label']
            ];
        }
        
        $extractMappedValuesLocal = function($mappingsArray, $systemField, $data) {
            if (!isset($mappingsArray[$systemField])) return '';
            $values = [];
            foreach ($mappingsArray[$systemField] as $mapItem) {
                $colName = $mapItem['sheet_column'];
                $customLabel = $mapItem['custom_label'];
                if (isset($data[$colName]) && $data[$colName] !== '') {
                    $label = !empty($customLabel) ? $customLabel : $colName;
                    $values[] = $label . ': ' . $data[$colName];
                }
            }
            // For unique/specific system fields, return the raw value directly of the first matched non-empty column to keep it clean and prevent corruption.
            if (in_array($systemField, ['phone', 'email', 'name', 'source', 'type', 'assigned_to', 'saleperson'])) {
                foreach ($mappingsArray[$systemField] as $mapItem) {
                    $colName = $mapItem['sheet_column'];
                    if (isset($data[$colName]) && $data[$colName] !== '') {
                        return $data[$colName];
                    }
                }
                return '';
            }
            return implode("\n", $values);
        };
        
        // Fetch CSV from Google Sheets
        $csvUrl = "https://docs.google.com/spreadsheets/d/" . trim($connItem['spreadsheet_id']) . "/gviz/tq?tqx=out:csv";
        if (!empty($connItem['sheet_name'])) {
            $csvUrl .= "&sheet=" . urlencode($connItem['sheet_name']);
        }
        
        $ch = curl_init($csvUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200 || empty($csvData)) {
            echo json_encode(['success' => false, 'message' => "Không thể tải file từ Google Sheet (HTTP $httpCode). Vui lòng cấu hình chia sẻ link."]);
            break;
        }
        
        // Parse CSV data
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $csvData);
        rewind($stream);
        
        $headers = [];
        $rowCount = 0;
        $leads = [];
        $maxPreviewRows = 200;
        
        while (($row = fgetcsv($stream)) !== FALSE) {
            $row = array_map(function($val) { return trim($val ?? '', "\" "); }, $row);
            if ($rowCount === 0) {
                $headers = $row;
                $rowCount++;
                continue;
            }
            $rowCount++;
            if ($rowCount > $maxPreviewRows + 1) {
                break;
            }
            if (empty(array_filter($row))) {
                continue;
            }
            $rowData = [];
            foreach ($headers as $colIdx => $colName) {
                $rowData[$colName] = $row[$colIdx] ?? '';
            }
            
            $phone = normalizePhone($extractMappedValuesLocal($mappings, 'phone', $rowData));
            $email = $extractMappedValuesLocal($mappings, 'email', $rowData);
            $name = $extractMappedValuesLocal($mappings, 'name', $rowData);
            
            $leads[] = [
                'phone' => $phone,
                'email' => $email,
                'name' => $name
            ];
        }
        fclose($stream);
        
        // Now run duplication checks
        $results = [];
        foreach ($leads as $lead) {
            $phone = normalizePhone($lead['phone'] ?? '');
            $email = trim($lead['email'] ?? '');
            $name = trim($lead['name'] ?? '');
            
            $crmCheck = checkCRMInteraction($conn, $phone, $email, true);
            $leadId = null;
            $assignedName = 'Không rõ';
            $lastInteractionDate = null;
            
            if ($crmCheck['originalAssignedTo']) {
                $where = [];
                $params = [];
                $types = '';
                if (!empty($phone)) {
                    $where[] = "l.phone = ?";
                    $params[] = $phone;
                    $types .= 's';
                }
                if (!empty($email)) {
                    $where[] = "l.email = ?";
                    $params[] = $email;
                    $types .= 's';
                }
                if (!empty($where)) {
                    $whereClause = implode(" OR ", $where);
                    $stmt = $conn->prepare("SELECT l.id, l.last_interaction_date, c.name as consultant_name FROM leads l LEFT JOIN consultants c ON l.assigned_to = c.id WHERE $whereClause ORDER BY l.last_interaction_date DESC LIMIT 1");
                    if ($stmt) {
                        $stmt->bind_param($types, ...$params);
                        $stmt->execute();
                        $res = $stmt->get_result();
                        if ($res->num_rows > 0) {
                            $row = $res->fetch_assoc();
                            $leadId = $row['id'];
                            $assignedName = $row['consultant_name'] ?? 'Không rõ';
                            $lastInteractionDate = $row['last_interaction_date'];
                        }
                        $stmt->close();
                    }
                }
            }
            
            $results[] = [
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'is_duplicate' => $crmCheck['isDuplicate'],
                'has_record' => !empty($crmCheck['originalAssignedTo']),
                'assigned_to' => $crmCheck['originalAssignedTo'],
                'consultant_name' => $assignedName,
                'consultant_status' => $crmCheck['consultantStatus'],
                'last_interaction_date' => $lastInteractionDate,
                'months_since_last_interaction' => $crmCheck['monthsSinceLastInteraction']
            ];
        }
        
        echo json_encode([
            'success' => true,
            'results' => $results
        ]);
        break;

    case 'manual_insert_lead':
        require_once __DIR__ . '/webhook_logic.php';

        $input = json_decode(file_get_contents('php://input'), true);
        $data = $input['data'] ?? [];
        $override_round_id = $input['override_round_id'] ?? null;
        $override_consultant_id = $input['override_consultant_id'] ?? null;
        $compensate_skipped = filter_var($input['compensate_skipped'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $skipped_consultant_id = $input['skipped_consultant_id'] ?? null;

        $phone = normalizePhone($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $name = trim($data['name'] ?? '');
        $source = trim($data['source'] ?? '');
        $type = trim($data['type'] ?? '');
        $note = trim($data['note'] ?? '');

        if (empty($phone) && empty($email)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập SĐT hoặc Email']);
            break;
        }

        $assignedRoundId = $override_round_id;
        $inject = [];
        $isFallback = false;
        $isFallbackAdmin = false;
        $fallbackAdminData = null;
        $fallbackCcEmails = '';

        if (!$assignedRoundId) {
            $ruleResult = evaluateRules($conn, $data, $source, $type, null, 'manual');
            if (is_array($ruleResult)) {
                $assignedRoundId = $ruleResult['target_round_id'];
                $inject = $ruleResult['inject'] ?? [];
            } else {
                $assignedRoundId = $ruleResult;
            }
        }

        if (!$assignedRoundId) {
            $fbSettings = [];
            $fbRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('fallback_type', 'fallback_round_id', 'fallback_admin_id', 'fallback_cc_email')");
            if ($fbRes) {
                while ($row = $fbRes->fetch_assoc()) {
                    $fbSettings[$row['setting_key']] = $row['setting_value'];
                }
            }

            $fbType = $fbSettings['fallback_type'] ?? 'round';
            $fbCc = $fbSettings['fallback_cc_email'] ?? '';

            if ($fbType === 'admin') {
                $fbAdminId = (int) ($fbSettings['fallback_admin_id'] ?? 0);
                if ($fbAdminId > 0) {
                    $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND role = 'admin' LIMIT 1");
                    $admStmt->bind_param("i", $fbAdminId);
                    $admStmt->execute();
                    $admRes = $admStmt->get_result();
                    if ($admRes->num_rows > 0) {
                        $fallbackAdminData = $admRes->fetch_assoc();
                        $isFallbackAdmin = true;
                        $fallbackCcEmails = $fbCc;
                    }
                }
            } else {
                $fbRoundId = (int) ($fbSettings['fallback_round_id'] ?? 0);
                if ($fbRoundId > 0) {
                    $assignedRoundId = $fbRoundId;
                    $isFallback = true;
                }
            }
        }

        // If rule matched and there are inject fields, apply them!
        if (!empty($inject)) {
            $standardFields = ['source', 'type', 'note', 'name', 'phone', 'email'];
            foreach ($inject as $k => $v) {
                if (in_array($k, $standardFields)) {
                    if ($k === 'source')
                        $source = $v;
                    if ($k === 'type')
                        $type = $v;
                    if ($k === 'note')
                        $note = $v;
                    if ($k === 'name')
                        $name = $v;
                    if ($k === 'phone')
                        $phone = normalizePhone($v);
                    if ($k === 'email')
                        $email = trim($v);
                } else {
                    $note .= "\n[$k]: $v";
                }
            }
        }

        $lockAcquired = false;
        $lockKey = '';
        if (!empty($phone)) {
            $lockKey = 'webhook_lead_phone_' . $phone;
        } else if (!empty($email)) {
            $lockKey = 'webhook_lead_email_' . md5($email);
        } else {
            $lockKey = 'webhook_lead_empty_' . md5(json_encode($data));
        }

        // Get lock using prepared statement with 5s timeout
        $lockStmt = $conn->prepare("SELECT GET_LOCK(?, 5) as get_lock");
        if ($lockStmt) {
            $lockStmt->bind_param("s", $lockKey);
            $lockStmt->execute();
            $lockRes = $lockStmt->get_result()->fetch_assoc();
            $lockStmt->close();
            if ($lockRes && $lockRes['get_lock'] == 1) {
                $lockAcquired = true;
            }
        }

        if (!$lockAcquired) {
            echo json_encode(['success' => false, 'message' => 'Hệ thống đang bận xử lý dữ liệu này. Vui lòng thử lại sau.']);
            break;
        }

        try {
            // Check CRM duplicate (both phone & email)
            $crmCheckResult = checkCRMInteraction($conn, $phone, $email);
            $dupCheckMonths = (int)get_system_setting($conn, 'duplicate_check_months');
            if ($dupCheckMonths <= 0) {
                $dupCheckMonths = 6;
            }

            if (!$override_consultant_id && $crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
                $assignedTo = $crmCheckResult['assignedTo'];
                $conn->begin_transaction();
                
                // Update last interaction
                $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note, null, null, $name);
                logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng (Nhập thủ công).');
                $conn->commit();

                $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
                $stmtC->bind_param("i", $assignedTo);
                $stmtC->execute();
                $cRow = $stmtC->get_result()->fetch_assoc();
                $stmtC->close();
                
                if ($cRow && $cRow['status'] === 'active') {
                    try {
                        require_once __DIR__ . '/mailer.php';
                        require_once __DIR__ . '/zalo_bot.php';
                        
                        $timeline = getLeadHistoryTimeline($conn, $leadId);
                        try {
                            sendLeadReminderEmailToSale(
                                $cRow['email'],
                                $cRow['name'],
                                $name,
                                $phone,
                                $note,
                                $source,
                                '',
                                '',
                                $timeline,
                                $leadId
                            );
                        } catch (Exception $eEx) {
                            error_log("Error sending duplicate lead reminder email: " . $eEx->getMessage());
                        }

                        try {
                            sendLeadReminderZaloMessageToSale(
                                $assignedTo,
                                $cRow['name'],
                                $name,
                                $phone,
                                $note,
                                $source,
                                '',
                                $timeline,
                                $leadId,
                                $email,
                                $type
                            );
                        } catch (Exception $zEx) {
                            error_log("Error sending duplicate lead reminder Zalo: " . $zEx->getMessage());
                        }
                    } catch (Exception $notifyEx) {
                        error_log("Error preparing reminder notifications: " . $notifyEx->getMessage());
                    }
                }
                
                echo json_encode(['success' => true, 'message' => 'Trùng khách cũ trong vòng ' . $dupCheckMonths . ' tháng. Đã gán lại cho Sale cũ: ' . ($cRow ? $cRow['name'] : 'Không rõ')]);
            } else if (!$assignedRoundId && !$isFallbackAdmin) {
                // Cannot assign
                $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);
                echo json_encode(['success' => true, 'message' => 'Data đã được thêm nhưng không rơi vào vòng nào.']);
            } else {
                $conn->begin_transaction();
                
                $consultantId = $override_consultant_id;
                $isComp = false;

                if (!$consultantId && $assignedRoundId) {
                    // Compute it naturally INSIDE transaction block for row-level locking consistency
                    $assignResult = getNextConsultantInRound($conn, $assignedRoundId);
                    if ($assignResult) {
                        $consultantId = $assignResult['id'];
                        $isComp = $assignResult['is_compensation'];
                    }
                }

                if ($override_consultant_id && $assignedRoundId) {
                    // If overridden, check if we need to compensate the skipped consultant
                    if ($compensate_skipped && $skipped_consultant_id) {
                        $stmtComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                        $stmtComp->bind_param("ii", $assignedRoundId, $skipped_consultant_id);
                        $stmtComp->execute();
                        $stmtComp->close();
                    }
                }

                if ($isFallbackAdmin && $fallbackAdminData) {
                    // Insert unassigned in leads (since fallback admin is in accounts, not consultants)
                    $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);

                    logDistribution($conn, $leadId, null, null, 'assigned', 'No matching rule. Routed directly to fallback Admin: ' . $fallbackAdminData['name']);

                    $conn->commit();

                    try {
                        require_once __DIR__ . '/mailer.php';
                        require_once __DIR__ . '/zalo_bot.php';

                        $fName = trim($name) !== '' ? $name : 'Khách hàng ẩn danh';
                        try {
                            sendLeadAssignedEmailToSale(
                                $fallbackAdminData['email'],
                                $fallbackAdminData['name'],
                                $fName,
                                $phone ?: '',
                                $note ?: '',
                                $source ?: '',
                                $fallbackCcEmails,
                                'Fallback Admin',
                                $leadId,
                                0,
                                0
                            );
                        } catch (Exception $eEx) {
                            error_log("Error sending fallback admin email: " . $eEx->getMessage());
                        }

                        if (!empty($fallbackAdminData['zalo_chat_id'])) {
                            try {
                                sendLeadAssignedZaloMessageToAdmin(
                                    $fallbackAdminData['zalo_chat_id'],
                                    $fallbackAdminData['name'],
                                    $fName,
                                    $phone ?: '',
                                    $note ?: '',
                                    $source ?: '',
                                    $leadId,
                                    $email,
                                    $type
                                );
                            } catch (Exception $zEx) {
                                error_log("Error sending fallback admin Zalo: " . $zEx->getMessage());
                            }
                        }
                    } catch (Exception $notifyEx) {
                        error_log("Error preparing fallback notifications: " . $notifyEx->getMessage());
                    }

                    echo json_encode(['success' => true, 'message' => 'Data đã được chuyển thẳng cho Admin Fallback thành công.']);

                } else if ($consultantId) {
                    $status = $isComp ? 'compensation' : 'assigned';
                    
                    // Check working hours
                    $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
                    $whStmt->bind_param("i", $consultantId);
                    $whStmt->execute();
                    $whRes = $whStmt->get_result();
                    $isOutsideWorkHours = false;
                    $whStart = '00:00';
                    $whEnd = '23:59';
                    if ($whRes && $whRow = $whRes->fetch_assoc()) {
                        $whStart = $whRow['work_start_time'] ?? '00:00';
                        $whEnd = $whRow['work_end_time'] ?? '23:59';
                        $workSchedule = $whRow['work_schedule'] ?? null;
                        $currentTime = date('H:i');
                        if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                            $status = 'pending_work_hours';
                            $isOutsideWorkHours = true;
                        }
                    }
                    $whStmt->close();

                    $leadId = insertLead($conn, [], $consultantId, $phone, $email, $name, $source, $type, $note);

                    $stmtRound = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                    $stmtRound->bind_param("i", $assignedRoundId);
                    $stmtRound->execute();
                    $roundName = $stmtRound->get_result()->fetch_assoc()['round_name'] ?? 'Không rõ';
                    $stmtRound->close();

                    // Log distribution
                    $logMsg = $isFallback ? "Phân bổ qua Vòng mặc định (Fallback)" : "Nhập liệu thủ công từ Admin";
                    if ($isOutsideWorkHours) {
                        $logMsg .= ' (Delayed: outside working hours ' . $whStart . '-' . $whEnd . ')';
                    }
                    logDistribution($conn, $leadId, $consultantId, $assignedRoundId, $status, $logMsg);

                    $conn->commit();

                    // Fire notification using Mailer and Zalo ONLY if within working hours
                    if (!$isOutsideWorkHours) {
                        try {
                            require_once __DIR__ . '/mailer.php';
                            require_once __DIR__ . '/zalo_bot.php';

                            $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                            $stmtC->bind_param("i", $consultantId);
                            $stmtC->execute();
                            $cRes = $stmtC->get_result();
                            if ($cRes->num_rows > 0) {
                                $c = $cRes->fetch_assoc();
                                $ccEmails = '';
                                $stmtQ = $conn->prepare("SELECT cc_emails FROM distribution_rounds WHERE id = ?");
                                $stmtQ->bind_param("i", $assignedRoundId);
                                $stmtQ->execute();
                                $qRound = $stmtQ->get_result();
                                if ($qRound && $qRound->num_rows > 0) {
                                    $ccEmails = $qRound->fetch_assoc()['cc_emails'] ?? '';
                                }
                                $stmtQ->close();

                                $fName = trim($name) !== '' ? $name : 'Khách hàng ẩn danh';

                                try {
                                    sendLeadAssignedEmailToSale(
                                        $c['email'],
                                        $c['name'],
                                        $fName,
                                        $phone ?: '',
                                        $note ?: '',
                                        $source ?: '',
                                        $ccEmails,
                                        $roundName,
                                        $leadId,
                                        $consultantId,
                                        $assignedRoundId
                                    );
                                } catch (Exception $eEx) {
                                    error_log("Error sending manual insert assignment email: " . $eEx->getMessage());
                                }

                                try {
                                    sendLeadAssignedZaloMessageToSale(
                                        $consultantId,
                                        $c['name'],
                                        $fName,
                                        $phone ?: '',
                                        $note ?: '',
                                        $source ?: '',
                                        $roundName,
                                        $leadId,
                                        $assignedRoundId,
                                        $email,
                                        $type
                                    );
                                } catch (Exception $zEx) {
                                    error_log("Error sending manual insert assignment Zalo: " . $zEx->getMessage());
                                }
                            }
                            $stmtC->close();
                        } catch (Exception $notifyEx) {
                            error_log("Error preparing manual assignment notifications: " . $notifyEx->getMessage());
                        }
                    }

                    echo json_encode(['success' => true, 'message' => $isOutsideWorkHours ? 'Data đã gán cho Sale ngoài giờ làm việc (Hoãn thông báo).' : 'Data đã được giao thành công.']);
                } else {
                    // Insert unassigned
                    $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);
                    $conn->commit();
                    echo json_encode(['success' => true, 'message' => 'Data được lưu nhưng không có TVV nào nhận.']);
                }
            }
        } catch (Exception $e) {
            if ($conn->in_transaction()) {
                $conn->rollback();
            }
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        } finally {
            if ($lockAcquired) {
                $relStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
                if ($relStmt) {
                    $relStmt->bind_param("s", $lockKey);
                    $relStmt->execute();
                    $relStmt->close();
                }
            }
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
}

// 1. Flush response to client (Non-blocking for pseudo-cron)
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    // Fallback for Apache/mod_php or others
    ignore_user_abort(true);
    ob_end_flush();
    if (ob_get_level() > 0)
        ob_flush();
    flush();
}

// 2. Pseudo-cron: Kiểm tra báo cáo hàng ngày
require_once __DIR__ . '/cron_daily_report.php';
runDailyReportCron($conn);

$conn->close();
