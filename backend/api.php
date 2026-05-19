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

function getSafeErrorMsg($e) {
    if ($e instanceof mysqli_sql_exception) {
        error_log("DB Error: " . $e->getMessage());
        return "Lỗi cơ sở dữ liệu hệ thống. Vui lòng thử lại sau.";
    }
    return $e->getMessage();
}

function create_jwt($payload, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(json_encode($payload)));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

function verify_jwt($jwt, $secret) {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) return false;
    list($header, $payload, $signature) = $parts;
    $validSignature = hash_hmac('sha256', $header . "." . $payload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($validSignature));
    if (hash_equals($base64UrlSignature, $signature)) {
        $decoded = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);
        if (isset($decoded['exp']) && $decoded['exp'] < time()) return false;
        return $decoded;
    }
    return false;
}

function getBearerToken() {
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

// Require authentication for all endpoints except login and test_email
// Public endpoints (no auth required)
$publicActions = ['login', 'test_email', 'submit_report', 'get_report_context'];

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
    
    // Check Admin roles for sensitive endpoints
    $adminOnlyActions = [
        'get_accounts', 'add_account', 'edit_account', 'delete_account',
        'save_settings', 'get_settings',
        'add_consultant', 'edit_consultant', 'delete_consultant',
        'add_round', 'edit_round', 'delete_round',
        'add_rule', 'edit_rule', 'delete_rule', 'reorder_rules',
        'add_connection', 'edit_connection', 'delete_connection', 'toggle_connection', 'toggle_require_both',
        'add_mapping', 'edit_mapping', 'delete_mapping',
        'approve_report', 'reject_report', 'get_reports',
        'reassign_lead', 'force_sync',
        'get_ticket_settings', 'save_ticket_settings' // Ticket notification config
    ];
    if (in_array($action, $adminOnlyActions) && $decodedUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Require Admin privileges']);
        exit();
    }
} else {
    $decodedUser = null; // Public actions have no user context
}

switch ($action) {
    case 'login':
        $input = json_decode(file_get_contents('php://input'), true);
        // FEATURE: Đăng nhập bằng Email thay vì username
        // Backward compatible: Super Admin (id=1) vẫn có thể dùng username nếu chưa có email
        $loginField = trim($input['email'] ?? $input['username'] ?? '');
        $password   = $input['password'] ?? '';

        if (empty($loginField) || empty($password)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập email và mật khẩu']);
            break;
        }

        // Tìm theo email trước, fallback sang username cho super admin
        $stmt = $conn->prepare("SELECT * FROM accounts WHERE email = ? OR (id = 1 AND username = ?) LIMIT 1");
        $stmt->bind_param("ss", $loginField, $loginField);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows > 0) {
            $user = $res->fetch_assoc();
            if (password_verify($password, $user['password_hash'])) {
                $payload = [
                    'id'       => $user['id'],
                    'username' => $user['username'],
                    'email'    => $user['email'] ?? '',
                    'role'     => $user['role'],
                    'exp'      => time() + 86400
                ];
                $token = create_jwt($payload, $JWT_SECRET);
                echo json_encode([
                    'success' => true,
                    'token'   => $token,
                    'user'    => [
                        'username' => $user['username'],
                        'email'    => $user['email'] ?? '',
                        'role'     => $user['role'],
                        'name'     => $user['name']
                    ]
                ]);
                exit;
            }
        }
        echo json_encode(['success' => false, 'message' => 'Email hoặc mật khẩu không chính xác']);
        break;
    case 'get_stats':
        $todayStr = date('Y-m-d');
        $stmt = $conn->prepare("SELECT 
            COUNT(*) as total,
            SUM(IF(status='assigned',1,0)) as assigned,
            SUM(IF(status='duplicate',1,0)) as duplicates
        FROM distribution_logs WHERE received_at >= ? AND received_at <= ?");
        $todayStart = $todayStr . ' 00:00:00';
        $todayEnd   = $todayStr . ' 23:59:59';
        $stmt->bind_param("ss", $todayStart, $todayEnd);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        echo json_encode([
            'success' => true,
            'data' => [
                'total_today' => (int)$row['total'],
                'assigned'    => (int)$row['assigned'],
                'duplicates'  => (int)$row['duplicates']
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
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2}) đến (\d{4}-\d{2}-\d{2})$/', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "dl.received_at >= '$start 00:00:00' AND dl.received_at <= '$end 23:59:59'";
        }

        // BUG-04 fix: get total count first so UI can warn if truncated
        $countRes = $conn->query("SELECT COUNT(*) as cnt FROM distribution_logs dl WHERE $dateCondition");
        $totalCount = (int)($countRes->fetch_assoc()['cnt'] ?? 0);

        $LIMIT = 500;
        if (isset($_GET['limit']) && $_GET['limit'] === 'all' && isset($decodedUser) && $decodedUser['role'] === 'admin') {
            $LIMIT = 50000; // Chỉ Admin được phép dump toàn bộ
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
            WHERE $dateCondition
            ORDER BY dl.received_at DESC 
            LIMIT $LIMIT
        ");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data, 'total_count' => $totalCount, 'limit' => $LIMIT]);
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
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2}) đ?ế?n (\d{4}-\d{2}-\d{2})$/', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "dl.received_at >= '$start 00:00:00' AND dl.received_at <= '$end 23:59:59'";
        }

        // Add filters for export
        $statusFilter = $_GET['status'] ?? 'all';
        $consultantFilter = $_GET['consultant'] ?? 'all';
        $searchFilter = trim($_GET['search'] ?? '');

        $sqlFilters = "";
        if ($statusFilter !== 'all') {
            $sqlFilters .= " AND dl.status = '" . $conn->real_escape_string($statusFilter) . "'";
        }
        if ($consultantFilter !== 'all') {
            $sqlFilters .= " AND c.name = '" . $conn->real_escape_string($consultantFilter) . "'";
        }
        if ($searchFilter !== '') {
            $s = $conn->real_escape_string($searchFilter);
            $sqlFilters .= " AND (l.name LIKE '%$s%' OR l.phone LIKE '%$s%' OR l.email LIKE '%$s%')";
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
        ");

        if ($res) {
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
            }
        }
        fclose($output);
        exit(); // Kết thúc script ngay lập tức để không lọt JSON rác
        break;

    case 'get_consultants':
        $res = $conn->query("SELECT * FROM consultants ORDER BY created_at DESC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_consultant':
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
        if ($dupChk->get_result()->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Email này đã tồn tại trong hệ thống']);
            break;
        }
        $stmt = $conn->prepare("INSERT INTO consultants (name, email, status, zalo_chat_id) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $name, $email, $status, $zalo_chat_id);
        $stmt->execute();
        $newId = $conn->insert_id;

        // Gửi Email Welcome kèm link Zalo Bot
        require_once 'mailer.php';
        $settingStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_link'");
        $botLink = "https://zalo.me/1185588456243371597"; // Default
        if ($settingStmt && $settingStmt->num_rows > 0) {
            $row = $settingStmt->fetch_assoc();
            if (!empty($row['setting_value'])) $botLink = $row['setting_value'];
        }
        sendWelcomeEmailToSale($newId, $email, $name, $botLink);

        echo json_encode(['success' => true, 'id' => $conn->insert_id]);
        break;

    case 'edit_consultant':
        $input = json_decode(file_get_contents('php://input'), true);
        $id     = (int)($input['id'] ?? 0);
        $name   = trim($input['name'] ?? '');
        $email  = trim($input['email'] ?? '');
        $status = $input['status'] ?? 'active';
        $leave_start = !empty($input['leave_start']) ? $input['leave_start'] : null;
        $leave_end   = !empty($input['leave_end'])   ? $input['leave_end']   : null;
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
        if ($dupChk2->get_result()->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Email này đã tồn tại trong hệ thống']);
            break;
        }
        $stmt = $conn->prepare("UPDATE consultants SET name=?, email=?, status=?, leave_start=?, leave_end=?, zalo_chat_id=? WHERE id=?");
        $stmt->bind_param("ssssssi", $name, $email, $status, $leave_start, $leave_end, $zalo_chat_id, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'delete_consultant':
        $conn->begin_transaction();
        try {
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) throw new Exception('ID không hợp lệ');
            
            // Check if consultant has any assigned leads in distribution_logs
            $checkLog = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ?");
            $checkLog->bind_param("i", $id);
            $checkLog->execute();
            if ((int)$checkLog->get_result()->fetch_assoc()['cnt'] > 0) {
                throw new Exception("TVV này đã nhận Data, không thể xóa để bảo toàn thống kê. Vui lòng chọn 'Ngưng hoạt động'.");
            }
            
            $stmtD1 = $conn->prepare("DELETE FROM round_consultants WHERE consultant_id = ?");
            $stmtD1->bind_param("i", $id); $stmtD1->execute();
            $stmtD2 = $conn->prepare("DELETE FROM data_reports WHERE consultant_id = ?");
            $stmtD2->bind_param("i", $id); $stmtD2->execute();
            $stmtD3 = $conn->prepare("DELETE FROM consultants WHERE id = ?");
            $stmtD3->bind_param("i", $id); $stmtD3->execute();
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
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
        $data = [];
        $roundIds = [];
        while($row = $res->fetch_assoc()) {
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
                $data[$rId]['ratios'][$cId] = (int)$rr['receive_ratio'];
                $data[$rId]['data_per_turns'][$cId] = (int)($rr['data_per_turn'] ?? 1);
                $data[$rId]['compensations'][$cId] = (int)$rr['compensation_count'];
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
            
            $ratios    = $input['ratios'] ?? [];
            $per_turns = $input['data_per_turns'] ?? [];
            
            if (!empty($consultants)) {
                $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn) VALUES (?, ?, ?, ?)");
                foreach($consultants as $cid) {
                    $ratio    = isset($ratios[$cid]) ? max(1, (int)$ratios[$cid]) : 1;
                    $perTurn  = isset($per_turns[$cid]) ? max(1, (int)$per_turns[$cid]) : 1;
                    $stmtC->bind_param("iiii", $roundId, $cid, $ratio, $perTurn);
                    $stmtC->execute();
                }
            }
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
            $id = (int)($input['id'] ?? 0);
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
            
            // Delete consultants that are no longer in this round
            if (empty($consultants)) {
                $stmtDel = $conn->prepare("DELETE FROM round_consultants WHERE round_id=?");
                $stmtDel->bind_param("i", $id);
                $stmtDel->execute();
            } else {
                $placeholders = implode(',', array_fill(0, count($consultants), '?'));
                $stmtDel = $conn->prepare("DELETE FROM round_consultants WHERE round_id=? AND consultant_id NOT IN ($placeholders)");
                $params = array_merge([$id], $consultants);
                $types = str_repeat('i', count($params));
                $stmtDel->bind_param($types, ...$params);
                $stmtDel->execute();
            }
            
            $ratios    = $input['ratios'] ?? [];
            $per_turns = $input['data_per_turns'] ?? [];
            
            if (!empty($consultants)) {
                $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE receive_ratio = VALUES(receive_ratio), data_per_turn = VALUES(data_per_turn), current_turn_remaining = 0");
                foreach($consultants as $cid) {
                    $ratio   = isset($ratios[$cid]) ? max(1, (int)$ratios[$cid]) : 1;
                    $perTurn = isset($per_turns[$cid]) ? max(1, (int)$per_turns[$cid]) : 1;
                    $stmtC->bind_param("iiii", $id, $cid, $ratio, $perTurn);
                    $stmtC->execute();
                }
            }
            
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;


    case 'delete_round':
        $conn->begin_transaction();
        try {
            $id = (int)($_GET['id'] ?? 0);
            
            // Check if round has any distribution logs
            $checkLog = $conn->query("SELECT COUNT(*) as cnt FROM distribution_logs WHERE round_id=$id");
            if ($checkLog && $checkLog->fetch_assoc()['cnt'] > 0) {
                throw new Exception("Vòng này đã phân bổ Data, không thể xóa để bảo toàn thống kê. Vui lòng chuyển sang Ngừng hoạt động.");
            }
            
            $stmt1 = $conn->prepare("DELETE FROM round_consultants WHERE round_id=?");
            $stmt1->bind_param("i", $id);
            $stmt1->execute();
            
            $stmt2 = $conn->prepare("DELETE FROM data_reports WHERE round_id=?");
            $stmt2->bind_param("i", $id);
            $stmt2->execute();
            
            $stmt = $conn->prepare("DELETE FROM distribution_rounds WHERE id=?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;
        
    case 'get_connections':
        $res = $conn->query("SELECT * FROM sheet_connections ORDER BY created_at DESC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_connection':
        $input = json_decode(file_get_contents('php://input'), true);
        $name = $input['sheet_name'] ?? '';
        $spreadsheetId = $input['spreadsheet_id'] ?? '';
        $webhookToken = $input['webhook_token'] ?? '';
        $isActive = $input['is_active'] ?? 1;
        $syncInterval = $input['sync_interval'] ?? 15;
        $requireBoth = $input['require_both_contact'] ?? 0;
        $connectionType = $input['connection_type'] ?? 'sheets';
        
        $stmt = $conn->prepare("INSERT INTO sheet_connections (sheet_name, spreadsheet_id, webhook_token, is_active, sync_interval, require_both_contact, connection_type) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssiiis", $name, $spreadsheetId, $webhookToken, $isActive, $syncInterval, $requireBoth, $connectionType);
        $stmt->execute();
        echo json_encode(['success' => true, 'id' => $conn->insert_id]);
        break;

    case 'edit_connection':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $name = $input['sheet_name'] ?? '';
        $spreadsheetId = $input['spreadsheet_id'] ?? '';
        $isActive = $input['is_active'] ?? 1;
        $syncInterval = $input['sync_interval'] ?? 15;
        $requireBoth = $input['require_both_contact'] ?? 0;
        $connectionType = $input['connection_type'] ?? 'sheets';
        
        $stmt = $conn->prepare("UPDATE sheet_connections SET sheet_name=?, spreadsheet_id=?, is_active=?, sync_interval=?, require_both_contact=?, connection_type=? WHERE id=?");
        $stmt->bind_param("ssiiisi", $name, $spreadsheetId, $isActive, $syncInterval, $requireBoth, $connectionType, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'delete_connection':
        $conn->begin_transaction();
        try {
            $id = (int)($_GET['id'] ?? 0);
            
            $stmt1 = $conn->prepare("DELETE FROM field_mappings WHERE connection_id=?");
            $stmt1->bind_param("i", $id);
            $stmt1->execute();
            
            $stmt2 = $conn->prepare("DELETE FROM routing_rules WHERE connection_id=?");
            $stmt2->bind_param("i", $id);
            $stmt2->execute();
            
            $stmt3 = $conn->prepare("DELETE FROM sheet_sync_records WHERE connection_id=?");
            $stmt3->bind_param("i", $id);
            $stmt3->execute();
            
            $stmt = $conn->prepare("DELETE FROM sheet_connections WHERE id=?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
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
            $sheets = array_map(function($val) {
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
            $sheets = array_filter($sheets, function($v) {
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
            $columns = array_map(function($h) { return trim($h ?? '', "\" "); }, $row);
            $columns = array_filter($columns, function($c) { return $c !== ''; });
            $columns = array_values($columns);
        }
        fclose($stream);
        
        echo json_encode(['success' => true, 'columns' => $columns]);
        break;

    case 'toggle_connection':
        $id = (int)($_GET['id'] ?? 0);
        $active = (int)($_GET['active'] ?? 0);
        $stmt = $conn->prepare("UPDATE sheet_connections SET is_active=? WHERE id=?");
        $stmt->bind_param("ii", $active, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'toggle_require_both':
        $id = (int)($_GET['id'] ?? 0);
        $require = (int)($_GET['require'] ?? 0);
        $stmt = $conn->prepare("UPDATE sheet_connections SET require_both_contact=? WHERE id=?");
        $stmt->bind_param("ii", $require, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'get_rules':
        $res = $conn->query("SELECT rr.*, r.round_name, sc.sheet_name 
                               FROM routing_rules rr 
                               LEFT JOIN distribution_rounds r ON rr.target_round_id = r.id 
                               LEFT JOIN sheet_connections sc ON rr.connection_id = sc.id
                               ORDER BY rr.priority ASC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_rule':
        $input = json_decode(file_get_contents('php://input'), true);
        $col = $input['condition_column'] ?? '';
        $op = $input['condition_operator'] ?? '';
        $val = $input['condition_value'] ?? '';
        $conditions_json = isset($input['conditions_json']) ? json_encode($input['conditions_json']) : null;
        $logical_operator = $input['logical_operator'] ?? 'AND';
        $target = (int)($input['target_round_id'] ?? 0);
        $conn_id = isset($input['connection_id']) && $input['connection_id'] !== 'all' ? (int)$input['connection_id'] : null;
        
        $stmt = $conn->prepare("INSERT INTO routing_rules (connection_id, condition_column, condition_operator, condition_value, target_round_id, conditions_json, logical_operator) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("isssiss", $conn_id, $col, $op, $val, $target, $conditions_json, $logical_operator);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'delete_rule':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM routing_rules WHERE id=?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'edit_rule':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $col = $input['condition_column'] ?? '';
        $op = $input['condition_operator'] ?? '';
        $val = $input['condition_value'] ?? '';
        $conditions_json = isset($input['conditions_json']) ? json_encode($input['conditions_json']) : null;
        $logical_operator = $input['logical_operator'] ?? 'AND';
        $target = (int)($input['target_round_id'] ?? 0);
        $conn_id = isset($input['connection_id']) && $input['connection_id'] !== 'all' ? (int)$input['connection_id'] : null;
        
        $stmt = $conn->prepare("UPDATE routing_rules SET connection_id=?, condition_column=?, condition_operator=?, condition_value=?, target_round_id=?, conditions_json=?, logical_operator=? WHERE id=?");
        $stmt->bind_param("isssissi", $conn_id, $col, $op, $val, $target, $conditions_json, $logical_operator, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'reorder_rules':
        $conn->begin_transaction();
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $order = $input['order'] ?? [];
            $stmt = $conn->prepare("UPDATE routing_rules SET priority=? WHERE id=?");
            foreach ($order as $index => $id) {
                $id = (int)$id;
                $priority = $index + 1;
                $stmt->bind_param("ii", $priority, $id);
                $stmt->execute();
            }
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
        $lead_id  = (int)($_GET['lead_id']  ?? 0);
        $sale_id  = (int)($_GET['sale_id']  ?? 0);
        $round_id = (int)($_GET['round_id'] ?? 0);
        
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
                'lead_name'        => $ctx['lead_name'],
                'lead_phone'       => $ctx['lead_phone'],
                'lead_source'      => $ctx['source'],
                'lead_note'        => $ctx['note'],
                'consultant_name'  => $ctx['consultant_name'],
                'consultant_email' => $ctx['consultant_email'],
                'round_name'       => $ctx['round_name'],
                'assigned_at'      => $ctx['received_at'],
                'existing_report'  => $existingReport ? $existingReport['status'] : null,
            ]
        ]);
        break;

    case 'submit_report':
        $input    = json_decode(file_get_contents('php://input'), true);
        $lead_id  = (int)($input['lead_id']  ?? 0);
        $sale_id  = (int)($input['sale_id']  ?? 0);
        $round_id = (int)($input['round_id'] ?? 0);
        $reason   = trim($input['reason'] ?? '');
        
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
        if ($verifyStmt->get_result()->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Thông tin không hợp lệ: Data này không thuộc về bạn trong vòng này.']);
            break;
        }
        
        // Prevent duplicate pending reports for same lead + consultant + round
        $checkStmt = $conn->prepare("SELECT id FROM data_reports WHERE lead_id=? AND consultant_id=? AND round_id=? AND status='pending'");
        $checkStmt->bind_param("iii", $lead_id, $sale_id, $round_id);
        $checkStmt->execute();
        if ($checkStmt->get_result()->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Bạn đã báo cáo Lead này và đang chờ duyệt!']);
            break;
        }

        $stmt = $conn->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiis", $lead_id, $sale_id, $round_id, $reason);
        if ($stmt->execute()) {
            // FEATURE: Gửi email thông báo tới admin được thiết lập nhận ticket
            require_once __DIR__ . '/mailer.php';
            $notifyIds = [];
            $notifyRes = $conn->query("SELECT account_id FROM ticket_notify_settings");
            if ($notifyRes) while ($nr = $notifyRes->fetch_assoc()) $notifyIds[] = (int)$nr['account_id'];

            if (!empty($notifyIds)) {
                // Lấy thông tin consultant và lead để gửi email
                $ctxForEmail = $conn->prepare("
                    SELECT l.name as lead_name, l.phone as lead_phone, c.name as consultant_name, c.zalo_chat_id, dr.round_name
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

                // Lấy danh sách email và zalo_chat_id của admin được chọn
                $placeholders = implode(',', array_fill(0, count($notifyIds), '?'));
                $adminEmailStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id IN ($placeholders) AND email IS NOT NULL");
                $adminEmailStmt->bind_param(str_repeat('i', count($notifyIds)), ...$notifyIds);
                $adminEmailStmt->execute();
                $adminEmails = $adminEmailStmt->get_result()->fetch_all(MYSQLI_ASSOC);

                if (!empty($adminEmails)) {
                    $toAdmin   = array_shift($adminEmails); // Admin đầu tiên là recipient chính
                    $ccList    = array_map(fn($a) => $a['email'], $adminEmails); // Còn lại là CC
                    $ccString  = implode(',', array_filter($ccList));
                    
                    // 1. Gửi Email
                    sendTicketNotificationToAdmins(
                        $toAdmin['email'],
                        $toAdmin['name'],
                        $ctxData['lead_name'] ?? 'Khách hàng',
                        $ctxData['lead_phone'] ?? '',
                        $reason,
                        $ctxData['consultant_name'] ?? '',
                        $ctxData['round_name'] ?? '',
                        $ccString
                    );
                    
                    // 2. Gửi Zalo Message cho toàn bộ admin có zalo_chat_id
                    require_once __DIR__ . '/zalo_bot.php';
                    $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                    $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
                    if (!empty($botToken)) {
                        $allAdmins = array_merge([$toAdmin], $adminEmails);
                        $leadName = $ctxData['lead_name'] ?? 'Khách hàng';
                        $leadPhone = $ctxData['lead_phone'] ?? 'Không rõ';
                        $consultName = $ctxData['consultant_name'] ?? 'Không rõ';
                        
                        $zaloMsg = "[ YÊU CẦU DUYỆT TICKET ]\n\n"
                                 . "Một nhân viên vừa gửi báo cáo lỗi Data:\n\n"
                                 . "❖ THÔNG TIN BÁO CÁO:\n"
                                 . "  • Sale báo cáo: $consultName\n"
                                 . "  • Khách hàng: $leadName ($leadPhone)\n\n"
                                 . "❖ LÝ DO LỖI:\n"
                                 . "  $reason\n\n"
                                 . "Vui lòng đăng nhập hệ thống CRM để duyệt hoặc từ chối Ticket này.";
                                 
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
            }
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Lỗi lưu báo cáo']);
        }
        break;


    case 'get_reports':
        // NEW-01 fix: use prepared statement for round_id filter (was SQL injection via concatenation)
        $round_id = isset($_GET['round_id']) ? (int)$_GET['round_id'] : 0;
        
        if ($round_id > 0) {
            $sql = "SELECT r.*, l.name as lead_name, l.phone as lead_phone, 
                           c.name as consultant_name, c.zalo_chat_id, dr.round_name
                    FROM data_reports r 
                    JOIN leads l ON r.lead_id = l.id 
                    JOIN consultants c ON r.consultant_id = c.id
                    JOIN distribution_rounds dr ON r.round_id = dr.id
                    WHERE r.round_id = ?
                    ORDER BY r.created_at DESC";
            $stmtR = $conn->prepare($sql);
            $stmtR->bind_param("i", $round_id);
            $stmtR->execute();
            $res = $stmtR->get_result();
        } else {
            $res = $conn->query("SELECT r.*, l.name as lead_name, l.phone as lead_phone, 
                           c.name as consultant_name, c.zalo_chat_id, dr.round_name
                    FROM data_reports r 
                    JOIN leads l ON r.lead_id = l.id 
                    JOIN consultants c ON r.consultant_id = c.id
                    JOIN distribution_rounds dr ON r.round_id = dr.id
                    ORDER BY r.created_at DESC");
        }
        
        $data = [];
        if ($res) {
            while($row = $res->fetch_assoc()) $data[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'approve_report':
        $input = json_decode(file_get_contents('php://input'), true);
        $report_id = (int)($input['id'] ?? 0);
        if (!$report_id) {
            echo json_encode(['success' => false, 'message' => 'ID báo cáo không hợp lệ']);
            break;
        }
        
        $conn->begin_transaction();
        try {
            // 1. Get report info
            $stmt = $conn->prepare("SELECT lead_id, consultant_id, round_id, reason, status FROM data_reports WHERE id = ? FOR UPDATE");
            $stmt->bind_param("i", $report_id);
            $stmt->execute();
            $report = $stmt->get_result()->fetch_assoc();
            
            if (!$report || $report['status'] !== 'pending') {
                throw new Exception("Báo cáo không tồn tại hoặc đã được xử lý.");
            }
            
            // 2. Mark report as approved
            $updRep = $conn->prepare("UPDATE data_reports SET status='approved', resolved_at=NOW() WHERE id=?");
            $updRep->bind_param("i", $report_id);
            $updRep->execute();
            
            // 3. Mark lead as faulty (Append to note and unassign)
            $faultyMsg = "[LỖI - ĐÃ DUYỆT]: " . $report['reason'];
            $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
            $updLead->bind_param("si", $faultyMsg, $report['lead_id']);
            $updLead->execute();
            
            // Mark distribution_logs as error
            $updLog = $conn->prepare("UPDATE distribution_logs SET status='error' WHERE lead_id=? AND assigned_to=? AND round_id=?");
            $updLog->bind_param("iii", $report['lead_id'], $report['consultant_id'], $report['round_id']);
            $updLog->execute();
            
            // 4. Increment compensation_count for the consultant in that round
            $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id=? AND consultant_id=?");
            $updComp->bind_param("ii", $report['round_id'], $report['consultant_id']);
            $updComp->execute();
            
            $conn->commit();
            
            // Lấy thông tin Sale & Lead để gửi thông báo
            $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $consultStmt->bind_param("i", $report['consultant_id']);
            $consultStmt->execute();
            $consultant = $consultStmt->get_result()->fetch_assoc();
            
            $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
            $leadStmt->bind_param("i", $report['lead_id']);
            $leadStmt->execute();
            $lead = $leadStmt->get_result()->fetch_assoc();
            
            $cName = $consultant['name'] ?? 'Bạn';
            $lName = $lead['name'] ?? 'Khách hàng';
            $lPhone = $lead['phone'] ?? 'Không rõ';
            
            // Thông báo qua Zalo Bot
            require_once __DIR__ . '/zalo_bot.php';
            $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
            $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
            
            if (!empty($botToken) && !empty($consultant['zalo_chat_id'])) {
                $zaloMsg = "[ TICKET ĐÃ ĐƯỢC DUYỆT ]\n\n"
                         . "Chào $cName, báo cáo lỗi Data của bạn đã ĐƯỢC PHÊ DUYỆT.\n\n"
                         . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                         . "  • Khách hàng: $lName ($lPhone)\n"
                         . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                         . "Hệ thống đã ghi nhận 1 lượt đền bù. Bạn sẽ nhận được Data mới vào lần phân bổ tiếp theo.";
                sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
            }
            
            // Thông báo qua Email
            if (!empty($consultant['email'])) {
                require_once __DIR__ . '/mailer.php';
                $emailSubj = "[Domation CRM] Ticket Lỗi Data Đã Được Duyệt - $lName";
                $emailBody = "<h3>Báo cáo lỗi Data được phê duyệt</h3>
                              <p>Chào $cName,</p>
                              <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã được Quản trị viên duyệt thành công.</p>
                              <p>Hệ thống đã tự động cộng 1 lượt đền bù cho bạn trong vòng phân bổ hiện tại.</p>";
                sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, '');
            }
            
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'reject_report':
        $input = json_decode(file_get_contents('php://input'), true);
        $report_id = (int)($input['id'] ?? 0);
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
            $chkStmt = $conn->prepare("SELECT lead_id, consultant_id, round_id, reason, status FROM data_reports WHERE id = ? FOR UPDATE");
            $chkStmt->bind_param("i", $report_id);
            $chkStmt->execute();
            $report = $chkStmt->get_result()->fetch_assoc();
            
            if (!$report || $report['status'] !== 'pending') {
                throw new Exception("Báo cáo không tồn tại hoặc đã được xử lý rồi.");
            }
            
            $stmt = $conn->prepare("UPDATE data_reports SET status='rejected', reject_reason=?, resolved_at=NOW() WHERE id=?");
            $stmt->bind_param("si", $reject_reason, $report_id);
            $stmt->execute();
            
            $conn->commit();
            
            // Lấy thông tin Sale & Lead để gửi thông báo
            $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $consultStmt->bind_param("i", $report['consultant_id']);
            $consultStmt->execute();
            $consultant = $consultStmt->get_result()->fetch_assoc();
            
            $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
            $leadStmt->bind_param("i", $report['lead_id']);
            $leadStmt->execute();
            $lead = $leadStmt->get_result()->fetch_assoc();
            
            $cName = $consultant['name'] ?? 'Bạn';
            $lName = $lead['name'] ?? 'Khách hàng';
            $lPhone = $lead['phone'] ?? 'Không rõ';
            
            // Thông báo qua Zalo Bot
            require_once __DIR__ . '/zalo_bot.php';
            $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
            $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
            
            if (!empty($botToken) && !empty($consultant['zalo_chat_id'])) {
                $zaloMsg = "[ TICKET BỊ TỪ CHỐI ]\n\n"
                         . "Chào $cName, báo cáo lỗi Data của bạn đã BỊ TỪ CHỐI.\n\n"
                         . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                         . "  • Khách hàng: $lName ($lPhone)\n"
                         . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                         . "❖ LÝ DO TỪ CHỐI:\n"
                         . "  $reject_reason\n\n"
                         . "Bạn sẽ không được đền bù Data cho trường hợp này.";
                sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
            }
            
            // Thông báo qua Email
            if (!empty($consultant['email'])) {
                require_once __DIR__ . '/mailer.php';
                $emailSubj = "[Domation CRM] Ticket Lỗi Data Bị Từ Chối - $lName";
                $emailBody = "<h3>Báo cáo lỗi Data bị từ chối</h3>
                              <p>Chào $cName,</p>
                              <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã bị Quản trị viên từ chối.</p>
                              <p><strong>Lý do từ chối:</strong> $reject_reason</p>
                              <p>Bạn sẽ không được nhận Data đền bù cho trường hợp này.</p>";
                sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, '');
            }
            
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'get_mappings':
        $res = $conn->query("SELECT * FROM field_mappings ORDER BY created_at DESC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_mapping':
        $input = json_decode(file_get_contents('php://input'), true);
        $conn_id = $input['connection_id'] ?? 0;
        $sheet_col = $input['sheet_column'] ?? '';
        $sys_field = $input['system_field'] ?? '';
        $custom_label = $input['custom_label'] ?? null;
        $stmt = $conn->prepare("INSERT INTO field_mappings (connection_id, sheet_column, system_field, custom_label) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("isss", $conn_id, $sheet_col, $sys_field, $custom_label);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'edit_mapping':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $sheet_col = $input['sheet_column'] ?? '';
        $sys_field = $input['system_field'] ?? '';
        $custom_label = $input['custom_label'] ?? null;
        $stmt = $conn->prepare("UPDATE field_mappings SET sheet_column=?, system_field=?, custom_label=? WHERE id=?");
        $stmt->bind_param("sssi", $sheet_col, $sys_field, $custom_label, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'delete_mapping':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM field_mappings WHERE id=?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
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
        foreach($input as $k => $v) {
            $stmt->bind_param("ss", $k, $v);
            $stmt->execute();
        }
        echo json_encode(['success' => true]);
        break;

    case 'test_email':
        $input = json_decode(file_get_contents('php://input'), true);
        $email = trim($input['email'] ?? '');
        $type  = $input['type'] ?? 'system';
        
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'Email không hợp lệ']);
            break;
        }
        
        require_once __DIR__ . '/mailer.php';
        
        if ($type === 'assignment') {
            // Send a REAL-FORMAT email using the actual template with mock data
            // Mock IDs that clearly don't exist in DB (0 = test mode)
            $mockLeadId      = 0;
            $mockConsultantId = 0;
            $mockRoundId     = 0;
            
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
            $mockPhone  = '0912 345 678';
            $mockName   = 'Trần Thị Mai Anh';
            $mockEmail  = 'maianh.tran@gmail.com';
            $mockSource = 'Facebook Ads — Chiến dịch Tuyển sinh T5/2026';
            $mockType   = 'Học viên tiềm năng';
            $mockNote   = "Quan tâm: Khóa Marketing Online\nNgân sách: 5–10 triệu\nThời gian học: Buổi tối / Cuối tuần\nGhi chú: Đã nhắn tin fanpage hỏi lịch khai giảng";
            $mockRound  = 'Vòng A — Facebook Inbound';
            $consultantName = 'Bạn (Test)';

            $formattedNote   = nl2br(htmlspecialchars($mockNote));
            $formattedSource = htmlspecialchars($mockSource);
            $formattedType   = htmlspecialchars($mockType);
            $formattedEmail  = htmlspecialchars($mockEmail);
            $phoneEncoded    = urlencode(str_replace(' ', '', $mockPhone));

            $subject = "[TEST] Bạn vừa nhận được Lead {$mockName} — {$mockRound}";
            
            $content = '
                <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin-bottom:28px;border-radius:0 8px 8px 0;font-size:14px;color:#856404;">
                    ⚠️ <strong>Email thử nghiệm</strong> — Đây là email kiểm tra hệ thống, không phải Data thật.
                </div>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
                    Chào <strong>' . htmlspecialchars($consultantName) . '</strong>,<br><br>
                    Hệ thống vừa phân bổ tự động cho bạn 1 khách hàng mới từ chiến dịch Inbound.
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
                
                <div style="text-align: center; margin-bottom: 32px;">
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 12px; font-weight: 500;">Quét mã QR bằng điện thoại để gọi nhanh</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=tel:' . $phoneEncoded . '" alt="QR Call" style="border-radius: 12px; border: 1px solid #e2e8f0; padding: 6px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);" width="130" height="130" />
                </div>

                <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px dashed #cbd5e1;">
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 12px;">Nếu Data này bị sai SĐT, Spam hoặc trùng lặp, vui lòng nhấn nút bên dưới để báo cáo và nhận Data bù.</p>
                    <a href="' . $reportUrl . '" style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 7px 22px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
                        BÁO CÁO DATA LỖI
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
        $res = $conn->query("SELECT id, username, name, email, role, created_at, zalo_chat_id, is_confirmed FROM accounts ORDER BY created_at DESC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_account':
        $input    = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        $name     = trim($input['name'] ?? '');
        $role     = $input['role'] ?? 'viewer';
        $email    = trim($input['email'] ?? '');
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
            $host  = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $frontendUrl = $proto . '://' . preg_replace('/\/backend.*$/', '', $host);
            $confirmLink = $frontendUrl . "/backend/confirm.php?token=" . $token;
            
            require_once 'mailer.php';
            sendAdminConfirmationEmail($email, $name, $confirmLink);
            
            echo json_encode(['success' => true, 'id' => $newId]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Username hoặc Email có thể đã tồn tại']);
        }
        break;

    case 'edit_account':
        $input    = json_decode(file_get_contents('php://input'), true);
        $id       = (int)($input['id'] ?? 0);
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        $name     = trim($input['name'] ?? '');
        $role     = $input['role'] ?? 'viewer';
        $email    = trim($input['email'] ?? '');
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
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Cập nhật thất bại, username hoặc email có thể bị trùng']);
        }
        break;

    case 'delete_account':
        $id = (int)($_GET['id'] ?? 0);
        if ($id === 1) { // Prevent deleting default super admin
            echo json_encode(['success' => false, 'message' => 'Không thể xóa tài khoản Super Admin']);
            break;
        }
        $stmt = $conn->prepare("DELETE FROM accounts WHERE id=?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'resend_confirm_email':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        
        $res = $conn->query("SELECT email, name FROM accounts WHERE id=$id");
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
                $host  = $_SERVER['HTTP_HOST'] ?? 'localhost';
                $frontendUrl = $proto . '://' . preg_replace('/\/backend.*$/', '', $host);
                $confirmLink = $frontendUrl . "/backend/confirm.php?token=" . $token;
                
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

    // ── TICKET NOTIFICATION SETTINGS ──────────────────────────────────────────
    case 'get_ticket_settings':
        // Trả về danh sách account_id được chọn nhận thông báo ticket
        $res = $conn->query("SELECT account_id FROM ticket_notify_settings");
        $ids = [];
        if ($res) while ($r = $res->fetch_assoc()) $ids[] = (int)$r['account_id'];
        echo json_encode(['success' => true, 'data' => $ids]);
        break;

    case 'save_ticket_settings':
        $input   = json_decode(file_get_contents('php://input'), true);
        $adminIds = array_map('intval', $input['admin_ids'] ?? []);

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
            $conn->commit();
            
            // Send notification email and Zalo to admins
            if (!empty($adminIds)) {
                require_once 'mailer.php';
                require_once 'zalo_bot.php';
                
                $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

                $stmtLink = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_link' LIMIT 1");
                $botLink = $stmtLink->fetch_assoc()['setting_value'] ?? 'https://zalo.me/1185588456243371597';
                
                $idsStr = implode(',', $adminIds);
                $resAdmins = $conn->query("SELECT id, email, name, zalo_chat_id FROM accounts WHERE id IN ($idsStr)");
                if ($resAdmins) {
                    while ($admin = $resAdmins->fetch_assoc()) {
                        if (!empty($admin['email'])) {
                            sendWelcomeEmailToAdminTicket($admin['id'], $admin['email'], $admin['name'], $botLink);
                        }
                        if (!empty($botToken) && !empty($admin['zalo_chat_id'])) {
                            $zName = $admin['name'] ?: 'Quản trị viên';
                            $zaloMsg = "[ PHÂN QUYỀN TICKET ]\n\n"
                                     . "Chào $zName,\n"
                                     . "Bạn vừa được cấp quyền xử lý Báo cáo lỗi (Ticket) từ hệ thống CRM.\n\n"
                                     . "Từ bây giờ, hệ thống sẽ tự động gửi thông báo cho bạn mỗi khi có Ticket mới chờ duyệt.";
                            sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg);
                        }
                    }
                }
            }

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Lỗi lưu cấu hình: ' . $e->getMessage()]);
        }
        break;

    case 'force_sync':
        $id = (int)($_GET['id'] ?? 0);
        if ($id) {
            ob_start();
            // Mock CLI arguments for cron_sync.php
            $argv = ['cron_sync.php', $id];
            require __DIR__ . '/cron_sync.php';
            $output = ob_get_clean();
            echo json_encode(['success' => true, 'output' => $output]);
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
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2}) đến (\d{4}-\d{2}-\d{2})$/', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "received_at >= '$start 00:00:00' AND received_at <= '$end 23:59:59'";
            $diff = max(1, (strtotime($end) - strtotime($start)) / 86400);
            $prevDateCondition = "received_at >= DATE_SUB('$start', INTERVAL $diff DAY) AND received_at < '$start'";
        }

        // Query current period stats using GROUP BY for index optimization
        $statsSql = "SELECT status, COUNT(*) as cnt FROM distribution_logs WHERE $dateCondition GROUP BY status";
        $statsResRaw = $conn->query($statsSql);
        $statsRes = ['total' => 0, 'distributed' => 0, 'duplicates' => 0, 'errors' => 0];
        if ($statsResRaw) {
            while ($row = $statsResRaw->fetch_assoc()) {
                $status = $row['status'];
                $cnt = (int)$row['cnt'];
                $statsRes['total'] += $cnt;
                if ($status === 'assigned' || $status === 'compensation') $statsRes['distributed'] += $cnt;
                else if ($status === 'duplicate' || $status === 'reminder') $statsRes['duplicates'] += $cnt;
                else if ($status === 'error') $statsRes['errors'] += $cnt;
                else if ($status === 'rule_6_month') $statsRes['distributed'] += $cnt;
            }
        }

        // Query previous period stats for % change
        $prevStatsSql = "SELECT status, COUNT(*) as cnt FROM distribution_logs WHERE $prevDateCondition GROUP BY status";
        $prevStatsResRaw = $conn->query($prevStatsSql);
        $prevStatsRes = ['total' => 0, 'distributed' => 0, 'duplicates' => 0, 'errors' => 0];
        if ($prevStatsResRaw) {
            while ($row = $prevStatsResRaw->fetch_assoc()) {
                $status = $row['status'];
                $cnt = (int)$row['cnt'];
                $prevStatsRes['total'] += $cnt;
                if ($status === 'assigned' || $status === 'compensation') $prevStatsRes['distributed'] += $cnt;
                else if ($status === 'duplicate' || $status === 'reminder') $prevStatsRes['duplicates'] += $cnt;
                else if ($status === 'error') $prevStatsRes['errors'] += $cnt;
                else if ($status === 'rule_6_month') $prevStatsRes['distributed'] += $cnt;
            }
        }

        $calcChange = function($current, $prev) {
            $current = (int)$current;
            $prev = (int)$prev;
            if ($prev == 0) return $current > 0 ? '+100%' : '0%';
            $change = (($current - $prev) / $prev) * 100;
            return ($change > 0 ? '+' : '') . number_format($change, 1) . '%';
        };

        // Query hourly chart data
        $chartData = [];
        if ($date === 'Hôm nay' || $date === 'Hôm qua') {
            $hourlySql = "SELECT HOUR(received_at) as h, COUNT(*) as vol FROM distribution_logs WHERE $dateCondition GROUP BY HOUR(received_at) ORDER BY h ASC";
            $res = $conn->query($hourlySql);
            $hourlyMap = [];
            while($row = $res->fetch_assoc()) $hourlyMap[$row['h']] = $row['vol'];
            for($i=8; $i<=22; $i+=2) {
                $vol = ($hourlyMap[$i] ?? 0) + ($hourlyMap[$i+1] ?? 0); // sum 2 hours
                $chartData[] = ['time' => str_pad($i, 2, '0', STR_PAD_LEFT) . ':00', 'volume' => $vol];
            }
        } else {
            // For 7 days
            $dailySql = "SELECT DATE(received_at) as d, COUNT(*) as vol FROM distribution_logs WHERE $dateCondition GROUP BY DATE(received_at) ORDER BY d ASC";
            $res = $conn->query($dailySql);
            while($row = $res->fetch_assoc()) {
                $chartData[] = ['time' => date('d/m', strtotime($row['d'])), 'volume' => $row['vol']];
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
        $totalAssignedForTop = max(1, (int)$statsRes['distributed']);
        $colors = ['#7c3aed', '#3b82f6', '#f59e0b', '#10b981'];
        $i = 0;
        while($row = $topConsultantsRes->fetch_assoc()) {
            $percent = round(($row['data_count'] / $totalAssignedForTop) * 100, 1);
            $topConsultants[] = [
                'name' => $row['name'],
                'data' => (int)$row['data_count'],
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
        $totalDistributed = max(1, (int)$statsRes['distributed']);
        $roundColors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
        $j = 0;
        while($row = $roundRatioRes->fetch_assoc()) {
            $percent = round(($row['count'] / $totalDistributed) * 100, 1);
            $roundRatio[] = [
                'round' => $row['round_name'],
                'count' => (int)$row['count'],
                'percent' => $percent,
                'color' => $roundColors[$j % 5]
            ];
            $j++;
        }

        echo json_encode(['success' => true, 'data' => [
            'total_today' => (int)$statsRes['total'],
            'distributed_today' => (int)$statsRes['distributed'],
            'duplicates' => (int)$statsRes['duplicates'],
            'errors' => (int)$statsRes['errors'],
            'total_change' => $calcChange($statsRes['total'], $prevStatsRes['total']),
            'distributed_change' => $calcChange($statsRes['distributed'], $prevStatsRes['distributed']),
            'duplicates_change' => $calcChange($statsRes['duplicates'], $prevStatsRes['duplicates']),
            'errors_change' => $calcChange($statsRes['errors'], $prevStatsRes['errors']),
            'chartData' => $chartData,
            'topConsultants' => $topConsultants,
            'roundRatio' => $roundRatio
        ]]);
        break;

    case 'reassign_lead':
        $input = json_decode(file_get_contents('php://input'), true);
        $log_id = (int)($input['log_id'] ?? 0);
        $new_consultant_id = (int)($input['new_consultant_id'] ?? 0);
        
        if (!$log_id || !$new_consultant_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID Log hoặc ID TVV mới']);
            break;
        }
        
        // 1. Fetch lead details and new consultant details
        $stmt = $conn->prepare("
            SELECT dl.lead_id, dl.round_id, l.name as lead_name, l.phone, l.note, l.source, r.cc_emails
            FROM distribution_logs dl
            LEFT JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
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
        $cc_emails = $log_data['cc_emails'] ?? '';
        
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
            // Update distribution_logs
            $stmtU1 = $conn->prepare("UPDATE distribution_logs SET assigned_to = ?, status = 'assigned' WHERE id = ?");
            $stmtU1->bind_param("ii", $new_consultant_id, $log_id);
            $stmtU1->execute();
            
            // Update leads
            $stmtU2 = $conn->prepare("UPDATE leads SET assigned_to = ? WHERE id = ?");
            $stmtU2->bind_param("ii", $new_consultant_id, $lead_id);
            $stmtU2->execute();
            
            $conn->commit();
            
            // 3. Send email to new consultant (NEW-05 fix: include round_name and IDs in email)
            require_once __DIR__ . '/mailer.php';
            // Fetch round name
            $roundNameStr = '';
            $roundId = (int)($log_data['round_id'] ?? 0);
            if ($roundId) {
                $rStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                $rStmt->bind_param("i", $roundId);
                $rStmt->execute();
                $rRes = $rStmt->get_result();
                if ($rRes->num_rows > 0) $roundNameStr = $rRes->fetch_assoc()['round_name'] ?? '';
            }
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
            
            require_once __DIR__ . '/zalo_bot.php';
            sendLeadAssignedZaloMessageToSale(
                $new_consultant_id,
                $new_cons_name,
                $log_data['lead_name'] ?: 'Khach hang an danh',
                $log_data['phone'] ?: '',
                $log_data['note'] ?: '',
                $log_data['source'] ?: '',
                $roundNameStr,
                $lead_id,
                $roundId
            );
            
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'send_quick_zalo_message':
        $input = json_decode(file_get_contents('php://input'), true);
        $consultant_id = (int)($input['consultant_id'] ?? 0);
        $message = trim($input['message'] ?? '');
        
        if (!$consultant_id || empty($message)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin người nhận hoặc nội dung tin nhắn']);
            break;
        }
        
        $stmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
        $stmt->bind_param("i", $consultant_id);
        $stmt->execute();
        $consultant = $stmt->get_result()->fetch_assoc();
        
        if (!$consultant) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy Tư vấn viên']);
            break;
        }
        
        $sentZalo = false;
        $sentEmail = false;
        
        // 1. Send Zalo
        require_once __DIR__ . '/zalo_bot.php';
        $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
        $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
        
        if (!empty($botToken) && !empty($consultant['zalo_chat_id'])) {
            $zaloMsg = "[ TIN NHẮN TỪ QUẢN TRỊ VIÊN ]\n\n"
                     . "Chào {$consultant['name']},\n\n"
                     . $message;
            $sentZalo = sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg);
        }
        
        // 2. Send Email
        if (!empty($consultant['email'])) {
            require_once __DIR__ . '/mailer.php';
            sendQuickMessageEmailToSale($consultant['email'], $consultant['name'], $message);
            $sentEmail = true;
        }
        
        if ($sentZalo || $sentEmail) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gửi thất bại. TVV chưa có Email và chưa liên kết Zalo.']);
        }
        break;

    case 'preview_routing':
        require_once __DIR__ . '/webhook_logic.php';
        
        $input = json_decode(file_get_contents('php://input'), true);
        $data = $input['data'] ?? [];
        
        $phone = normalizePhone($data['phone'] ?? '');
        $email = $data['email'] ?? '';
        $name = $data['name'] ?? '';
        $source = $data['source'] ?? '';
        $type = $data['type'] ?? '';
        $note = $data['note'] ?? '';
        
        $assignedRoundId = evaluateRules($conn, null, $source, $type, $note, $phone, $email, $name);
        if (!$assignedRoundId) {
            echo json_encode(['success' => true, 'round_id' => null, 'consultant' => null, 'message' => 'Không khớp luật nào']);
            break;
        }
        
        // Find expected consultant without doing any updates
        $consultant = null;
        
        $stmtRound = $conn->prepare("SELECT last_assigned_consultant_id, round_name FROM distribution_rounds WHERE id = ? AND is_active = 1");
        $stmtRound->bind_param("i", $assignedRoundId);
        $stmtRound->execute();
        $resRound = $stmtRound->get_result();
        
        if ($resRound->num_rows > 0) {
            $roundData = $resRound->fetch_assoc();
            $lastAssignedId = $roundData['last_assigned_consultant_id'];
            $roundName = $roundData['round_name'];
            
            $stmtC = $conn->prepare("SELECT rc.consultant_id, c.name, rc.receive_ratio, rc.data_per_turn, rc.current_turn_remaining 
                                     FROM round_consultants rc 
                                     JOIN consultants c ON rc.consultant_id = c.id 
                                     WHERE rc.round_id = ? AND c.is_active = 1 AND c.status = 'online' 
                                     ORDER BY rc.consultant_id ASC");
            $stmtC->bind_param("i", $assignedRoundId);
            $stmtC->execute();
            $resC = $stmtC->get_result();
            
            $activeConsultants = [];
            while ($row = $resC->fetch_assoc()) {
                $activeConsultants[] = $row;
            }
            
            if (count($activeConsultants) > 0) {
                // Determine next:
                // If last_assigned has remaining turns, they get it.
                // Else next person.
                
                $nextIndex = 0;
                $lastIndex = -1;
                foreach ($activeConsultants as $idx => $c) {
                    if ($c['consultant_id'] == $lastAssignedId) {
                        $lastIndex = $idx;
                        break;
                    }
                }
                
                if ($lastIndex !== -1) {
                    $lastC = $activeConsultants[$lastIndex];
                    if ((int)$lastC['current_turn_remaining'] > 0) {
                        $consultant = $lastC;
                    } else {
                        $nextIndex = ($lastIndex + 1) % count($activeConsultants);
                        $consultant = $activeConsultants[$nextIndex];
                    }
                } else {
                    $consultant = $activeConsultants[0];
                }
                $consultant['round_name'] = $roundName;
            }
        }
        
        echo json_encode(['success' => true, 'round_id' => $assignedRoundId, 'consultant' => $consultant]);
        break;

    case 'manual_insert_lead':
        require_once __DIR__ . '/webhook_logic.php';
        
        $input = json_decode(file_get_contents('php://input'), true);
        $data = $input['data'] ?? [];
        $override_round_id = $input['override_round_id'] ?? null;
        $override_consultant_id = $input['override_consultant_id'] ?? null;
        
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
        if (!$assignedRoundId) {
            $assignedRoundId = evaluateRules($conn, null, $source, $type, $note, $phone, $email, $name);
        }
        
        if (!$assignedRoundId) {
            // Cannot assign
            $leadId = insertLead($conn, $phone, $email, $name, $source, $type, $note, 'Chưa phân bổ', null, null, null);
            echo json_encode(['success' => true, 'message' => 'Data đã được thêm nhưng không rơi vào vòng nào.']);
            break;
        }
        
        $consultantId = $override_consultant_id;
        
        $conn->begin_transaction();
        try {
            // Lock
            $lockKey = 'webhook_lead_' . md5($phone . '_' . $email);
            $conn->query("SELECT GET_LOCK('$lockKey', 5)");
            
            $isComp = false;
            if (!$consultantId) {
                // If override consultant not provided, compute it naturally, but UPDATE the round
                $assignResult = getNextConsultantInRound($conn, $assignedRoundId);
                if ($assignResult) {
                    $consultantId = $assignResult['id'];
                    $isComp = $assignResult['is_compensation'];
                }
            }
            
            if ($consultantId) {
                $status = $isComp ? 'compensation' : 'assigned';
                $leadId = insertLead($conn, [], $consultantId, $phone, $email, $name, $source, $type, $note);
                
                // Track CRM logs
                trackCRMAction($conn, $leadId, "Nhập liệu thủ công từ Admin", "System", "success");
                
                $stmtRound = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                $stmtRound->bind_param("i", $assignedRoundId);
                $stmtRound->execute();
                $roundName = $stmtRound->get_result()->fetch_assoc()['round_name'] ?? 'Không rõ';
                
                // Log distribution
                logDistribution($conn, $leadId, $consultantId, $assignedRoundId, $status, "Nhập liệu thủ công từ Admin");
                
                // Track assigned report
                trackAssignedReport($conn, $assignedRoundId, $consultantId);
                
                $conn->commit();
                $conn->query("SELECT RELEASE_LOCK('$lockKey')");
                
                // Fire notification via logic helper
                notifyConsultant($conn, $consultantId, $phone, $email, $name, $source, $type, $note, $roundName);
                
                echo json_encode(['success' => true, 'message' => 'Data đã được giao thành công.']);
            } else {
                // Insert unassigned
                $leadId = insertLead($conn, $phone, $email, $name, $source, $type, $note, 'Chưa phân bổ', null, null, null);
                $conn->commit();
                $conn->query("SELECT RELEASE_LOCK('$lockKey')");
                echo json_encode(['success' => true, 'message' => 'Data được lưu nhưng không có TVV online nhận.']);
            }
        } catch (Exception $e) {
            $conn->rollback();
            $conn->query("SELECT RELEASE_LOCK('$lockKey')");
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
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
    if (ob_get_level() > 0) ob_flush();
    flush();
}

// 2. Pseudo-cron: Kiểm tra báo cáo hàng ngày
require_once __DIR__ . '/cron_daily_report.php';
runDailyReportCron($conn);

$conn->close();
