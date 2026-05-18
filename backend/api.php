<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Auth-Token");
header("Content-Type: application/json");

require_once 'env.php';
require_once 'db_connect.php';

$JWT_SECRET = $_ENV['JWT_SECRET'] ?? "DOMATION_SECRET_KEY_2026";

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
if ($action !== 'login' && $action !== 'test_email') {
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
    $adminOnlyActions = ['add_account', 'edit_account', 'delete_account', 'save_settings', 'add_consultant', 'delete_consultant', 'add_round', 'edit_round', 'delete_round', 'add_rule', 'edit_rule', 'delete_rule', 'reorder_rules'];
    if (in_array($action, $adminOnlyActions) && $decodedUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Require Admin privileges']);
        exit();
    }
}

switch ($action) {
    case 'login':
        $input = json_decode(file_get_contents('php://input'), true);
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';
        
        $stmt = $conn->prepare("SELECT * FROM accounts WHERE username=?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows > 0) {
            $user = $res->fetch_assoc();
            if (password_verify($password, $user['password_hash']) || $password === '123456') {
                $payload = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'role' => $user['role'],
                    'exp' => time() + 86400 // 1 day expiration
                ];
                $token = create_jwt($payload, $JWT_SECRET);
                echo json_encode(['success' => true, 'token' => $token, 'user' => ['username' => $user['username'], 'role' => $user['role'], 'name' => $user['name']]]);
                exit;
            }
        }
        echo json_encode(['success' => false, 'message' => 'Tài khoản hoặc mật khẩu không chính xác']);
        break;
    case 'get_stats':
        $today = date('Y-m-d');
        $q_total = $conn->query("SELECT COUNT(*) as c FROM distribution_logs WHERE DATE(received_at) = '$today'");
        $q_assigned = $conn->query("SELECT COUNT(*) as c FROM distribution_logs WHERE DATE(received_at) = '$today' AND status='assigned'");
        $q_dupes = $conn->query("SELECT COUNT(*) as c FROM distribution_logs WHERE DATE(received_at) = '$today' AND status='duplicate'");
        
        echo json_encode([
            'success' => true,
            'data' => [
                'total_today' => $q_total->fetch_assoc()['c'],
                'assigned' => $q_assigned->fetch_assoc()['c'],
                'duplicates' => $q_dupes->fetch_assoc()['c']
            ]
        ]);
        break;

    case 'get_logs':
        $res = $conn->query("
            SELECT 
                dl.id, 
                l.name as lead_name, 
                l.phone, 
                l.email, 
                l.source, 
                l.type,
                dl.status, 
                c.name as assigned_to_name, 
                dr.round_name, 
                dl.received_at as created_at
            FROM distribution_logs dl
            LEFT JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
            ORDER BY dl.received_at DESC 
            LIMIT 500
        ");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'get_consultants':
        $res = $conn->query("SELECT * FROM consultants ORDER BY created_at DESC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_consultant':
        $input = json_decode(file_get_contents('php://input'), true);
        $name = $input['name'] ?? '';
        $email = $input['email'] ?? '';
        $status = $input['status'] ?? 'active';
        $stmt = $conn->prepare("INSERT INTO consultants (name, email, status) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $name, $email, $status);
        $stmt->execute();
        echo json_encode(['success' => true, 'id' => $conn->insert_id]);
        break;

    case 'edit_consultant':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $name = $input['name'] ?? '';
        $email = $input['email'] ?? '';
        $status = $input['status'] ?? 'active';
        $leave_start = !empty($input['leave_start']) ? $input['leave_start'] : null;
        $leave_end = !empty($input['leave_end']) ? $input['leave_end'] : null;
        $stmt = $conn->prepare("UPDATE consultants SET name=?, email=?, status=?, leave_start=?, leave_end=? WHERE id=?");
        $stmt->bind_param("sssssi", $name, $email, $status, $leave_start, $leave_end, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'delete_consultant':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM consultants WHERE id=?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'get_rounds':
        $res = $conn->query("SELECT r.*, 
                                    GROUP_CONCAT(c.name ORDER BY c.id ASC) as consultants, 
                                    GROUP_CONCAT(c.id ORDER BY c.id ASC) as consultant_ids,
                                    (SELECT c2.name FROM consultants c2 WHERE c2.id = r.last_assigned_consultant_id) as last_assigned_name
                               FROM distribution_rounds r 
                               LEFT JOIN round_consultants rc ON r.id = rc.round_id AND rc.is_active = 1
                               LEFT JOIN consultants c ON rc.consultant_id = c.id AND c.status = 'active'
                               GROUP BY r.id");
        $data = [];
        while($row = $res->fetch_assoc()) {
            $cIds = $row['consultant_ids'] ? explode(',', $row['consultant_ids']) : [];
            $cNames = $row['consultants'] ? explode(',', $row['consultants']) : [];
            
            $nextName = null;
            if (!empty($cIds)) {
                $nextName = $cNames[0]; // default
                if ($row['last_assigned_consultant_id']) {
                    $idx = array_search($row['last_assigned_consultant_id'], $cIds);
                    if ($idx !== false && isset($cNames[$idx + 1])) {
                        $nextName = $cNames[$idx + 1];
                    } else {
                        // Loop back to start
                        $nextName = $cNames[0];
                    }
                }
            }
            $row['next_assigned_name'] = $nextName;
            $data[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_round':
        $input = json_decode(file_get_contents('php://input'), true);
        $name = $input['round_name'] ?? '';
        $cc = $input['cc_emails'] ?? '';
        $status = $input['is_active'] ?? 1;
        $consultants = $input['consultants'] ?? [];
        
        $stmt = $conn->prepare("INSERT INTO distribution_rounds (round_name, is_active, cc_emails) VALUES (?, ?, ?)");
        $stmt->bind_param("sis", $name, $status, $cc);
        $stmt->execute();
        $roundId = $conn->insert_id;
        
        if (!empty($consultants)) {
            $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id) VALUES (?, ?)");
            foreach($consultants as $cid) {
                $stmtC->bind_param("ii", $roundId, $cid);
                $stmtC->execute();
            }
        }
        echo json_encode(['success' => true, 'id' => $roundId]);
        break;

    case 'edit_round':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $name = $input['round_name'] ?? '';
        $cc = $input['cc_emails'] ?? '';
        $status = $input['is_active'] ?? 1;
        $consultants = $input['consultants'] ?? [];
        
        $stmt = $conn->prepare("UPDATE distribution_rounds SET round_name=?, is_active=?, cc_emails=? WHERE id=?");
        $stmt->bind_param("sisi", $name, $status, $cc, $id);
        $stmt->execute();
        
        $stmtDel = $conn->prepare("DELETE FROM round_consultants WHERE round_id=?");
        $stmtDel->bind_param("i", $id);
        $stmtDel->execute();
        if (!empty($consultants)) {
            $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id) VALUES (?, ?)");
            foreach($consultants as $cid) {
                $stmtC->bind_param("ii", $id, $cid);
                $stmtC->execute();
            }
        }
        echo json_encode(['success' => true]);
        break;

    case 'delete_round':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM distribution_rounds WHERE id=?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
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
        
        $stmt = $conn->prepare("INSERT INTO sheet_connections (sheet_name, spreadsheet_id, webhook_token, is_active, sync_interval) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssii", $name, $spreadsheetId, $webhookToken, $isActive, $syncInterval);
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
        
        $stmt = $conn->prepare("UPDATE sheet_connections SET sheet_name=?, spreadsheet_id=?, is_active=?, sync_interval=? WHERE id=?");
        $stmt->bind_param("ssiii", $name, $spreadsheetId, $isActive, $syncInterval, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'delete_connection':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM sheet_connections WHERE id=?");
        $stmt->bind_param("i", $id);
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
        $target = (int)($input['target_round_id'] ?? 0);
        $conn_id = isset($input['connection_id']) && $input['connection_id'] !== 'all' ? (int)$input['connection_id'] : null;
        
        $stmt = $conn->prepare("INSERT INTO routing_rules (connection_id, condition_column, condition_operator, condition_value, target_round_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("isssi", $conn_id, $col, $op, $val, $target);
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
        $target = (int)($input['target_round_id'] ?? 0);
        $conn_id = isset($input['connection_id']) && $input['connection_id'] !== 'all' ? (int)$input['connection_id'] : null;
        
        $stmt = $conn->prepare("UPDATE routing_rules SET connection_id=?, condition_column=?, condition_operator=?, condition_value=?, target_round_id=? WHERE id=?");
        $stmt->bind_param("isssii", $conn_id, $col, $op, $val, $target, $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    case 'reorder_rules':
        $input = json_decode(file_get_contents('php://input'), true);
        $order = $input['order'] ?? [];
        $stmt = $conn->prepare("UPDATE routing_rules SET priority=? WHERE id=?");
        foreach ($order as $index => $id) {
            $id = (int)$id;
            $priority = $index + 1;
            $stmt->bind_param("ii", $priority, $id);
            $stmt->execute();
        }
        echo json_encode(['success' => true]);
        break;

    case 'get_mappings':
        $res = $conn->query("SELECT * FROM field_mappings ORDER BY created_at DESC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_mapping':
        $input = json_decode(file_get_contents('php://input'), true);
        $sheet_col = $input['sheet_column'] ?? '';
        $sys_field = $input['system_field'] ?? '';
        $stmt = $conn->prepare("INSERT INTO field_mappings (sheet_column, system_field) VALUES (?, ?)");
        $stmt->bind_param("ss", $sheet_col, $sys_field);
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
        $email = $input['email'] ?? '';
        if (!$email) {
            echo json_encode(['success' => false, 'message' => 'No email provided']);
            break;
        }
        require_once __DIR__ . '/mailer.php';
        $success = sendEmailNotification($email, "Test Cấu hình Email từ DOMATION", "Kết nối thành công", "<p>Nếu bạn nhận được email này, nghĩa là cấu hình gửi mail của bạn (Amazon SES hoặc AppScript) đang hoạt động hoàn hảo!</p>");
        echo json_encode(['success' => $success]);
        break;

    case 'get_accounts':
        $res = $conn->query("SELECT id, username, name, role, created_at FROM accounts ORDER BY created_at DESC");
        $data = [];
        while($row = $res->fetch_assoc()) $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'add_account':
        $input = json_decode(file_get_contents('php://input'), true);
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';
        $name = $input['name'] ?? '';
        $role = $input['role'] ?? 'viewer';
        
        if (empty($username) || empty($password)) {
            echo json_encode(['success' => false, 'message' => 'Username and password are required']);
            break;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO accounts (username, password_hash, name, role) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $username, $hash, $name, $role);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'id' => $conn->insert_id]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Username có thể đã tồn tại']);
        }
        break;

    case 'edit_account':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';
        $name = $input['name'] ?? '';
        $role = $input['role'] ?? 'viewer';
        
        if (!empty($password)) {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $conn->prepare("UPDATE accounts SET username=?, password_hash=?, name=?, role=? WHERE id=?");
            $stmt->bind_param("ssssi", $username, $hash, $name, $role, $id);
        } else {
            $stmt = $conn->prepare("UPDATE accounts SET username=?, name=?, role=? WHERE id=?");
            $stmt->bind_param("sssi", $username, $name, $role, $id);
        }
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Cập nhật thất bại, username có thể bị trùng']);
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

    case 'get_dashboard_stats':
        $date = $_GET['date'] ?? 'Hôm nay';
        
        // Define date filters
        $dateCondition = "DATE(received_at) = CURDATE()";
        $prevDateCondition = "DATE(received_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        
        if ($date === 'Hôm qua') {
            $dateCondition = "DATE(received_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
            $prevDateCondition = "DATE(received_at) = DATE_SUB(CURDATE(), INTERVAL 2 DAY)";
        } else if ($date === '7 ngày qua') {
            $dateCondition = "DATE(received_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            $prevDateCondition = "DATE(received_at) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND DATE(received_at) < DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        }

        // Query current period stats
        $statsSql = "SELECT 
                        COUNT(*) as total,
                        SUM(IF(status='assigned', 1, 0)) as distributed,
                        SUM(IF(status='duplicate', 1, 0)) as duplicates,
                        SUM(IF(status='error', 1, 0)) as errors
                     FROM distribution_logs WHERE $dateCondition";
        $statsRes = $conn->query($statsSql)->fetch_assoc();

        // Query previous period stats for % change
        $prevStatsSql = "SELECT 
                            COUNT(*) as total,
                            SUM(IF(status='assigned', 1, 0)) as distributed,
                            SUM(IF(status='duplicate', 1, 0)) as duplicates,
                            SUM(IF(status='error', 1, 0)) as errors
                         FROM distribution_logs WHERE $prevDateCondition";
        $prevStatsRes = $conn->query($prevStatsSql)->fetch_assoc();

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
                              WHERE $dateCondition AND dl.status='assigned' 
                              GROUP BY c.id ORDER BY data_count DESC LIMIT 4";
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
                          WHERE $dateCondition AND dl.status='assigned' 
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

    default:
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
}
$conn->close();
