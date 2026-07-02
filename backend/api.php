<?php
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Auth-Token");
header("Content-Type: application/json; charset=utf-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

// Handle CORS Preflight early to avoid DB connection overhead for OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    http_response_code(200);
    exit();
}

// Intercept OOP controller routes and bridge them to index.php
$action = $_GET['action'] ?? '';
$segments = explode('/', $action);
$baseAction = explode('&', $segments[0])[0];
if (in_array($baseAction, [
    'projects', 'deposits', 'cooperation-slips', 'capi', 'check-ins', 
    'cloud-files', 'file-categories', 'tickets', 'suppliers', 'purchase-orders', 
    'pos', 'custom-fields', 'inventory', 'tags', 'pipeline-stages', 
    'users', 'reports', 'quotes', 'invoices', 'expenses', 
    'contacts', 'companies', 'deals', 'activities', 'notes', 'campaigns'
], true)) {
    $_SERVER['REQUEST_URI'] = '/backend/' . $action;
    require_once __DIR__ . '/index.php';
    exit;
}

require_once 'env.php';
require_once 'db_connect.php';

try {
    $conn->query("ALTER TABLE consultants ADD COLUMN dob DATE NULL");
} catch (Exception $e) {}
try {
    $conn->query("ALTER TABLE consultants ADD COLUMN gender VARCHAR(20) NULL");
} catch (Exception $e) {}
try {
    $conn->query("ALTER TABLE consultants ADD COLUMN citizen_id VARCHAR(50) NULL");
} catch (Exception $e) {}
try {
    $conn->query("ALTER TABLE consultants ADD COLUMN address TEXT NULL");
} catch (Exception $e) {}
try {
    $conn->query("ALTER TABLE consultants ADD COLUMN bank_name VARCHAR(100) NULL");
} catch (Exception $e) {}
try {
    $conn->query("ALTER TABLE consultants ADD COLUMN bank_account VARCHAR(100) NULL");
} catch (Exception $e) {}

// Safe CORS origin matching
$httpOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000'
];

$frontendUrl = get_system_setting($conn, 'frontend_url');
if (!empty($frontendUrl)) {
    $parsed = parse_url($frontendUrl);
    if (isset($parsed['scheme']) && isset($parsed['host'])) {
        $allowedOrigins[] = $parsed['scheme'] . '://' . $parsed['host'] . (isset($parsed['port']) ? ':' . $parsed['port'] : '');
    }
}

$originToSet = '*';
if (!empty($httpOrigin)) {
    $cleanedOrigin = rtrim($httpOrigin, '/');
    foreach ($allowedOrigins as $allowed) {
        if (strcasecmp(rtrim($allowed, '/'), $cleanedOrigin) === 0) {
            $originToSet = $httpOrigin;
            break;
        }
    }
}
header("Access-Control-Allow-Origin: " . $originToSet);

$JWT_SECRET = $_ENV['JWT_SECRET'] ?? "RICH LAND_SECRET_KEY_2026";

function getSafeErrorMsg($e)
{
    if ($e instanceof mysqli_sql_exception) {
        error_log("DB Error: " . $e->getMessage());
        return "Lỗi cơ sở dữ liệu hệ thống. Vui lòng thử lại sau.";
    }
    return $e->getMessage();
}

function getSystemFallbackRoundIds($conn)
{
    require_once __DIR__ . '/webhook_logic.php';
    $roundIds = getAllFallbackRoundIds($conn);
    $mainFbRoundId = (int) get_system_setting($conn, 'fallback_round_id');
    if ($mainFbRoundId > 0) {
        $roundIds[] = $mainFbRoundId;
    }
    return array_unique($roundIds);
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
    // Bypass for dev/demo tokens
    if ($jwt === 'demo_token_12345') {
        return [
            'username' => 'admin',
            'email' => 'admin@richland.net',
            'name' => 'Admin Demo',
            'role' => 'admin',
            'id' => 1
        ];
    }
    if (strpos($jwt, 'demo_token_sale_') === 0) {
        $cId = (int)str_replace('demo_token_sale_', '', $jwt);
        $names = [
            1 => 'Hải Đăng',
            2 => 'Thanh Thảo',
            3 => 'Việt Dũng',
            4 => 'Minh Tuấn'
        ];
        $emails = [
            1 => 'haidang@richland.net',
            2 => 'thanhthao@richland.net',
            3 => 'vietdung@richland.net',
            4 => 'minhtuan@richland.net'
        ];
        return [
            'username' => str_replace('@richland.net', '', $emails[$cId] ?? 'sale'),
            'email' => $emails[$cId] ?? 'sale@richland.net',
            'name' => $names[$cId] ?? 'Sale Demo',
            'role' => 'sale',
            'consultant_id' => $cId,
            'id' => 100 + $cId // Dummy user ID for sales
        ];
    }

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

function validateWorkSchedule($schedule)
{
    if ($schedule === null || $schedule === '') return true;
    $decoded = $schedule;
    if (is_string($schedule)) {
        $decoded = json_decode($schedule, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return false;
        }
    }
    if (!is_array($decoded)) return false;
    foreach ($decoded as $day => $config) {
        if (!is_numeric($day) || $day < 1 || $day > 7) return false;
        if (!is_array($config)) return false;
        if (isset($config['active']) && !is_bool($config['active']) && $config['active'] !== 'true' && $config['active'] !== 'false' && $config['active'] !== 1 && $config['active'] !== 0 && $config['active'] !== '1' && $config['active'] !== '0') return false;
        if (!empty($config['start']) && !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $config['start'])) return false;
        if (!empty($config['end']) && !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $config['end'])) return false;
    }
    return true;
}

if (!function_exists('getBearerToken')) {
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
}

function check_zalo_direct_log_for_lead($logFile, $createdDate, $phone, $name) {
    if (!file_exists($logFile)) return 'N/A';
    
    $handle = fopen($logFile, 'r');
    if (!$handle) return 'N/A';
    
    $fsize = filesize($logFile);
    $readSize = min($fsize, 150000); // Read last 150KB
    if ($fsize > $readSize) {
        fseek($handle, $fsize - $readSize);
    }
    
    $content = fread($handle, $readSize);
    fclose($handle);
    
    if (empty($content)) return 'N/A';
    
    $lines = explode("\n", $content);
    for ($i = count($lines) - 1; $i >= 0; $i--) {
        $line = $lines[$i];
        if (empty(trim($line))) continue;
        
        // Match by phone or name
        if (strpos($line, $phone) !== false || (!empty($name) && strpos($line, $name) !== false)) {
            if (strpos($line, 'HTTP: 200') !== false || strpos($line, '"ok":true') !== false) {
                return 'sent (Direct cURL)';
            }
        }
    }
    return 'N/A';
}

function parse_zalo_direct_logs($logFile) {
    $logs = [];
    if (!file_exists($logFile)) return $logs;
    
    $handle = fopen($logFile, 'r');
    if (!$handle) return $logs;
    
    $fsize = filesize($logFile);
    $readSize = min($fsize, 250000); // Read last 250KB for log feed
    if ($fsize > $readSize) {
        fseek($handle, $fsize - $readSize);
    }
    
    $content = fread($handle, $readSize);
    fclose($handle);
    
    if (empty($content)) return $logs;
    
    $lines = explode("\n", $content);
    for ($i = count($lines) - 1; $i >= 0; $i--) {
        $line = $lines[$i];
        if (empty(trim($line))) continue;
        
        // Format: [Y-m-d H:i:s] Target ChatId: X, HTTP: Y, Request: Z, Response: W
        if (preg_match('/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+Target\s+ChatId:\s*([^,]+),\s*HTTP:\s*(\d+)/i', $line, $matches)) {
            $time = $matches[1];
            $chatId = trim($matches[2]);
            $httpCode = $matches[3];
            
            $body = '';
            $reqStart = strpos($line, 'Request: ');
            if ($reqStart !== false) {
                $reqEnd = strpos($line, ', Response:', $reqStart);
                $reqJsonStr = ($reqEnd !== false) 
                    ? substr($line, $reqStart + 9, $reqEnd - ($reqStart + 9))
                    : substr($line, $reqStart + 9);
                
                $reqData = json_decode($reqJsonStr, true);
                if (isset($reqData['text'])) {
                    $body = $reqData['text'];
                } else if (isset($reqData['body_text'])) {
                    $body = $reqData['body_text'];
                } else {
                    $body = $reqJsonStr;
                }
            }
            
            $logs[] = [
                'id' => 'direct_' . md5($line),
                'channel' => 'zalo',
                'target' => $chatId,
                'subject' => 'Zalo Direct cURL',
                'body' => $body,
                'status' => ($httpCode == 200) ? 'sent' : 'failed',
                'created_at' => $time,
                'sent_at' => $time,
                'is_direct' => true
            ];
        }
    }
    return $logs;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$action = $_GET['action'] ?? '';

// Require authentication for all endpoints except login
$publicActions = ['login', 'login_google', 'login_google_sale', 'submit_report', 'get_report_context'];

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

    if (isset($decodedUser['role']) && $decodedUser['role'] === 'sales') {
        $decodedUser['role'] = 'sale';
    }

    $currentSaleConsultantId = 0;
    if (isset($decodedUser['role']) && $decodedUser['role'] === 'sale') {
        $stmtC = $conn->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
        $stmtC->bind_param("s", $decodedUser['email']);
        $stmtC->execute();
        $cRow = $stmtC->get_result()->fetch_assoc();
        $stmtC->close();
        if ($cRow) {
            $currentSaleConsultantId = (int)$cRow['id'];
        }
    }

    if ($decodedUser['role'] === 'sale' && !in_array($action, ['get_sale_portal_data', 'get_sale_lead_timeline', 'toggle_consultant_vacation', 'accept_lead', 'check_lead_duplicate', 'get_lead_notification_status', 'get_reports', 'get_rounds', 'get_fair_share_stats', 'get_consultant_compensation_details', 'upload_avatar', 'update_consultant_self_profile', 'get_dashboard_stats', 'get_logs', 'get_consultants', 'invoices', 'projects', 'campaigns', 'files', 'cloud-files', 'file-categories', 'get_public_leads', 'claim_public_lead', 'teams', 'manual_insert_lead', 'get_unique_sources'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Sale role cannot access admin APIs']);
        exit();
    }

    $superAdminOnlyActions = [
        'add_account',
        'edit_account',
        'delete_account',
        'check_delete_account',
        'resend_confirm_email',
        'resend_zalo_verify_account'
    ];

    $adminOnlyActions = [
        'get_accounts',
        'get_admin_logs',
        'save_settings',
        'get_settings',
        'add_consultant',
        'edit_consultant',
        'delete_consultant',
        'add_round',
        'edit_round',
        'update_round_ratios',
        'delete_round',
        'add_rule',
        'edit_rule',
        'delete_rule',
        'reorder_rules',
        'get_consultant_stats',
        'add_connection',
        'edit_connection',
        'delete_connection',
        'toggle_connection',
        'toggle_require_both',
        'toggle_notify_admin',
        'add_mapping',
        'edit_mapping',
        'delete_mapping',
        'approve_report',
        'reject_report',
        'compensate_approved_no_comp',
        'get_active_compensation_logs',
        'reassign_lead',
        'force_sync',
        'get_ticket_settings',
        'save_ticket_settings', // Ticket notification config
        'unlink_zalo',
        'test_email',
        'block_lead',
        'get_zalo_send_logs',
        'ai_chat',
        'test_master_sync',
        'rollback_admin_action',
        'update_lead_fields',
        'send_lead_reminder'
    ];

    if (in_array($action, $superAdminOnlyActions) && $decodedUser['role'] !== 'superadmin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Require Super Admin privileges']);
        exit();
    }

    if (in_array($action, $adminOnlyActions) && $decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'superadmin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Require Admin privileges']);
        exit();
    }

    // Prevent viewer role from accessing write/modifying actions (read-only constraint)
    $writeActions = [
        'upload_avatar',
        'update_consultant_self_profile',
        'add_consultant',
        'edit_consultant',
        'toggle_consultant_vacation',
        'accept_lead',
        'delete_consultant',
        'unlink_zalo',
        'add_round',
        'edit_round',
        'update_round_ratios',
        'update_compensations',
        'delete_round',
        'add_connection',
        'edit_connection',
        'delete_connection',
        'toggle_connection',
        'toggle_require_both',
        'toggle_notify_admin',
        'add_rule',
        'edit_rule',
        'delete_rule',
        'reorder_rules',
        'approve_report',
        'reject_report',
        'compensate_approved_no_comp',
        'approve_held_lead',
        'reject_held_lead',
        'blacklist_held_lead',
        'add_mapping',
        'edit_mapping',
        'delete_mapping',
        'save_settings',
        'alter_schema',
        'add_account',
        'edit_account',
        'update_profile',
        'change_password',
        'delete_account',
        'resend_confirm_email',
        'resend_zalo_verify_account',
        'resend_zalo_verify_consultant',
        'save_ticket_settings',
        'force_sync',
        'reassign_lead',
        'block_lead',
        'send_quick_zalo_message',
        'manual_insert_lead',
        'delete_import_history',
        'rollback_admin_action',
        'update_lead_fields',
        'send_lead_reminder'
    ];
    if (in_array($action, $writeActions) && $decodedUser['role'] === 'viewer') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Viewer role is read-only']);
        exit();
    }

    // Ghi nhận thời gian hoạt động cuối cùng (last active time)
    if ($decodedUser && isset($decodedUser['id'])) {
        $conn->query("UPDATE accounts SET last_login = NOW() WHERE id = " . (int) $decodedUser['id']);
    }
} else {
    $decodedUser = null; // Public actions have no user context
}
function logAdminAction($conn, $accountId, $action, $details = [])
{
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

function maskPhone($phone) {
    if (empty($phone)) return '';
    $phone = trim($phone);
    if (strlen($phone) <= 6) return '***';
    return substr($phone, 0, 3) . str_repeat('*', strlen($phone) - 6) . substr($phone, -3);
}

function maskEmail($email) {
    if (empty($email)) return '';
    $email = trim($email);
    $parts = explode('@', $email);
    if (count($parts) < 2) return '***';
    $name = $parts[0];
    $domain = $parts[1];
    if (strlen($name) <= 3) {
        $maskedName = str_repeat('*', strlen($name));
    } else {
        $maskedName = substr($name, 0, 2) . str_repeat('*', strlen($name) - 3) . substr($name, -1);
    }
    return $maskedName . '@' . $domain;
}

function processManualLead($conn, $leadData, $override_round_id, $override_consultant_id, $compensate_skipped, $skipped_consultant_id, $distribution_mode, $decodedUser) {
    require_once __DIR__ . '/webhook_logic.php';

    $phone = normalizePhone($leadData['phone'] ?? '');
    $email = trim($leadData['email'] ?? '');
    $name = trim($leadData['name'] ?? '');
    $source = trim($leadData['source'] ?? '');
    $type = trim($leadData['type'] ?? '');
    $note = trim($leadData['note'] ?? '');

    if ($decodedUser['role'] === 'sale') {
        $stmtC = $conn->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
        $stmtC->bind_param("s", $decodedUser['email']);
        $stmtC->execute();
        $cRow = $stmtC->get_result()->fetch_assoc();
        $stmtC->close();
        if ($cRow) {
            $override_consultant_id = (int)$cRow['id'];
        }
        $distribution_mode = 'auto_round';
        if ($source !== 'gioi_thieu') {
            $source = 'ca_nhan';
        }
    }

    if (empty($phone) && empty($email)) {
        return ['success' => false, 'message' => 'Vui lòng nhập SĐT hoặc Email'];
    }

    if ($distribution_mode === 'direct_databank') {
        // Direct to Databank
        $conn->begin_transaction();
        try {
            // Check if duplicate in leads to update last interaction
            $crmCheckResult = checkCRMInteraction($conn, $phone, $email);
            if ($crmCheckResult['leadExists']) {
                $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, null, null, $name);
            } else {
                $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);
            }

            // Ensure Person exists and is set to public (databank)
            $stmtPerson = $conn->prepare("
                INSERT INTO persons (phone, email, full_name, is_public, released_to_kho_at, public_count) 
                VALUES (?, ?, ?, 1, NOW(), 1) 
                ON DUPLICATE KEY UPDATE 
                    email = IF(email IS NULL OR email = '', VALUES(email), email),
                    full_name = IF(full_name IS NULL OR full_name = '', VALUES(full_name), full_name),
                    is_public = 1,
                    released_to_kho_at = NOW(),
                    public_count = public_count + 1
            ");
            $stmtPerson->bind_param("sss", $phone, $email, $name);
            $stmtPerson->execute();
            $stmtPerson->close();

            logDistribution($conn, $leadId, null, null, 'released_to_kho', 'Thêm thủ công thẳng vào Kho chung (Databank)', false);
            $conn->commit();

            // Post-commit: trigger live write-back
            if (!empty($leadId)) {
                triggerTwoWaySync($conn, $leadId);
            }

            return ['success' => true, 'message' => 'Data đã được thêm thẳng vào Databank (Kho chung).'];
        } catch (Exception $e) {
            $conn->rollback();
            return ['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()];
        }
    }

    // Default 'auto_round' mode
    $assignedRoundId = $override_round_id;
    $inject = [];
    $isFallback = false;
    $isFallbackAdmin = false;
    $fallbackAdminData = null;
    $fallbackCcEmails = '';

    if (!$assignedRoundId) {
        $ruleResult = evaluateRules($conn, $leadData, $source, $type, null, 'manual');
        if (is_array($ruleResult)) {
            $assignedRoundId = $ruleResult['target_round_id'];
            $inject = $ruleResult['inject'] ?? [];
        } else {
            $assignedRoundId = $ruleResult;
        }

        if ($assignedRoundId) {
            $chkRound = $conn->prepare("SELECT is_active FROM distribution_rounds WHERE id = ?");
            if ($chkRound) {
                $chkRound->bind_param("i", $assignedRoundId);
                $chkRound->execute();
                $chkRes = $chkRound->get_result()->fetch_assoc();
                $chkRound->close();
                if (!$chkRes || (int) $chkRes['is_active'] !== 1) {
                    $assignedRoundId = null;
                }
            }
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
                $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND (role = 'admin' OR role = 'superadmin') LIMIT 1");
                $admStmt->bind_param("i", $fbAdminId);
                $admStmt->execute();
                $admRes = $admStmt->get_result();
                if ($admRes->num_rows > 0) {
                    $fallbackAdminData = $admRes->fetch_assoc();
                    $isFallbackAdmin = true;
                    $fallbackCcEmails = $fbCc;
                }
                $admStmt->close();
            }
        } else {
            $fbRoundId = (int) ($fbSettings['fallback_round_id'] ?? 0);
            if ($fbRoundId > 0) {
                $chkFb = $conn->prepare("SELECT is_active FROM distribution_rounds WHERE id = ?");
                if ($chkFb) {
                    $chkFb->bind_param("i", $fbRoundId);
                    $chkFb->execute();
                    $chkFbRes = $chkFb->get_result()->fetch_assoc();
                    $chkFb->close();
                    if ($chkFbRes && (int) $chkFbRes['is_active'] === 1) {
                        $assignedRoundId = $fbRoundId;
                        $isFallback = true;
                    }
                }
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

    $skippedCompensationNotify = null;
    $lockAcquired = false;
    $lockKey = '';
    if (!empty($phone)) {
        $lockKey = 'webhook_lead_phone_' . $phone;
    } else if (!empty($email)) {
        $lockKey = 'webhook_lead_email_' . md5($email);
    } else {
        $lockKey = 'webhook_lead_empty_' . md5(json_encode($leadData));
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
        return ['success' => false, 'message' => 'Hệ thống đang bận xử lý dữ liệu này. Vui lòng thử lại sau.'];
    }

    $inTransaction = false;
    try {
        // Check CRM duplicate (both phone & email)
        $crmCheckResult = checkCRMInteraction($conn, $phone, $email);
        $dupCheckMonths = (int) get_system_setting($conn, 'duplicate_check_months');
        if ($dupCheckMonths <= 0) {
            $dupCheckMonths = 6;
        }

        if (!$override_consultant_id && $crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
            $assignedTo = $crmCheckResult['assignedTo'];
            $conn->begin_transaction();
            $inTransaction = true;

            // Update last interaction
            $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note, null, null, $name);
            logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng (Nhập thủ công).', false);
            $conn->commit();
            $inTransaction = false;

            // Post-commit: trigger live write-back
            if (!empty($leadId)) {
                triggerTwoWaySync($conn, $leadId);
            }

            $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
            $stmtC->bind_param("i", $assignedTo);
            $stmtC->execute();
            $cRow = $stmtC->get_result()->fetch_assoc();
            $stmtC->close();

            if ($cRow && ($cRow['status'] === 'active' || $cRow['status'] === 'leave')) {
                try {
                    require_once __DIR__ . '/mailer.php';
                    require_once __DIR__ . '/zalo_bot.php';

                    $timeline = getLeadHistoryTimeline($conn, $leadId, true);
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

            return ['success' => true, 'message' => 'Trùng khách cũ trong vòng ' . $dupCheckMonths . ' tháng. Đã gán lại cho Sale cũ: ' . ($cRow ? $cRow['name'] : 'Không rõ')];
        } else if (!$assignedRoundId && !$isFallbackAdmin) {
            // Cannot assign
            $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);
            return ['success' => true, 'message' => 'Data đã được thêm nhưng không rơi vào vòng nào.'];
        } else {
            // Check if we need to run AI Screener
            $aiScreenerResult = null;
            if (!$override_consultant_id) {
                $screenerData = [
                    'phone' => $phone,
                    'email' => $email,
                    'name' => $name,
                    'source' => $source,
                    'type' => $type,
                    'note' => $note
                ];
                $aiScreenerResult = evaluateScreener($conn, $assignedRoundId, $screenerData);
            }

            $isSubstandardAutoApprove = false;
            if ($aiScreenerResult && $aiScreenerResult['status'] === 'failed') {
                $bsFallbackEnabled = (int) ($aiScreenerResult['below_standard_fallback_enabled'] ?? 0);
                $bsAutoApprove = (int) ($aiScreenerResult['below_standard_auto_approve'] ?? 0);
                $bsFallbackRoundId = (int) ($aiScreenerResult['below_standard_fallback_round_id'] ?? 0);

                if ($bsFallbackEnabled === 1 && $bsAutoApprove === 1 && $bsFallbackRoundId > 0) {
                    $assignedRoundId = $bsFallbackRoundId;
                    $isSubstandardAutoApprove = true;
                }
            }

            if ($aiScreenerResult && ($aiScreenerResult['status'] === 'failed' || $aiScreenerResult['status'] === 'error') && !$isSubstandardAutoApprove) {
                $conn->begin_transaction();
                $inTransaction = true;
                if ($crmCheckResult['leadExists']) {
                    $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, null, null, $name);
                } else {
                    $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);
                }

                $updHeld = $conn->prepare("UPDATE leads SET status = 'pending_approval', target_round_id = ?, ai_screener_status = ?, ai_evaluation = ?, assigned_to = NULL WHERE id = ?");
                $updHeld->bind_param("issi", $assignedRoundId, $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
                $updHeld->execute();
                $updHeld->close();

                $logMsgStr = $aiScreenerResult['status'] === 'error' ? "Lỗi kết nối AI (Nhập thủ công): " . $aiScreenerResult['reason'] : "Tạm giữ bởi AI (Nhập thủ công): " . $aiScreenerResult['reason'];
                logDistribution($conn, $leadId, null, $assignedRoundId, 'pending_approval', $logMsgStr, false);
                $conn->commit();
                $inTransaction = false;

                if (!empty($leadId)) {
                    triggerTwoWaySync($conn, $leadId);
                }

                $roundName = 'Không rõ';
                if ($assignedRoundId) {
                    $stmtR = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                    $stmtR->bind_param("i", $assignedRoundId);
                    $stmtR->execute();
                    $roundName = $stmtR->get_result()->fetch_assoc()['round_name'] ?? 'Không rõ';
                    $stmtR->close();
                }
                try {
                    sendHeldLeadNotifications($conn, $leadId, $name, $phone, $aiScreenerResult['reason'], $roundName, $email, $source, $type, $note);
                } catch (Exception $notifyEx) {
                    error_log("Error during manual insert AI screener notifications: " . $notifyEx->getMessage());
                }

                return [
                    'success' => true,
                    'status' => 'pending_approval',
                    'message' => 'Dữ liệu bị tạm giữ bởi AI (Nhập thủ công): ' . $aiScreenerResult['reason']
                ];
            } else {
                $conn->begin_transaction();
                $inTransaction = true;

                $consultantId = $override_consultant_id;
                $isComp = false;
                $isStarvation = false;

                if (!$consultantId && $assignedRoundId) {
                    // Compute it naturally INSIDE transaction block for row-level locking consistency
                    $assignResult = getNextConsultantInRound($conn, $assignedRoundId);
                    if ($assignResult) {
                        $consultantId = $assignResult['id'];
                        $isComp = $assignResult['is_compensation'];
                        $isStarvation = isset($assignResult['is_starvation']) ? true : false;
                    }
                }

                if ($override_consultant_id && $assignedRoundId) {
                    // If overridden, check if we need to compensate the skipped consultant
                    if ($compensate_skipped && $skipped_consultant_id) {
                        $stmtComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                        $stmtComp->bind_param("ii", $assignedRoundId, $skipped_consultant_id);
                        $stmtComp->execute();
                        $stmtComp->close();

                        // Fetch skipped consultant name & email
                        $skippedCName = '';
                        $skippedCEmail = '';
                        $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                        $stmtC->bind_param("i", $skipped_consultant_id);
                        $stmtC->execute();
                        $resC = $stmtC->get_result()->fetch_assoc();
                        if ($resC) {
                            $skippedCName = $resC['name'];
                            $skippedCEmail = $resC['email'];
                        }
                        $stmtC->close();

                        // Fetch round name
                        $roundName = 'Không rõ';
                        $stmtR = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                        $stmtR->bind_param("i", $assignedRoundId);
                        $stmtR->execute();
                        $resR = $stmtR->get_result()->fetch_assoc();
                        if ($resR) {
                            $roundName = $resR['round_name'];
                        }
                        $stmtR->close();

                        // Write to active_compensation_logs
                        $reason = "Bù 1 lượt do Admin chỉ định đè lead (Nhập thủ công)";
                        $stmtCompLog = $conn->prepare("INSERT INTO active_compensation_logs (round_id, consultant_id, admin_id, amount, reason) VALUES (?, ?, ?, 1, ?)");
                        $adminIdInt = (int) ($decodedUser['id'] ?? 1);
                        $stmtCompLog->bind_param("iiis", $assignedRoundId, $skipped_consultant_id, $adminIdInt, $reason);
                        $stmtCompLog->execute();
                        $stmtCompLog->close();

                        // Log admin action
                        logAdminAction($conn, $decodedUser['id'] ?? 1, 'MANUAL_COMPENSATE_SKIPPED_SALE', [
                            'round_id' => $assignedRoundId,
                            'round_name' => $roundName,
                            'consultant_id' => $skipped_consultant_id,
                            'consultant_name' => $skippedCName,
                            'reason' => $reason
                        ]);

                        // Setup notification queue data
                        $skippedCompensationNotify = [
                            'consultant_id' => $skipped_consultant_id,
                            'email' => $skippedCEmail,
                            'name' => $skippedCName,
                            'round_name' => $roundName,
                            'delta' => 1,
                            'admin_name' => $decodedUser['name'] ?? 'Admin',
                            'reason' => $reason,
                            'time' => date('H:i:s d/m/Y')
                        ];
                    }
                }

                if ($isFallbackAdmin && $fallbackAdminData) {
                    if ($crmCheckResult['leadExists']) {
                        $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, null, null, $name);
                    } else {
                        $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);
                    }
                    if ($aiScreenerResult) {
                        $updAi = $conn->prepare("UPDATE leads SET ai_screener_status = ?, ai_evaluation = ? WHERE id = ?");
                        $updAi->bind_param("ssi", $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
                        $updAi->execute();
                        $updAi->close();
                    }

                    logDistribution($conn, $leadId, null, null, 'fallback', 'No matching rule. Routed directly to fallback Admin: ' . $fallbackAdminData['name'], false);

                    $conn->commit();
                    $inTransaction = false;

                    // Post-commit: trigger live write-back
                    if (!empty($leadId)) {
                        triggerTwoWaySync($conn, $leadId);
                    }

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

                    return ['success' => true, 'message' => 'Data đã được chuyển thẳng cho Admin Fallback thành công.'];

                } else if ($consultantId) {
                    $status = $isComp ? 'compensation' : 'assigned';
                    $logMsg = $isComp
                        ? ($isStarvation ? 'Được phân bổ bù lượt ngoài giờ/nghỉ phép (Starvation Prevention).' : 'Được phân bổ đền bù lượt lỗi.')
                        : 'Được phân bổ tự động qua vòng xoay.';

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
                        if ($decodedUser['role'] !== 'sale' && !isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                            $status = 'pending_work_hours';
                            $isOutsideWorkHours = true;
                        }
                    }
                    $whStmt->close();

                    if ($crmCheckResult['leadExists']) {
                        $leadId = updateLead($conn, $phone, $email, $consultantId, $source, $type, $note, null, null, $name);
                    } else {
                        $leadId = insertLead($conn, [], $consultantId, $phone, $email, $name, $source, $type, $note);
                    }
                    if ($aiScreenerResult) {
                        $updAi = $conn->prepare("UPDATE leads SET ai_screener_status = ?, ai_evaluation = ? WHERE id = ?");
                        $updAi->bind_param("ssi", $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
                        $updAi->execute();
                        $updAi->close();
                    }

                    $stmtRound = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                    $stmtRound->bind_param("i", $assignedRoundId);
                    $stmtRound->execute();
                    $roundName = $stmtRound->get_result()->fetch_assoc()['round_name'] ?? 'Không rõ';
                    $stmtRound->close();

                    logDistribution($conn, $leadId, $consultantId, $assignedRoundId, $status, $logMsg, false);

                    $conn->commit();
                    $inTransaction = false;

                    // Post-commit: trigger live write-back
                    if (!empty($leadId)) {
                        triggerTwoWaySync($conn, $leadId);
                    }

                    // Fire skipped compensation notifications outside transaction
                    if ($skippedCompensationNotify) {
                        try {
                            require_once __DIR__ . '/mailer.php';
                            require_once __DIR__ . '/zalo_bot.php';

                            if (!empty($skippedCompensationNotify['email'])) {
                                try {
                                    sendCompensationAddedEmailToSale(
                                        $skippedCompensationNotify['email'],
                                        $skippedCompensationNotify['name'],
                                        $skippedCompensationNotify['round_name'],
                                        $skippedCompensationNotify['delta'],
                                        $skippedCompensationNotify['admin_name'],
                                        $skippedCompensationNotify['reason'],
                                        $skippedCompensationNotify['time']
                                    );
                                } catch (Exception $mailEx) {
                                    error_log("Error sending manual insert skip compensation email: " . $mailEx->getMessage());
                                }
                            }
                            try {
                                sendCompensationAddedZaloMessageToSale(
                                    $skippedCompensationNotify['consultant_id'],
                                    $skippedCompensationNotify['name'],
                                    $skippedCompensationNotify['round_name'],
                                    $skippedCompensationNotify['delta'],
                                    $skippedCompensationNotify['admin_name'],
                                    $skippedCompensationNotify['reason'],
                                    $skippedCompensationNotify['time']
                                );
                            } catch (Exception $zaloEx) {
                                error_log("Error sending manual insert skip compensation Zalo: " . $zaloEx->getMessage());
                            }
                        } catch (Exception $notifyEx) {
                            error_log("Error preparing skipped compensation notifications: " . $notifyEx->getMessage());
                        }
                    }

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

                    return ['success' => true, 'message' => $isOutsideWorkHours ? 'Data đã gán cho Sale ngoài giờ làm việc (Hoãn thông báo).' : 'Data đã được giao thành công.'];
                } else {
                    if ($crmCheckResult['leadExists']) {
                        $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, null, null, $name);
                    } else {
                        $leadId = insertLead($conn, [], null, $phone, $email, $name, $source, $type, $note);
                    }
                    if ($aiScreenerResult) {
                        $updAi = $conn->prepare("UPDATE leads SET ai_screener_status = ?, ai_evaluation = ? WHERE id = ?");
                        $updAi->bind_param("ssi", $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
                        $updAi->execute();
                        $updAi->close();
                    }
                    $status = (isset($isFallback) && $isFallback) ? 'fallback' : 'pending';
                    $logMsg = (isset($isFallback) && $isFallback) ? 'No active consultants in fallback round.' : 'No active consultants in this round.';
                    logDistribution($conn, $leadId, null, $assignedRoundId ? $assignedRoundId : null, $status, $logMsg, false);
                    $conn->commit();
                    $inTransaction = false;
                    return ['success' => true, 'message' => 'Data được lưu nhưng không có TVV nào nhận.'];
                }
            }
        }
    } catch (Exception $e) {
        if ($inTransaction) {
            $conn->rollback();
        }
        return ['success' => false, 'message' => $e->getMessage()];
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
}

if (!function_exists('getTicketNotifyAdmins')) {
    function getTicketNotifyAdmins($conn)
    {
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
            $adminRes = $conn->query("SELECT id, name, email, zalo_chat_id FROM accounts WHERE role = 'admin' OR role = 'superadmin' OR id = 1");
            if ($adminRes) {
                while ($r = $adminRes->fetch_assoc()) {
                    $admins[] = $r;
                }
            }
        }
        return $admins;
    }
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

    case 'get_unique_sources':
        $res = $conn->query("SELECT DISTINCT source FROM leads WHERE source IS NOT NULL AND source != '' ORDER BY source ASC");
        $sources = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $sources[] = $row['source'];
            }
        }
        echo json_encode(['success' => true, 'data' => $sources]);
        break;

    case 'get_import_history':
        if (!isset($decodedUser) || ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'superadmin' && $decodedUser['role'] !== 'assistant')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            exit();
        }

        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        // Check for pagination
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : 50;
        if ($page < 1)
            $page = 1;
        if ($pageSize < 1)
            $pageSize = 50;
        $offset = ($page - 1) * $pageSize;

        if (!isset($_GET['page'])) {
            $limitStr = "LIMIT 10000";
        } else {
            $limitStr = "LIMIT $pageSize OFFSET $offset";
        }

        if (!empty($search)) {
            $searchParam = '%' . $search . '%';
            
            // Prepared count
            $countSql = "
                SELECT COUNT(*) as cnt
                FROM leads l
                WHERE (l.source = 'Excel Import' OR l.note LIKE '%Nhap du lieu cu%')
                  AND (l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)
            ";
            $stmtCount = $conn->prepare($countSql);
            $stmtCount->bind_param("sss", $searchParam, $searchParam, $searchParam);
            $stmtCount->execute();
            $totalCount = (int) ($stmtCount->get_result()->fetch_assoc()['cnt'] ?? 0);
            $stmtCount->close();

            // Prepared data query
            $sql = "
                SELECT 
                    COALESCE(dl.id, -l.id) as log_id,
                    l.id as lead_id,
                    l.name,
                    l.phone,
                    l.email,
                    dl.status as distribution_status,
                    dl.message as distribution_message,
                    c.name as consultant_name,
                    c.status as consultant_status,
                    l.last_interaction_date
                FROM leads l
                LEFT JOIN distribution_logs dl ON l.id = dl.lead_id
                LEFT JOIN consultants c ON l.assigned_to = c.id
                WHERE (l.source = 'Excel Import' OR l.note LIKE '%Nhap du lieu cu%')
                  AND (l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)
                ORDER BY l.id DESC
                $limitStr
            ";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("sss", $searchParam, $searchParam, $searchParam);
            $stmt->execute();
            $res = $stmt->get_result();
        } else {
            // Count total import history records from leads table directly
            $countRes = $conn->query("
                SELECT COUNT(*) as cnt
                FROM leads l
                WHERE l.source = 'Excel Import' 
                   OR l.note LIKE '%Nhap du lieu cu%'
            ");
            $totalCount = (int) ($countRes->fetch_assoc()['cnt'] ?? 0);

            $res = $conn->query("
                SELECT 
                    COALESCE(dl.id, -l.id) as log_id,
                    l.id as lead_id,
                    l.name,
                    l.phone,
                    l.email,
                    dl.status as distribution_status,
                    dl.message as distribution_message,
                    c.name as consultant_name,
                    c.status as consultant_status,
                    l.last_interaction_date
                FROM leads l
                LEFT JOIN distribution_logs dl ON l.id = dl.lead_id
                LEFT JOIN consultants c ON l.assigned_to = c.id
                WHERE l.source = 'Excel Import' 
                   OR l.note LIKE '%Nhap du lieu cu%'
                ORDER BY l.id DESC
                $limitStr
            ");
        }

        $data = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $distMsg = $row['distribution_message'] ?? '';
                $distStatus = $row['distribution_status'] ?? '';
                $isDuplicate = (
                    strpos($distMsg, 'Trung') !== false ||
                    strpos($distMsg, 'trung') !== false ||
                    $distStatus === 'duplicate' ||
                    $distStatus === 'reminder'
                );
                $data[] = [
                    'log_id' => (int) $row['log_id'],
                    'lead_id' => (int) $row['lead_id'],
                    'name' => $row['name'],
                    'phone' => $row['phone'],
                    'email' => $row['email'],
                    'has_record' => $isDuplicate ? true : false,
                    'consultant_name' => $row['consultant_name'],
                    'consultant_status' => $row['consultant_status'],
                    'last_interaction_date' => $row['last_interaction_date']
                ];
            }
            if (!empty($search)) {
                $stmt->close();
            }
        }
        echo json_encode(['success' => true, 'data' => $data, 'total_count' => $totalCount]);
        break;

    case 'delete_import_history':
        if (!isset($decodedUser) || ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'superadmin' && $decodedUser['role'] !== 'assistant')) {
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

        // Filter out fake negative log IDs (which represent leads with deleted/pruned logs)
        $logIds = array_filter($logIds, function ($id) {
            return is_numeric($id) && (int) $id > 0;
        });
        $logIds = array_values(array_map('intval', $logIds));

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

                $payload = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'] ?? '',
                    'role' => $user['role'] === 'sales' ? 'sale' : $user['role'],
                    'exp' => time() + 86400 * 30
                ];
                $token = create_jwt($payload, $JWT_SECRET);
                echo json_encode([
                    'success' => true,
                    'token' => $token,
                    'user' => [
                        'username' => $user['username'],
                        'email' => $user['email'] ?? '',
                        'role' => $user['role'] === 'sales' ? 'sale' : $user['role'],
                        'name' => $user['name'],
                        'avatar' => $user['avatar'] ?? null
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

            // Update last_login
            $upd = $conn->prepare("UPDATE accounts SET last_login = NOW() WHERE id = ?");
            if ($upd) {
                $upd->bind_param("i", $user['id']);
                $upd->execute();
                $upd->close();
            }

            $payload = [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'] ?? '',
                'role' => $user['role'] === 'sales' ? 'sale' : $user['role'],
                'exp' => time() + 86400 * 30
            ];
            $token = create_jwt($payload, $JWT_SECRET);
            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => [
                    'username' => $user['username'],
                    'email' => $user['email'] ?? '',
                    'role' => $user['role'] === 'sales' ? 'sale' : $user['role'],
                    'name' => $user['name'],
                    'avatar' => $user['avatar'] ?? null
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
                'exp' => time() + 86400 * 30
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
                'exp' => time() + 86400 * 30 // 30 days token for sales
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
                    'consultant_id' => $sale['id'],
                    'avatar' => $sale['avatar'] ?? null
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
        $isSale = $decodedUser['role'] === 'sale';
        $saleFilterId = isset($_GET['sale_id']) && $_GET['sale_id'] !== '' ? (int) $_GET['sale_id'] : null;
        $saleId = $isSale ? $currentSaleConsultantId : ($saleFilterId !== null ? $saleFilterId : (int) $decodedUser['id']);

        $search = trim($_GET['search'] ?? '');
        $roundFilter = isset($_GET['round_id']) && $_GET['round_id'] !== '' ? (int) $_GET['round_id'] : null;
        $saleFilterId = isset($_GET['sale_id']) && $_GET['sale_id'] !== '' ? (int) $_GET['sale_id'] : null;

        $dateMode = $_GET['date_mode'] ?? 'all';
        $startDate = $_GET['start_date'] ?? '';
        $endDate = $_GET['end_date'] ?? '';

        if ($isSale) {
            $where = ["dl.assigned_to = ?", "dl.status IN ('assigned', 'compensation', 'reminder', 'rule_6_month', 'pending_work_hours', 'fallback')"];
            $params = [$saleId];
            $types = "i";
        } else {
            $where = ["dl.status IN ('assigned', 'compensation', 'reminder', 'rule_6_month', 'pending_work_hours', 'fallback')"];
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

        $dateCondition = "1=1";
        if ($dateMode === 'today') {
            $dateCondition = "received_at >= CURDATE() AND received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        } elseif ($dateMode === 'this_week') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND received_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } elseif ($dateMode === 'last_week') {
            $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
        } elseif ($dateMode === 'two_weeks_ago') {
            $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } elseif ($dateMode === 'yesterday') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND received_at < CURDATE()";
        } elseif ($dateMode === '7_days') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } elseif ($dateMode === '30_days') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        } elseif ($dateMode === 'this_month') {
            $dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
        } elseif ($dateMode === 'last_month') {
            $dateCondition = "received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
        } elseif ($dateMode === 'this_year') {
            $dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')";
        } elseif ($dateMode === 'custom' && !empty($startDate) && !empty($endDate)) {
            $startEsc = $conn->real_escape_string($startDate);
            $endEsc = $conn->real_escape_string($endDate);
            $dateCondition = "received_at >= '$startEsc 00:00:00' AND received_at <= '$endEsc 23:59:59'";
        }

        $dateConditionDl = str_replace('received_at', 'dl.received_at', $dateCondition);
        $dateConditionSubQuery = $dateCondition;

        if ($dateConditionDl !== "1=1") {
            $where[] = $dateConditionDl;
        }

        $whereClause = implode(" AND ", $where);

        $page = isset($_GET['page']) ? (int) $_GET['page'] : 0;
        $pageSize = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : 50;

        // Count query for pagination support
        $sqlCount = "
            SELECT COUNT(*) as cnt
            FROM distribution_logs dl
            INNER JOIN (
                SELECT lead_id, MAX(id) as max_id 
                FROM distribution_logs 
                WHERE status != 'silent' AND $dateConditionSubQuery
                GROUP BY lead_id
            ) dl_max ON dl.id = dl_max.max_id
            JOIN leads l ON dl.lead_id = l.id
            WHERE $whereClause
        ";
        $totalCount = 0;
        $stmtCount = $conn->prepare($sqlCount);
        if ($stmtCount) {
            if (!empty($types)) {
                $stmtCount->bind_param($types, ...$params);
            }
            $stmtCount->execute();
            $totalCount = (int) ($stmtCount->get_result()->fetch_assoc()['cnt'] ?? 0);
            $stmtCount->close();
        }

        $limitStr = "";
        if ($page > 0) {
            $offset = ($page - 1) * $pageSize;
            $limitStr = "LIMIT $pageSize OFFSET $offset";
        }

        // 1. Query leads with date filter pushed down into the subquery and limits applied
        $sqlLeads = "
            SELECT dl.id as log_id, dl.received_at, dl.status, dl.message, dl.round_id, dl.assigned_to,
                   l.id as lead_id, l.name as lead_name, l.phone, l.email as lead_email, l.source, l.type, l.note,
                   l.is_accepted, l.accepted_at, l.last_interaction_date,
                   r.round_name,
                   c.name as sale_name, c.email as sale_email, c.avatar as sale_avatar,
                   dr.status as report_status, dr.id as report_id, dr.reason as report_reason, dr.reject_reason as report_reject_reason, dr.created_at as report_created_at,
                   IFNULL(sc.lead_recall_minutes, 0) as lead_recall_minutes,
                   sc.sheet_name as connection_name
            FROM distribution_logs dl
            INNER JOIN (
                SELECT lead_id, MAX(id) as max_id 
                FROM distribution_logs 
                WHERE status != 'silent' AND $dateConditionSubQuery
                GROUP BY lead_id
            ) dl_max ON dl.id = dl_max.max_id
            JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            LEFT JOIN (
                SELECT dr1.* FROM data_reports dr1
                INNER JOIN (
                    SELECT lead_id, consultant_id, MAX(id) as max_dr_id
                    FROM data_reports
                    GROUP BY lead_id, consultant_id
                ) dr2 ON dr1.id = dr2.max_dr_id
            ) dr ON dr.lead_id = l.id AND dr.consultant_id = dl.assigned_to
            WHERE $whereClause
            ORDER BY dl.received_at DESC
            $limitStr
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
            $today = date('Y-m-d');
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
                SUM(CASE WHEN status IN ('approved', 'approved_no_comp') THEN 1 ELSE 0 END) as approved,
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
        $whereClauseNoReminder = $whereClause . " AND dl.status != 'reminder'";
        $sqlByRound = "
            SELECT r.round_name, COUNT(dl.id) as count
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            JOIN distribution_rounds r ON dl.round_id = r.id
            WHERE $whereClauseNoReminder
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
            WHERE $whereClauseNoReminder
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
            $byHour[(int) $row['hr']] = (int) $row['count'];
        }
        $stmtBH->close();

        // 6. Query active consultants list if user is admin
        $consultantsList = [];
        if (!$isSale) {
            $resC = $conn->query("SELECT id, name, email, avatar FROM consultants WHERE status = 'active' ORDER BY name ASC");
            if ($resC) {
                while ($row = $resC->fetch_assoc()) {
                    $consultantsList[] = $row;
                }
            }
        }

        $vacationMode = 0;
        $targetVacationSaleId = $isSale ? $saleId : $saleFilterId;
        if ($targetVacationSaleId !== null) {
            $stmtV = $conn->prepare("SELECT vacation_mode FROM consultants WHERE id = ?");
            $stmtV->bind_param("i", $targetVacationSaleId);
            $stmtV->execute();
            $resV = $stmtV->get_result();
            if ($rowV = $resV->fetch_assoc()) {
                $vacationMode = (int) $rowV['vacation_mode'];
            }
            $stmtV->close();
        }

        $consultantProfile = null;
        $profileSaleId = $isSale ? $saleId : $saleFilterId;
        if ($profileSaleId !== null) {
            $stmtP = $conn->prepare("SELECT id, name, email, status, leave_start, leave_end, work_start_time, work_end_time, work_schedule, avatar, vacation_mode FROM consultants WHERE id = ?");
            $stmtP->bind_param("i", $profileSaleId);
            $stmtP->execute();
            $consultantProfile = $stmtP->get_result()->fetch_assoc();
            if ($consultantProfile) {
                if (!empty($consultantProfile['work_schedule'])) {
                    $consultantProfile['work_schedule'] = json_decode($consultantProfile['work_schedule'], true);
                }
            }
            $stmtP->close();
        }

        $isAllowedToReport = true;

        $leadRecallMinutes = (int) get_system_setting($conn, 'lead_recall_minutes');

        echo json_encode([
            'success' => true,
            'leads' => $leads,
            'total_count' => $totalCount,
            'rounds' => $rounds,
            'consultants' => $consultantsList,
            'consultant_profile' => $consultantProfile,
            'vacation_mode' => $vacationMode,
            'lead_recall_minutes' => $leadRecallMinutes,
            'below_standard_fallback_round_id' => (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_round_id'),
            'below_standard_fallback_round_ids' => getAllFallbackRoundIds($conn),
            'duplicate_check_months' => (int) get_system_setting($conn, 'duplicate_check_months') ?: 6,
            'report_error_reasons' => get_normalized_report_error_reasons($conn),
            'is_allowed_to_report' => true,
            'stats' => [
                'total_received' => count(array_filter($leads, function($l) { return $l['status'] !== 'reminder'; })),
                'tickets_total' => (int) ($ticketStats['total'] ?? 0),
                'tickets_approved' => (int) ($ticketStats['approved'] ?? 0),
                'tickets_rejected' => (int) ($ticketStats['rejected'] ?? 0),
                'tickets_pending' => (int) ($ticketStats['pending'] ?? 0)
            ],
            'by_round' => $byRound,
            'by_hour' => $byHour
        ]);
        break;

    case 'get_sale_lead_timeline':
        $isSale = $decodedUser['role'] === 'sale';
        $saleId = $isSale ? $currentSaleConsultantId : (int) $decodedUser['id'];
        $leadId = isset($_GET['lead_id']) ? (int) $_GET['lead_id'] : 0;

        if (empty($leadId)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu lead_id']);
            break;
        }

        // Security check for sale role: did this sale receive this lead?
        if ($isSale) {
            $stmtCheck = $conn->prepare("
                SELECT 1 
                FROM distribution_logs 
                WHERE lead_id = ? AND assigned_to = ? AND status IN ('assigned', 'compensation', 'reminder', 'rule_6_month', 'pending_work_hours', 'fallback') 
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
        } else if ($date === 'this_week' || $date === 'Tuần này') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND dl.received_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === 'last_week' || $date === 'Tuần trước') {
            $dateCondition = "dl.received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND dl.received_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
        } else if ($date === 'two_weeks_ago' || $date === 'Tuần trước nữa') {
            $dateCondition = "dl.received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND dl.received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
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

        $dateConditionSubQuery = str_replace('dl.received_at', 'received_at', $dateCondition);

        $extraCondition = "1=1";
        $isFilteringActive = false;

        if (isset($_GET['status']) && $_GET['status'] !== 'all') {
            $statusInput = $_GET['status'];
            if (strpos($statusInput, ',') !== false) {
                $statuses = explode(',', $statusInput);
                $escapedStatuses = array_map(function ($s) use ($conn) {
                    return "'" . $conn->real_escape_string(trim($s)) . "'";
                }, $statuses);
                $extraCondition .= " AND dl.status IN (" . implode(',', $escapedStatuses) . ")";
            } else {
                $status = $conn->real_escape_string($statusInput);
                $extraCondition .= " AND dl.status = '$status'";
            }
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
            INNER JOIN (
                SELECT lead_id, MAX(id) as max_id 
                FROM distribution_logs 
                WHERE status != 'silent' AND $dateConditionSubQuery
                GROUP BY lead_id
            ) dl_max ON dl.id = dl_max.max_id
            $joinLeads 
            $joinConsultants
            $joinRounds
            WHERE $dateCondition AND $extraCondition
        ");
        $totalCount = (int) ($countRes->fetch_assoc()['cnt'] ?? 0);

        // Check for pagination
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : 50;
        if ($page < 1)
            $page = 1;
        if ($pageSize < 1)
            $pageSize = 50;
        $offset = ($page - 1) * $pageSize;

        if (!isset($_GET['page'])) {
            $LIMIT = 500;
            if (isset($_GET['limit']) && $_GET['limit'] === 'all' && isset($decodedUser) && ($decodedUser['role'] === 'admin' || $decodedUser['role'] === 'superadmin')) {
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
                dl.lead_id,
                l.name as lead_name, 
                l.phone, 
                l.email, 
                l.source, 
                l.type,
                l.note,
                l.ai_screener_status,
                l.ai_evaluation,
                dl.status, 
                c.name as assigned_to_name, 
                c.avatar as assigned_to_avatar, 
                dr.round_name, 
                dl.received_at as created_at,
                r.status as report_status,
                r.resolved_by,
                r.resolved_at,
                p.is_public as is_public,
                p.id as person_id,
                (SELECT MAX(received_at) FROM distribution_logs WHERE lead_id = dl.lead_id AND id < dl.id) as last_activity_at
            FROM distribution_logs dl
            INNER JOIN (
                SELECT lead_id, MAX(id) as max_id 
                FROM distribution_logs 
                WHERE status != 'silent' AND $dateConditionSubQuery
                GROUP BY lead_id
            ) dl_max ON dl.id = dl_max.max_id
            LEFT JOIN leads l ON dl.lead_id = l.id
            LEFT JOIN persons p ON l.person_id = p.id
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
            LEFT JOIN (
                SELECT r1.* FROM data_reports r1
                INNER JOIN (
                    SELECT lead_id, consultant_id, round_id, MAX(id) as max_r_id
                    FROM data_reports
                    GROUP BY lead_id, consultant_id, round_id
                ) r2 ON r1.id = r2.max_r_id
            ) r ON r.lead_id = dl.lead_id AND r.consultant_id = dl.assigned_to AND r.round_id = dl.round_id
            WHERE $dateCondition AND $extraCondition
            ORDER BY dl.received_at DESC 
            $limitStr
        ");
        $data = [];
        while ($row = $res->fetch_assoc()) {
            $personId = isset($row['person_id']) ? (int)$row['person_id'] : 0;
            $takers = [];
            if ($personId > 0) {
                $tQuery = "SELECT c.owner_id as id, cons.name, cons.avatar 
                           FROM contacts c
                           JOIN consultants cons ON c.owner_id = cons.id
                           WHERE c.person_id = ? AND c.deleted_at IS NULL";
                $tStmt = $conn->prepare($tQuery);
                $tStmt->bind_param("i", $personId);
                $tStmt->execute();
                $tRes = $tStmt->get_result();
                while ($tRow = $tRes->fetch_assoc()) {
                    $takers[] = $tRow;
                }
                $tStmt->close();
            }
            $row['takers'] = $takers;
            $data[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $data, 'total_count' => $totalCount, 'limit' => $responseLimit]);
        break;

    case 'get_lead_notification_status':
        if (!isset($decodedUser) || !$decodedUser) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            break;
        }

        $leadId = isset($_GET['lead_id']) ? (int) $_GET['lead_id'] : 0;
        if ($leadId <= 0) {
            echo json_encode(['success' => false, 'message' => 'Lead ID không hợp lệ']);
            break;
        }

        // Fetch lead details including direct notify status columns
        $leadStmt = $conn->prepare("SELECT l.id, l.name, l.phone, l.email, l.assigned_to, l.created_at, l.zalo_notify_status, l.email_notify_status, l.zalo_notify_sent_at, l.email_notify_sent_at FROM leads l WHERE l.id = ? LIMIT 1");
        $leadStmt->bind_param("i", $leadId);
        $leadStmt->execute();
        $lead = $leadStmt->get_result()->fetch_assoc();
        $leadStmt->close();

        if (!$lead) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy khách hàng']);
            break;
        }

        // If user is a sale, check if they own the lead
        if ($decodedUser['role'] === 'sale') {
            $saleStmt = $conn->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
            $saleStmt->bind_param("s", $decodedUser['email']);
            $saleStmt->execute();
            $sRow = $saleStmt->get_result()->fetch_assoc();
            $saleStmt->close();

            if (!$sRow || (int)$lead['assigned_to'] !== (int)$sRow['id']) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Bạn không có quyền xem thông tin khách hàng này']);
                break;
            }
        }

        $assignedTo = $lead['assigned_to'];
        $saleZaloId = '';
        $saleEmail = '';

        if ($assignedTo) {
            $saleStmt = $conn->prepare("SELECT email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $saleStmt->bind_param("i", $assignedTo);
            $saleStmt->execute();
            $sRow = $saleStmt->get_result()->fetch_assoc();
            if ($sRow) {
                $saleEmail = $sRow['email'] ?? '';
                $saleZaloId = $sRow['zalo_chat_id'] ?? '';
            }
            $saleStmt->close();
        }

        // Extract statuses from lead
        $zaloNotifyStatus = $lead['zalo_notify_status'] ?? 'none';
        $emailNotifyStatus = $lead['email_notify_status'] ?? 'none';

        // Map Email
        $mailQueued = ($emailNotifyStatus !== 'none');
        $mailFinalStatus = $mailQueued ? $emailNotifyStatus : 'missed';

        // Map Zalo
        $zaloQueued = ($zaloNotifyStatus !== 'none');
        if (!$zaloQueued && empty($saleZaloId)) {
            $zaloFinalStatus = 'no_zalo_config';
        } else if ($zaloQueued) {
            $zaloFinalStatus = $zaloNotifyStatus;
        } else {
            $zaloFinalStatus = 'missed';
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'lead_id' => $leadId,
                'email' => [
                    'queued' => $mailQueued,
                    'status' => $mailFinalStatus,
                    'id' => null, // no longer query database queue primary keys
                    'target' => $saleEmail,
                    'sent_at' => $lead['email_notify_sent_at'] ? date('Y-m-d H:i:s', strtotime($lead['email_notify_sent_at'])) : null
                ],
                'zalo' => [
                    'queued' => $zaloQueued,
                    'status' => $zaloFinalStatus,
                    'id' => null,
                    'target' => $saleZaloId,
                    'sent_at' => $lead['zalo_notify_sent_at'] ? date('Y-m-d H:i:s', strtotime($lead['zalo_notify_sent_at'])) : null
                ]
            ]
        ]);
        break;

    case 'get_calendar_stats':
        if (!isset($decodedUser) || !$decodedUser) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            break;
        }

        $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');
        $month = isset($_GET['month']) ? (int) $_GET['month'] : (int) date('m');

        if ($month < 1 || $month > 12) {
            $month = (int) date('m');
        }
        if ($year < 2000 || $year > 2100) {
            $year = (int) date('Y');
        }

        // Format dates
        $daysInMonth = (int) date('t', strtotime(sprintf("%04d-%02d-01", $year, $month)));
        $startDate = sprintf("%04d-%02d-01 00:00:00", $year, $month);
        $endDate = sprintf("%04d-%02d-%02d 23:59:59", $year, $month, $daysInMonth);

        $consultantFilter = '';
        if (isset($_GET['consultant']) && $_GET['consultant'] !== 'all') {
            $consultant = $conn->real_escape_string($_GET['consultant']);
            $consultantFilter = " AND c.name = '$consultant'";
        }

        $joinQuery = "";
        $whereClause = "dl.received_at >= '$startDate' AND dl.received_at <= '$endDate' AND dl.status != 'silent'";
        if (!empty($consultantFilter)) {
            $joinQuery = " LEFT JOIN consultants c ON dl.assigned_to = c.id ";
            $whereClause .= $consultantFilter;
        }

        // 1. Get distribution logs count per day
        $distRes = $conn->query("
            SELECT 
                DATE(dl.received_at) as date_str,
                SUM(CASE WHEN dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours') THEN 1 ELSE 0 END) as distributed,
                SUM(CASE WHEN dl.status = 'blacklisted' THEN 1 ELSE 0 END) as blacklist,
                SUM(CASE WHEN dl.status = 'reminder' THEN 1 ELSE 0 END) as reminder,
                SUM(CASE WHEN dl.status IN ('error', 'no_consultant') THEN 1 ELSE 0 END) as error,
                COUNT(*) as total
            FROM distribution_logs dl
            $joinQuery
            WHERE $whereClause
            GROUP BY DATE(dl.received_at)
        ");

        $stats = [];
        if ($distRes) {
            while ($row = $distRes->fetch_assoc()) {
                $d = $row['date_str'];
                $stats[$d] = [
                    'distributed' => (int) $row['distributed'],
                    'blacklist' => (int) $row['blacklist'],
                    'reminder' => (int) $row['reminder'],
                    'error' => (int) $row['error'],
                    'total' => (int) $row['total'],
                    'ticket_total' => 0,
                    'ticket_approved' => 0
                ];
            }
        }

        $ticketJoinQuery = "";
        $ticketWhereClause = "t.created_at >= '$startDate' AND t.created_at <= '$endDate'";
        if (!empty($consultantFilter)) {
            $ticketJoinQuery = " LEFT JOIN consultants c ON t.consultant_id = c.id ";
            $ticketWhereClause .= " AND c.name = '$consultant'";
        }

        // 2. Get tickets count per day
        $ticketRes = $conn->query("
            SELECT 
                DATE(t.created_at) as date_str,
                COUNT(*) as ticket_total,
                SUM(CASE WHEN t.status IN ('approved', 'approved_no_comp') THEN 1 ELSE 0 END) as ticket_approved
            FROM data_reports t
            $ticketJoinQuery
            WHERE $ticketWhereClause
            GROUP BY DATE(t.created_at)
        ");

        if ($ticketRes) {
            while ($row = $ticketRes->fetch_assoc()) {
                $d = $row['date_str'];
                if (!isset($stats[$d])) {
                    $stats[$d] = [
                        'distributed' => 0,
                        'blacklist' => 0,
                        'reminder' => 0,
                        'error' => 0,
                        'total' => 0,
                        'ticket_total' => 0,
                        'ticket_approved' => 0
                    ];
                }
                $stats[$d]['ticket_total'] = (int) $row['ticket_total'];
                $stats[$d]['ticket_approved'] = (int) $row['ticket_approved'];
            }
        }

        echo json_encode(['success' => true, 'data' => $stats]);
        break;

    case 'get_calendar_day_details':
        if (!isset($decodedUser) || !$decodedUser) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            break;
        }

        $date = $_GET['date'] ?? '';
        if (empty($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            echo json_encode(['success' => false, 'message' => 'Ngày không hợp lệ']);
            break;
        }

        $escapedDate = $conn->real_escape_string($date);

        $consultantFilter = '';
        if (isset($_GET['consultant']) && $_GET['consultant'] !== 'all') {
            $consultant = $conn->real_escape_string($_GET['consultant']);
            $consultantFilter = " AND c.name = '$consultant'";
        }

        // a) Sale distribution statistics
        $salesRes = $conn->query("
            SELECT 
                c.name as sale_name, 
                c.avatar as sale_avatar, 
                dr.round_name,
                dl.status,
                COUNT(*) as cnt
            FROM distribution_logs dl
            LEFT JOIN consultants c ON dl.assigned_to = c.id
            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
            WHERE DATE(dl.received_at) = '$escapedDate' AND dl.status != 'silent' $consultantFilter
            GROUP BY dl.assigned_to, dl.round_id, dl.status
        ");

        $sales = [];
        if ($salesRes) {
            while ($row = $salesRes->fetch_assoc()) {
                $sales[] = [
                    'sale_name' => $row['sale_name'] ?: 'Chưa phân bổ',
                    'sale_avatar' => $row['sale_avatar'],
                    'round_name' => $row['round_name'] ?: '-',
                    'status' => $row['status'],
                    'count' => (int) $row['cnt']
                ];
            }
        }

        // b) Ticket details
        $ticketsRes = $conn->query("
            SELECT 
                r.id, 
                l.name as lead_name, 
                l.phone, 
                c.name as sale_name, 
                c.avatar as sale_avatar, 
                r.reason, 
                r.status, 
                r.created_at,
                l.ai_screener_status
            FROM data_reports r
            LEFT JOIN leads l ON r.lead_id = l.id
            LEFT JOIN consultants c ON r.consultant_id = c.id
            WHERE DATE(r.created_at) = '$escapedDate' $consultantFilter
        ");

        $tickets = [];
        if ($ticketsRes) {
            while ($row = $ticketsRes->fetch_assoc()) {
                $tickets[] = [
                    'id' => (int) $row['id'],
                    'lead_name' => $row['lead_name'] ?: 'Ẩn danh',
                    'phone' => $row['phone'] ?: '-',
                    'sale_name' => $row['sale_name'] ?: '-',
                    'sale_avatar' => $row['sale_avatar'],
                    'reason' => $row['reason'],
                    'status' => $row['status'],
                    'created_at' => $row['created_at'],
                    'ai_screener_status' => $row['ai_screener_status']
                ];
            }
        }

        // c) Blacklist & error logs
        $blacklistJoin = "";
        $blacklistFilter = "";
        if (!empty($consultantFilter)) {
            $blacklistJoin = " LEFT JOIN consultants c ON dl.assigned_to = c.id ";
            $blacklistFilter = $consultantFilter;
        }

        $blacklistRes = $conn->query("
            SELECT 
                dl.id,
                l.name as lead_name,
                l.phone,
                l.email,
                dl.status,
                dl.message,
                dl.received_at,
                l.ai_screener_status
            FROM distribution_logs dl
            LEFT JOIN leads l ON dl.lead_id = l.id
            $blacklistJoin
            WHERE DATE(dl.received_at) = '$escapedDate' AND dl.status IN ('blacklisted', 'error', 'no_consultant', 'reminder', 'duplicate') $blacklistFilter
        ");

        $blacklistLogs = [];
        if ($blacklistRes) {
            while ($row = $blacklistRes->fetch_assoc()) {
                $blacklistLogs[] = [
                    'id' => (int) $row['id'],
                    'lead_name' => $row['lead_name'] ?: 'Ẩn danh',
                    'phone' => $row['phone'] ?: '-',
                    'email' => $row['email'] ?: '-',
                    'status' => $row['status'],
                    'message' => $row['message'],
                    'received_at' => $row['received_at'],
                    'ai_screener_status' => $row['ai_screener_status']
                ];
            }
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'sales' => $sales,
                'tickets' => $tickets,
                'blacklist_logs' => $blacklistLogs
            ]
        ]);
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
        } else if ($date === 'this_week' || $date === 'Tuần này') {
            $dateCondition = "dl.received_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND dl.received_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === 'last_week' || $date === 'Tuần trước') {
            $dateCondition = "dl.received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND dl.received_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
        } else if ($date === 'two_weeks_ago' || $date === 'Tuần trước nữa') {
            $dateCondition = "dl.received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND dl.received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
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
            if (strpos($statusFilter, ',') !== false) {
                $statuses = explode(',', $statusFilter);
                $escapedStatuses = array_map(function ($s) use ($conn) {
                    return "'" . $conn->real_escape_string(trim($s)) . "'";
                }, $statuses);
                $sqlFilters .= " AND dl.status IN (" . implode(',', $escapedStatuses) . ")";
            } else {
                $sqlFilters .= " AND dl.status = '" . $conn->real_escape_string($statusFilter) . "'";
            }
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
        $res = $conn->query("
            SELECT c.*, t.name as team_name, t.branch as team_branch 
            FROM consultants c 
            LEFT JOIN teams t ON c.team_id = t.id 
            ORDER BY c.created_at DESC
        ");
        $data = [];
        while ($row = $res->fetch_assoc()) {
            if (isset($row['work_schedule']) && $row['work_schedule'] !== null) {
                $row['work_schedule'] = json_decode($row['work_schedule'], true);
            }
            $data[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'upload_avatar':
        try {
            if (!isset($_FILES['avatar'])) {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy file tải lên']);
                break;
            }

            $file = $_FILES['avatar'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'message' => 'Lỗi tải file lên: ' . $file['error']]);
                break;
            }

            // Validate file type
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

            // 1. Validate file extension strictly
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (empty($extension)) {
                // Fallback extension based on mime type
                $mimeToExt = [
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/gif' => 'gif',
                    'image/webp' => 'webp'
                ];
                $extension = $mimeToExt[$file['type']] ?? 'jpg';
            }
            if (!in_array($extension, $allowedExtensions)) {
                echo json_encode(['success' => false, 'message' => 'Định dạng đuôi file không hợp lệ. Chỉ chấp nhận JPG, PNG, GIF, WEBP.']);
                break;
            }

            // 2. Validate real MIME type (prevent Content-Type spoofing)
            $imageInfo = getimagesize($file['tmp_name']);
            if ($imageInfo === false) {
                echo json_encode(['success' => false, 'message' => 'File tải lên không phải là ảnh hợp lệ.']);
                break;
            }
            $realMime = $imageInfo['mime'];
            if (!in_array($realMime, $allowedTypes)) {
                echo json_encode(['success' => false, 'message' => 'Nội dung định dạng file không hợp lệ. Chỉ chấp nhận JPG, PNG, GIF, WEBP.']);
                break;
            }

            // Validate file size (max 5MB)
            if ($file['size'] > 5 * 1024 * 1024) {
                echo json_encode(['success' => false, 'message' => 'Kích thước file quá lớn (tối đa 5MB)']);
                break;
            }

            // Ensure upload directory exists
            $uploadDir = __DIR__ . '/uploads/avatars/';
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            $newFilename = 'avatar_' . uniqid() . '.' . $extension;
            $destination = $uploadDir . $newFilename;

            if (move_uploaded_file($file['tmp_name'], $destination)) {
                $relativeUrl = 'uploads/avatars/' . $newFilename;

                // Xóa ảnh cũ nếu có
                $oldAvatar = $_GET['old_avatar'] ?? '';
                if (!empty($oldAvatar)) {
                    $oldFilename = basename($oldAvatar);
                    if ($oldFilename && preg_match('/^avatar_[0-9a-f]+\.(jpg|jpeg|png|gif|webp)$/i', $oldFilename)) {
                        $oldFilePath = $uploadDir . $oldFilename;
                        if (file_exists($oldFilePath) && is_file($oldFilePath)) {
                            unlink($oldFilePath);
                        }
                    }
                }

                echo json_encode(['success' => true, 'url' => $relativeUrl]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Không thể lưu file trên máy chủ']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'add_consultant':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $name = trim($input['name'] ?? '');
            $email = trim($input['email'] ?? '');
            $status = $input['status'] ?? 'active';
            $zalo_chat_id = trim($input['zalo_chat_id'] ?? '');
            $avatar = trim($input['avatar'] ?? '');
            if ($avatar === '')
                $avatar = null;
            $team_id = !empty($input['team_id']) ? (int)$input['team_id'] : null;

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
            if (empty($work_start_time) || !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $work_start_time)) {
                echo json_encode(['success' => false, 'message' => 'Giờ bắt đầu làm việc không hợp lệ (định dạng HH:MM từ 00:00 đến 23:59)']);
                break;
            }
            if (empty($work_end_time) || !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $work_end_time)) {
                echo json_encode(['success' => false, 'message' => 'Giờ kết thúc làm việc không hợp lệ (định dạng HH:MM từ 00:00 đến 23:59)']);
                break;
            }
            $work_schedule = isset($input['work_schedule']) ? (is_array($input['work_schedule']) ? json_encode($input['work_schedule']) : $input['work_schedule']) : null;
            if ($work_schedule !== null && !validateWorkSchedule($work_schedule)) {
                echo json_encode(['success' => false, 'message' => 'Cấu hình lịch làm việc chi tiết không hợp lệ.']);
                break;
            }

            $dob = !empty($input['dob']) ? $input['dob'] : null;
            $gender = !empty($input['gender']) ? $input['gender'] : null;
            $citizen_id = !empty($input['citizen_id']) ? $input['citizen_id'] : null;
            $address = !empty($input['address']) ? $input['address'] : null;
            $bank_name = !empty($input['bank_name']) ? $input['bank_name'] : null;
            $bank_account = !empty($input['bank_account']) ? $input['bank_account'] : null;

            $stmt = $conn->prepare("INSERT INTO consultants (name, email, status, zalo_chat_id, work_start_time, work_end_time, work_schedule, avatar, team_id, dob, gender, citizen_id, address, bank_name, bank_account) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssssssissssss", $name, $email, $status, $zalo_chat_id, $work_start_time, $work_end_time, $work_schedule, $avatar, $team_id, $dob, $gender, $citizen_id, $address, $bank_name, $bank_account);
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

            // Auto-clear past/stale leave dates when setting status to active or inactive
            if ($status === 'active' || $status === 'inactive') {
                $today = date('Y-m-d');
                if (empty($leave_start) || $leave_start <= $today || $status === 'inactive') {
                    $leave_start = null;
                    $leave_end = null;
                }
            }
            $zalo_chat_id = !empty($input['zalo_chat_id']) ? trim($input['zalo_chat_id']) : null;
            $avatar = isset($input['avatar']) ? trim($input['avatar']) : null;
            if ($avatar === '')
                $avatar = null;
            $team_id = !empty($input['team_id']) ? (int)$input['team_id'] : null;

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
            if (empty($work_start_time) || !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $work_start_time)) {
                echo json_encode(['success' => false, 'message' => 'Giờ bắt đầu làm việc không hợp lệ (định dạng HH:MM từ 00:00 đến 23:59)']);
                break;
            }
            if (empty($work_end_time) || !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $work_end_time)) {
                echo json_encode(['success' => false, 'message' => 'Giờ kết thúc làm việc không hợp lệ (định dạng HH:MM từ 00:00 đến 23:59)']);
                break;
            }
            $work_schedule = isset($input['work_schedule']) ? (is_array($input['work_schedule']) ? json_encode($input['work_schedule']) : $input['work_schedule']) : null;
            if ($work_schedule !== null && !validateWorkSchedule($work_schedule)) {
                echo json_encode(['success' => false, 'message' => 'Cấu hình lịch làm việc chi tiết không hợp lệ.']);
                break;
            }

            if ($status === 'inactive' || $status === 'leave') {
                $fallbackRounds = getSystemFallbackRoundIds($conn);
                if (!empty($fallbackRounds)) {
                    $inRounds = implode(',', array_map('intval', $fallbackRounds));
                    $stmtF = $conn->prepare("SELECT rc.round_id, r.round_name FROM round_consultants rc JOIN distribution_rounds r ON rc.round_id = r.id WHERE rc.consultant_id = ? AND rc.round_id IN ($inRounds)");
                    $stmtF->bind_param("i", $id);
                    $stmtF->execute();
                    $resF = $stmtF->get_result();
                    while ($rowF = $resF->fetch_assoc()) {
                        $rId = $rowF['round_id'];
                        $rName = $rowF['round_name'];

                        $stmtOther = $conn->prepare("
                            SELECT COUNT(*) as cnt 
                            FROM round_consultants rc 
                            JOIN consultants c ON rc.consultant_id = c.id 
                            WHERE rc.round_id = ? AND rc.consultant_id != ? AND c.status = 'active'
                        ");
                        $stmtOther->bind_param("ii", $rId, $id);
                        $stmtOther->execute();
                        $otherActiveCount = (int) ($stmtOther->get_result()->fetch_assoc()['cnt'] ?? 0);
                        $stmtOther->close();

                        if ($otherActiveCount === 0) {
                            throw new Exception("Không thể ngưng hoạt động hoặc cho tạm nghỉ TVV này vì họ là người hoạt động duy nhất trong vòng dự phòng (fallback): $rName.");
                        }
                    }
                    $stmtF->close();
                }
            }

            $dob = !empty($input['dob']) ? $input['dob'] : null;
            $gender = !empty($input['gender']) ? $input['gender'] : null;
            $citizen_id = !empty($input['citizen_id']) ? $input['citizen_id'] : null;
            $address = !empty($input['address']) ? $input['address'] : null;
            $bank_name = !empty($input['bank_name']) ? $input['bank_name'] : null;
            $bank_account = !empty($input['bank_account']) ? $input['bank_account'] : null;

            // Fetch old consultant state for audit log rollback support
            $oldRes = $conn->query("SELECT name, email, status, leave_start, leave_end, zalo_chat_id, work_start_time, work_end_time, work_schedule, avatar, team_id, dob, gender, citizen_id, address, bank_name, bank_account FROM consultants WHERE id = " . $id);
            $oldData = $oldRes ? $oldRes->fetch_assoc() : null;

            $stmt = $conn->prepare("UPDATE consultants SET name=?, email=?, status=?, leave_start=?, leave_end=?, zalo_chat_id=?, work_start_time=?, work_end_time=?, work_schedule=?, avatar=?, team_id=?, dob=?, gender=?, citizen_id=?, address=?, bank_name=?, bank_account=? WHERE id=?");
            $stmt->bind_param("ssssssssssissssssi", $name, $email, $status, $leave_start, $leave_end, $zalo_chat_id, $work_start_time, $work_end_time, $work_schedule, $avatar, $team_id, $dob, $gender, $citizen_id, $address, $bank_name, $bank_account, $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'EDIT_CONSULTANT', [
                    'id' => $id,
                    'old' => $oldData,
                    'new' => [
                        'name' => $name,
                        'email' => $email,
                        'status' => $status,
                        'leave_start' => $leave_start,
                        'leave_end' => $leave_end,
                        'zalo_chat_id' => $zalo_chat_id,
                        'work_start_time' => $work_start_time,
                        'work_end_time' => $work_end_time,
                        'work_schedule' => $work_schedule,
                        'avatar' => $avatar
                    ]
                ]);
            }
            $stmt->close();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'toggle_consultant_vacation':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($input['id'] ?? 0);

            // If logged in as sale, override ID to their own consultant record
            if ($decodedUser['role'] === 'sale') {
                $id = $currentSaleConsultantId;
            }

            if (!$id) {
                echo json_encode(['success' => false, 'message' => 'ID không hợp lệ']);
                break;
            }

            // Get current vacation mode
            $stmt = $conn->prepare("SELECT vacation_mode, name FROM consultants WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res->num_rows === 0) {
                $stmt->close();
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy tư vấn viên']);
                break;
            }
            $row = $res->fetch_assoc();
            $stmt->close();

            $newVacationMode = $row['vacation_mode'] ? 0 : 1;

            $stmtUp = $conn->prepare("UPDATE consultants SET vacation_mode = ? WHERE id = ?");
            $stmtUp->bind_param("ii", $newVacationMode, $id);
            $stmtUp->execute();
            $stmtUp->close();

            if ($decodedUser['role'] === 'admin' || $decodedUser['role'] === 'superadmin') {
                logAdminAction($conn, $decodedUser['id'], 'TOGGLE_CONSULTANT_VACATION', ['id' => $id, 'name' => $row['name'], 'vacation_mode' => $newVacationMode]);
            }

            if ($newVacationMode === 1) {
                // Gửi Zalo thông báo tới toàn bộ admin khi sale tắt nhận data
                $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';
                if (!empty($botToken)) {
                    require_once __DIR__ . '/zalo_bot.php';
                    $allAdmins = getTicketNotifyAdmins($conn);
                    $adminChatIds = [];
                    foreach ($allAdmins as $adm) {
                        if (!empty($adm['zalo_chat_id'])) {
                            $adminChatIds[] = $adm['zalo_chat_id'];
                        }
                    }
                    if (!empty($adminChatIds)) {
                        $saleName = $row['name'];
                        $operatorName = $decodedUser['name'] ?? 'Hệ thống';
                        $operatorRole = $decodedUser['role'] ?? '';
                        if ($operatorRole === 'admin' || $operatorRole === 'superadmin') {
                            $zaloMsg = "[ ADMIN TẠM NGƯNG SALE ]\n\n"
                                . "Admin $operatorName vừa TẠM NGƯNG nhận data cho Tư vấn viên:\n"
                                . "  • Tên TVV: $saleName\n"
                                . "  • ID TVV: $id\n"
                                . "  • Thời gian: " . date('Y-m-d H:i:s');
                        } else {
                            $zaloMsg = "[ CẢNH BÁO TẠM NGƯNG ]\n\n"
                                . "Tư vấn viên $saleName tự TẮT nhận data (Tạm ngưng):\n"
                                . "  • Tên TVV: $saleName\n"
                                . "  • ID TVV: $id\n"
                                . "  • Thời gian: " . date('Y-m-d H:i:s') . "\n\n"
                                . "⚠️ Vui lòng lưu ý để điều chỉnh nếu cần thiết.";
                        }
                        try {
                            sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloMsg, false);
                        } catch (Exception $zEx) {
                            error_log("Error sending toggle vacation Zalo warning: " . $zEx->getMessage());
                        }
                    }
                }
            }

            echo json_encode(['success' => true, 'vacation_mode' => $newVacationMode]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'accept_lead':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $lead_id = (int) ($input['lead_id'] ?? 0);

            if (!$lead_id) {
                echo json_encode(['success' => false, 'message' => 'ID Lead không hợp lệ']);
                break;
            }

            $conn->begin_transaction();

            // Lock the lead row for update to prevent race conditions with recall cron
            $stmtChk = $conn->prepare("SELECT assigned_to, is_accepted FROM leads WHERE id = ? FOR UPDATE");
            $stmtChk->bind_param("i", $lead_id);
            $stmtChk->execute();
            $resChk = $stmtChk->get_result()->fetch_assoc();
            $stmtChk->close();

            if (!$resChk) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy Lead']);
                break;
            }

            if ((int)$resChk['is_accepted'] === 1) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => 'Lead này đã được tiếp nhận trước đó']);
                break;
            }

            // If logged in as sale, verify the lead is assigned to them
            if ($decodedUser['role'] === 'sale') {
                $sale_id = $currentSaleConsultantId;
                if ((int)$resChk['assigned_to'] !== $sale_id) {
                    $conn->rollback();
                    echo json_encode(['success' => false, 'message' => 'Bạn không được phép tiếp nhận Lead này']);
                    break;
                }
            }

            $stmtUp = $conn->prepare("UPDATE leads SET is_accepted = 1, accepted_at = NOW() WHERE id = ?");
            $stmtUp->bind_param("i", $lead_id);
            $stmtUp->execute();
            $stmtUp->close();

            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
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

            $fallbackRounds = getSystemFallbackRoundIds($conn);
            if (!empty($fallbackRounds)) {
                $inRounds = implode(',', array_map('intval', $fallbackRounds));
                $stmtF = $conn->prepare("SELECT rc.round_id, r.round_name FROM round_consultants rc JOIN distribution_rounds r ON rc.round_id = r.id WHERE rc.consultant_id = ? AND rc.round_id IN ($inRounds)");
                $stmtF->bind_param("i", $id);
                $stmtF->execute();
                $resF = $stmtF->get_result();
                while ($rowF = $resF->fetch_assoc()) {
                    $rId = $rowF['round_id'];
                    $rName = $rowF['round_name'];

                    $stmtOther = $conn->prepare("
                        SELECT COUNT(*) as cnt 
                        FROM round_consultants rc 
                        JOIN consultants c ON rc.consultant_id = c.id 
                        WHERE rc.round_id = ? AND rc.consultant_id != ? AND c.status = 'active'
                    ");
                    $stmtOther->bind_param("ii", $rId, $id);
                    $stmtOther->execute();
                    $otherActiveCount = (int) ($stmtOther->get_result()->fetch_assoc()['cnt'] ?? 0);
                    $stmtOther->close();

                    if ($otherActiveCount === 0) {
                        throw new Exception("Không thể xóa TVV này vì họ là người hoạt động duy nhất trong vòng dự phòng (fallback): $rName.");
                    }
                }
                $stmtF->close();
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

    case 'get_consultant_stats':
        $consultantId = isset($_GET['consultant_id']) ? (int) $_GET['consultant_id'] : 0;
        if (empty($consultantId)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu consultant_id']);
            break;
        }

        $dateMode = $_GET['date_mode'] ?? 'all';
        $startDate = $_GET['start_date'] ?? '';
        $endDate = $_GET['end_date'] ?? '';

        $today = date('Y-m-d');
        $dateCondition = "1=1";
        $params = [];
        $types = "";

        if ($dateMode === 'today') {
            $dateCondition = "dl.received_at >= ? AND dl.received_at <= ?";
            $params[] = $today . ' 00:00:00';
            $params[] = $today . ' 23:59:59';
            $types .= "ss";
        } elseif ($dateMode === 'yesterday') {
            $yesterday = date('Y-m-d', strtotime('-1 day'));
            $dateCondition = "dl.received_at >= ? AND dl.received_at <= ?";
            $params[] = $yesterday . ' 00:00:00';
            $params[] = $yesterday . ' 23:59:59';
            $types .= "ss";
        } elseif ($dateMode === '7_days') {
            $dateCondition = "dl.received_at >= ?";
            $params[] = date('Y-m-d', strtotime('-7 days')) . ' 00:00:00';
            $types .= "s";
        } elseif ($dateMode === '30_days') {
            $dateCondition = "dl.received_at >= ?";
            $params[] = date('Y-m-d', strtotime('-30 days')) . ' 00:00:00';
            $types .= "s";
        } elseif ($dateMode === 'this_month') {
            $dateCondition = "dl.received_at >= ?";
            $params[] = date('Y-m-01') . ' 00:00:00';
            $types .= "s";
        } elseif ($dateMode === 'last_month') {
            $dateCondition = "dl.received_at >= ? AND dl.received_at < ?";
            $params[] = date('Y-m-01', strtotime('first day of last month')) . ' 00:00:00';
            $params[] = date('Y-m-01') . ' 00:00:00';
            $types .= "ss";
        } elseif ($dateMode === 'custom' && !empty($startDate) && !empty($endDate)) {
            $dateCondition = "dl.received_at >= ? AND dl.received_at <= ?";
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
            $types .= "ss";
        }

        $statsTypes = "i" . $types;
        $statsParams = array_merge([$consultantId], $params);
        // 1. Summary stats
        $systemTotalSuccessful = 0;
        $sqlSystemStats = "
            SELECT COUNT(*) as system_successful
            FROM distribution_logs dl
            WHERE dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours') AND $dateCondition
        ";
        $stmtSystem = $conn->prepare($sqlSystemStats);
        if ($stmtSystem) {
            if (!empty($types)) {
                $stmtSystem->bind_param($types, ...$params);
            }
            $stmtSystem->execute();
            $systemRaw = $stmtSystem->get_result()->fetch_assoc();
            $systemTotalSuccessful = (int) ($systemRaw['system_successful'] ?? 0);
            $stmtSystem->close();
        }

        $sqlStats = "
            SELECT 
                SUM(CASE WHEN status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours') THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'reminder' THEN 1 ELSE 0 END) as reminder,
                SUM(CASE WHEN status IN ('duplicate', 'error', 'no_consultant', 'blacklisted') THEN 1 ELSE 0 END) as error,
                SUM(CASE WHEN status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'reminder', 'duplicate', 'error', 'no_consultant', 'blacklisted') THEN 1 ELSE 0 END) as total
            FROM distribution_logs dl
            WHERE dl.assigned_to = ? AND $dateCondition
        ";
        $stmtStats = $conn->prepare($sqlStats);
        if ($stmtStats) {
            if (!empty($statsTypes)) {
                $stmtStats->bind_param($statsTypes, ...$statsParams);
            }
            $stmtStats->execute();
            $summaryRaw = $stmtStats->get_result()->fetch_assoc();
            $stmtStats->close();

            $summary = [
                'total' => (int) ($summaryRaw['total'] ?? 0),
                'successful' => (int) ($summaryRaw['successful'] ?? 0),
                'reminder' => (int) ($summaryRaw['reminder'] ?? 0),
                'error' => (int) ($summaryRaw['error'] ?? 0),
                'system_total_successful' => $systemTotalSuccessful
            ];
        } else {
            $summary = ['total' => 0, 'successful' => 0, 'reminder' => 0, 'error' => 0, 'system_total_successful' => 0];
        }

        // 2. Breakdown stats by round
        $sqlRoundStats = "
            SELECT 
                dl.round_id, 
                IFNULL(dr.round_name, 'Không rõ vòng') as round_name, 
                SUM(CASE WHEN dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'reminder', 'duplicate', 'error', 'no_consultant', 'blacklisted') THEN 1 ELSE 0 END) as total_count,
                SUM(CASE WHEN dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours') THEN 1 ELSE 0 END) as successful_count,
                SUM(CASE WHEN dl.status = 'reminder' THEN 1 ELSE 0 END) as reminder_count,
                SUM(CASE WHEN dl.status IN ('duplicate', 'error', 'no_consultant', 'blacklisted') THEN 1 ELSE 0 END) as error_count
            FROM distribution_logs dl
            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
            WHERE dl.assigned_to = ? AND $dateCondition
            GROUP BY dl.round_id, dr.round_name
            ORDER BY total_count DESC
        ";
        $roundsStats = [];
        $stmtRound = $conn->prepare($sqlRoundStats);
        if ($stmtRound) {
            if (!empty($statsTypes)) {
                $stmtRound->bind_param($statsTypes, ...$statsParams);
            }
            $stmtRound->execute();
            $resRound = $stmtRound->get_result();
            while ($row = $resRound->fetch_assoc()) {
                $roundsStats[] = [
                    'round_id' => $row['round_id'] !== null ? (int) $row['round_id'] : null,
                    'round_name' => $row['round_name'],
                    'total_count' => (int) $row['total_count'],
                    'successful_count' => (int) $row['successful_count'],
                    'reminder_count' => (int) $row['reminder_count'],
                    'error_count' => (int) $row['error_count']
                ];
            }
            $stmtRound->close();
        }

        // 3. Daily trend stats
        $byDate = [];
        $sqlByDate = "
            SELECT DATE_FORMAT(dl.received_at, '%Y-%m-%d') as date_str, COUNT(*) as count
            FROM distribution_logs dl
            WHERE dl.assigned_to = ? AND $dateCondition AND dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours')
            GROUP BY DATE(dl.received_at)
            ORDER BY date_str ASC
        ";
        $stmtByDate = $conn->prepare($sqlByDate);
        if ($stmtByDate) {
            if (!empty($statsTypes)) {
                $stmtByDate->bind_param($statsTypes, ...$statsParams);
            }
            $stmtByDate->execute();
            $resByDate = $stmtByDate->get_result();
            while ($row = $resByDate->fetch_assoc()) {
                $byDate[] = [
                    'date' => date('d/m', strtotime($row['date_str'])),
                    'count' => (int) $row['count']
                ];
            }
            $stmtByDate->close();
        }

        // 4. Source distribution stats
        $bySource = [];
        $sqlBySource = "
            SELECT IFNULL(l.source, 'Không rõ nguồn') as source_name, COUNT(*) as count
            FROM distribution_logs dl
            JOIN leads l ON dl.lead_id = l.id
            WHERE dl.assigned_to = ? AND $dateCondition AND dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours')
            GROUP BY l.source
            ORDER BY count DESC
        ";
        $stmtBySource = $conn->prepare($sqlBySource);
        if ($stmtBySource) {
            if (!empty($statsTypes)) {
                $stmtBySource->bind_param($statsTypes, ...$statsParams);
            }
            $stmtBySource->execute();
            $resBySource = $stmtBySource->get_result();
            while ($row = $resBySource->fetch_assoc()) {
                $bySource[] = [
                    'source' => $row['source_name'],
                    'count' => (int) $row['count']
                ];
            }
            $stmtBySource->close();
        }

        // 5. Ticket reports stats
        $ticketCondition = "1=1";
        $ticketParams = [];
        $ticketTypes = "";

        if ($dateMode === 'today') {
            $ticketCondition = "created_at >= ? AND created_at <= ?";
            $ticketParams[] = $today . ' 00:00:00';
            $ticketParams[] = $today . ' 23:59:59';
            $ticketTypes .= "ss";
        } elseif ($dateMode === 'yesterday') {
            $yesterday = date('Y-m-d', strtotime('-1 day'));
            $ticketCondition = "created_at >= ? AND created_at <= ?";
            $ticketParams[] = $yesterday . ' 00:00:00';
            $ticketParams[] = $yesterday . ' 23:59:59';
            $ticketTypes .= "ss";
        } elseif ($dateMode === '7_days') {
            $ticketCondition = "created_at >= ?";
            $ticketParams[] = date('Y-m-d', strtotime('-7 days')) . ' 00:00:00';
            $ticketTypes .= "s";
        } elseif ($dateMode === '30_days') {
            $ticketCondition = "created_at >= ?";
            $ticketParams[] = date('Y-m-d', strtotime('-30 days')) . ' 00:00:00';
            $ticketTypes .= "s";
        } elseif ($dateMode === 'this_month') {
            $ticketCondition = "created_at >= ?";
            $ticketParams[] = date('Y-m-01') . ' 00:00:00';
            $ticketTypes .= "s";
        } elseif ($dateMode === 'last_month') {
            $ticketCondition = "created_at >= ? AND created_at < ?";
            $ticketParams[] = date('Y-m-01', strtotime('first day of last month')) . ' 00:00:00';
            $ticketParams[] = date('Y-m-01') . ' 00:00:00';
            $ticketTypes .= "ss";
        } elseif ($dateMode === 'custom' && !empty($startDate) && !empty($endDate)) {
            $ticketCondition = "created_at >= ? AND created_at <= ?";
            $ticketParams[] = $startDate . ' 00:00:00';
            $ticketParams[] = $endDate . ' 23:59:59';
            $ticketTypes .= "ss";
        }

        $stmtTickets = $conn->prepare("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('approved', 'approved_no_comp') THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM data_reports
            WHERE consultant_id = ? AND $ticketCondition
        ");
        $ticketsStats = ['total' => 0, 'approved' => 0, 'rejected' => 0, 'pending' => 0];
        $activeCompSum = 0;
        $blacklistCompCount = 0;
        if ($stmtTickets) {
            $bindTypes = "i" . $ticketTypes;
            $bindParams = array_merge([$consultantId], $ticketParams);
            $stmtTickets->bind_param($bindTypes, ...$bindParams);
            $stmtTickets->execute();
            $rawTickets = $stmtTickets->get_result()->fetch_assoc();
            $ticketsStats = [
                'total' => (int) ($rawTickets['total'] ?? 0),
                'approved' => (int) ($rawTickets['approved'] ?? 0),
                'rejected' => (int) ($rawTickets['rejected'] ?? 0),
                'pending' => (int) ($rawTickets['pending'] ?? 0)
            ];
            $stmtTickets->close();

            // Cộng thêm "Bù chủ động" từ active_compensation_logs vào Đã bù (và tổng gửi đi)
            $sqlActiveComp = "
                SELECT IFNULL(SUM(amount), 0) as active_comp_sum
                FROM active_compensation_logs
                WHERE consultant_id = ? AND $ticketCondition
            ";
            $stmtActiveComp = $conn->prepare($sqlActiveComp);
            if ($stmtActiveComp) {
                $bindTypesComp = "i" . $ticketTypes;
                $bindParamsComp = array_merge([$consultantId], $ticketParams);
                $stmtActiveComp->bind_param($bindTypesComp, ...$bindParamsComp);
                $stmtActiveComp->execute();
                $resActiveComp = $stmtActiveComp->get_result()->fetch_assoc();
                $activeCompSum = (int) ($resActiveComp['active_comp_sum'] ?? 0);
                $stmtActiveComp->close();
            }

            // Cộng thêm "Bù blacklist" từ admin_logs vào Đã bù (và tổng gửi đi)
            $sqlBlacklistLogs = "
                SELECT COUNT(*) as cnt FROM admin_logs
                WHERE action = 'BLOCK_LEAD_BLACKLIST'
                  AND JSON_VALUE(details, '$.old_consultant_id') = ?
                  AND (JSON_VALUE(details, '$.compensate_sale') = 'true'
                       OR JSON_VALUE(details, '$.compensate_sale') = 1
                       OR JSON_VALUE(details, '$.compensate_sale') = '1')
                  AND $ticketCondition
            ";
            $stmtBlacklistLogs = $conn->prepare($sqlBlacklistLogs);
            if ($stmtBlacklistLogs) {
                $bindTypesB = "i" . $ticketTypes;
                $bindParamsB = array_merge([$consultantId], $ticketParams);
                $stmtBlacklistLogs->bind_param($bindTypesB, ...$bindParamsB);
                $stmtBlacklistLogs->execute();
                $resBlacklistLogs = $stmtBlacklistLogs->get_result()->fetch_assoc();
                $blacklistCompCount = (int) ($resBlacklistLogs['cnt'] ?? 0);
                $stmtBlacklistLogs->close();
            }
            // $ticketsStats['approved'] += $activeCompSum + $blacklistCompCount;
            // $ticketsStats['total'] += $activeCompSum + $blacklistCompCount;
        }

        echo json_encode([
            'success' => true,
            'summary' => $summary,
            'rounds' => $roundsStats,
            'by_date' => $byDate,
            'by_source' => $bySource,
            'tickets' => $ticketsStats,
            'active_compensation' => $activeCompSum,
            'blacklist_compensation' => $blacklistCompCount
        ]);
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
            $row['is_active'] = (int) $row['is_active'];
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
            $row['skipped_credits'] = [];
            $row['consultant_lead_counts'] = [];

            $data[$row['id']] = $row;
            $roundIds[] = $row['id'];
        }

        if (!empty($roundIds)) {
            $idsStr = implode(',', $roundIds);

            // 1. Fetch ratios, compensations and group active consultants in each round
            $ratioRes = $conn->query("SELECT rc.round_id, rc.consultant_id, rc.receive_ratio, rc.data_per_turn, rc.compensation_count, rc.skipped_credit, c.name 
                                      FROM round_consultants rc
                                      JOIN consultants c ON rc.consultant_id = c.id
                                      WHERE rc.round_id IN ($idsStr) AND c.status = 'active'");
            $roundActiveConsultants = [];
            while ($rr = $ratioRes->fetch_assoc()) {
                $rId = $rr['round_id'];
                $cId = $rr['consultant_id'];
                $data[$rId]['ratios'][$cId] = (int) $rr['receive_ratio'];
                $data[$rId]['data_per_turns'][$cId] = (int) ($rr['data_per_turn'] ?? 1);
                $data[$rId]['compensations'][$cId] = (int) $rr['compensation_count'];
                $data[$rId]['skipped_credits'][$cId] = (int) ($rr['skipped_credit'] ?? 0);

                $roundActiveConsultants[$rId][] = [
                    'id' => $cId,
                    'receive_ratio' => (int) $rr['receive_ratio'],
                    'skipped_credit' => (int) ($rr['skipped_credit'] ?? 0)
                ];
            }

            // 2. Fetch stats to compute fairness index (defaults to 7 ngày qua)
            $date = isset($_GET['date']) ? trim($_GET['date']) : '7 ngày qua';
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";

            if ($date === 'all' || $date === '') {
                $dateCondition = "1=1";
            } else if ($date === 'Hôm nay') {
                $dateCondition = "received_at >= CURDATE() AND received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
            } else if ($date === 'Hôm qua') {
                $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND received_at < CURDATE()";
            } else if ($date === 'Tuần này') {
                $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND received_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            } else if ($date === 'Tuần trước') {
                $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
            } else if ($date === 'Tuần trước nữa') {
                $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            } else if ($date === '7 ngày qua') {
                $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            } else if ($date === '30 ngày qua') {
                $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
            } else if ($date === 'Tháng này') {
                $dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
            } else if ($date === 'Tháng trước') {
                $dateCondition = "received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
            } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
                $start = $conn->real_escape_string($matches[1]);
                $end = $conn->real_escape_string($matches[2]);
                $dateCondition = "received_at >= '$start 00:00:00' AND received_at <= '$end 23:59:59'";
            }

            $counts = [];
            $countsQuery = "SELECT assigned_to, round_id, status, COUNT(*) as cnt 
                            FROM distribution_logs 
                            WHERE round_id IN ($idsStr)
                              AND $dateCondition
                              AND status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours') 
                            GROUP BY assigned_to, round_id, status";
            $countsRes = $conn->query($countsQuery);
            if ($countsRes) {
                while ($row = $countsRes->fetch_assoc()) {
                    $cId = (int) $row['assigned_to'];
                    $rId = (int) $row['round_id'];
                    $status = $row['status'];
                    $cnt = (int) $row['cnt'];
                    $counts[$rId][$cId][$status] = $cnt;
                }
            }

            // 3. Calculate Fairness Index & Total Leads for each round
            foreach ($roundIds as $rId) {
                $activeCons = $roundActiveConsultants[$rId] ?? [];
                $N = count($activeCons);

                $rawCounts = [];
                $normalizedCounts = [];
                $totalLeads = 0;

                foreach ($activeCons as $c) {
                    $cId = $c['id'];
                    $ratio = max(1, $c['receive_ratio']);

                    $sc = $counts[$rId][$cId] ?? [];
                    $assigned = $sc['assigned'] ?? 0;
                    $comp = $sc['compensation'] ?? 0;
                    $rule6 = $sc['rule_6_month'] ?? 0;
                    $pending = $sc['pending_work_hours'] ?? 0;
                    $err = $sc['error'] ?? 0;

                    $assignedCount = $assigned + $comp + $rule6 + $pending + max(0, $err - $comp);
                    $rawCounts[] = $assignedCount;
                    $normalizedCounts[] = $assignedCount * $ratio;
                    $totalLeads += $assignedCount;
                    $data[$rId]['consultant_lead_counts'][$cId] = $assignedCount;
                }

                $data[$rId]['total_leads'] = $totalLeads;

                if ($N <= 1) {
                    $data[$rId]['fairness_index'] = 100.0;
                    continue;
                }

                $giniNormalized = 0;
                $sumNorm = array_sum($normalizedCounts);
                if ($sumNorm > 0) {
                    $doubleSumDiffNorm = 0;
                    for ($i = 0; $i < $N; $i++) {
                        for ($j = 0; $j < $N; $j++) {
                            $doubleSumDiffNorm += abs($normalizedCounts[$i] - $normalizedCounts[$j]);
                        }
                    }
                    $giniNormalized = $doubleSumDiffNorm / (2 * $N * $sumNorm);
                }

                $fairnessIndex = (1 - $giniNormalized) * 100;
                $data[$rId]['fairness_index'] = round($fairnessIndex, 1);
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

            $is_fallback = filter_var($input['is_fallback'] ?? false, FILTER_VALIDATE_BOOLEAN);
            if ($is_fallback) {
                if ((int) $status !== 1) {
                    throw new Exception("Không thể tắt hoạt động của vòng dự phòng (fallback).");
                }
                $hasActiveConsultant = false;
                if (!empty($consultants)) {
                    $inClause = implode(',', array_map('intval', $consultants));
                    $chkActive = $conn->query("SELECT COUNT(*) as cnt FROM consultants WHERE id IN ($inClause) AND status = 'active'");
                    if ($chkActive && (int) $chkActive->fetch_assoc()['cnt'] > 0) {
                        $hasActiveConsultant = true;
                    }
                }
                if (!$hasActiveConsultant) {
                    throw new Exception("Vòng dự phòng (fallback) phải có ít nhất một tư vấn viên đang hoạt động.");
                }
            }

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

            $is_fallback = filter_var($input['is_fallback'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $isFallbackRound = $is_fallback || in_array($id, getSystemFallbackRoundIds($conn));
            if ($isFallbackRound) {
                if ((int) $status !== 1) {
                    throw new Exception("Không thể tắt hoạt động của vòng dự phòng (fallback).");
                }
                $hasActiveConsultant = false;
                if (!empty($consultants)) {
                    $inClause = implode(',', array_map('intval', $consultants));
                    $chkActive = $conn->query("SELECT COUNT(*) as cnt FROM consultants WHERE id IN ($inClause) AND status = 'active'");
                    if ($chkActive && (int) $chkActive->fetch_assoc()['cnt'] > 0) {
                        $hasActiveConsultant = true;
                    }
                }
                if (!$hasActiveConsultant) {
                    throw new Exception("Vòng dự phòng (fallback) phải có ít nhất một tư vấn viên đang hoạt động.");
                }
            }

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
            $skipped_credits = isset($input['skipped_credits']) ? $input['skipped_credits'] : null;

            if (!empty($consultants)) {
                if ($skipped_credits !== null) {
                    $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn, compensation_count, skipped_credit) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE receive_ratio = VALUES(receive_ratio), data_per_turn = VALUES(data_per_turn), compensation_count = VALUES(compensation_count), skipped_credit = VALUES(skipped_credit), current_turn_remaining = 0");
                    foreach ($consultants as $cid) {
                        $ratio = isset($ratios[$cid]) ? max(1, (int) $ratios[$cid]) : 1;
                        $perTurn = isset($per_turns[$cid]) ? max(1, (int) $per_turns[$cid]) : 1;
                        $comp = isset($compensations[$cid]) ? max(0, (int) $compensations[$cid]) : 0;
                        $skipCred = isset($skipped_credits[$cid]) ? max(0, (int) $skipped_credits[$cid]) : 0;
                        $stmtC->bind_param("iiiiii", $id, $cid, $ratio, $perTurn, $comp, $skipCred);
                        $stmtC->execute();
                    }
                } else {
                    $stmtC = $conn->prepare("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, data_per_turn, compensation_count) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE receive_ratio = VALUES(receive_ratio), data_per_turn = VALUES(data_per_turn), compensation_count = VALUES(compensation_count), current_turn_remaining = 0");
                    foreach ($consultants as $cid) {
                        $ratio = isset($ratios[$cid]) ? max(1, (int) $ratios[$cid]) : 1;
                        $perTurn = isset($per_turns[$cid]) ? max(1, (int) $per_turns[$cid]) : 1;
                        $comp = isset($compensations[$cid]) ? max(0, (int) $compensations[$cid]) : 0;
                        $stmtC->bind_param("iiiii", $id, $cid, $ratio, $perTurn, $comp);
                        $stmtC->execute();
                    }
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

    case 'update_round_ratios':
        $conn->begin_transaction();
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $roundId = (int) ($input['round_id'] ?? 0);
            $ratios = $input['ratios'] ?? [];

            if ($roundId <= 0) {
                echo json_encode(['success' => false, 'message' => 'ID Vòng không hợp lệ']);
                break;
            }

            // Check if round exists
            $chk = $conn->query("SELECT id FROM distribution_rounds WHERE id = $roundId");
            if ($chk->num_rows === 0) {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy vòng phân bổ']);
                break;
            }

            $stmt = $conn->prepare("UPDATE round_consultants SET receive_ratio = ? WHERE round_id = ? AND consultant_id = ?");
            foreach ($ratios as $cid => $ratio) {
                $cIdInt = (int) $cid;
                $ratioInt = max(0, (int) $ratio);
                $stmt->bind_param("iii", $ratioInt, $roundId, $cIdInt);
                $stmt->execute();
            }
            $stmt->close();

            logAdminAction($conn, $decodedUser['id'], 'UPDATE_ROUND_RATIOS', ['round_id' => $roundId, 'ratios' => $ratios]);
            $conn->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
        }
        break;

    case 'update_compensations':
        $adminName = 'Quản trị viên';
        if (isset($decodedUser['id'])) {
            $admQuery = $conn->prepare("SELECT name FROM accounts WHERE id = ? LIMIT 1");
            $admQuery->bind_param("i", $decodedUser['id']);
            $admQuery->execute();
            $admRes = $admQuery->get_result()->fetch_assoc();
            if ($admRes && !empty($admRes['name'])) {
                $adminName = $admRes['name'];
            }
            $admQuery->close();
        }

        $conn->begin_transaction();
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $roundId = (int) ($input['round_id'] ?? 0);
            $compensations = $input['compensations'] ?? [];
            $reasons = $input['reasons'] ?? [];

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
                            $reasonText = isset($reasons[$cid]) ? trim($reasons[$cid]) : '';

                            // Ghi log vào active_compensation_logs
                            $logStmt = $conn->prepare("INSERT INTO active_compensation_logs (round_id, consultant_id, admin_id, amount, reason) VALUES (?, ?, ?, ?, ?)");
                            $adminIdInt = (int) $decodedUser['id'];
                            $logStmt->bind_param("iiiis", $roundId, $c, $adminIdInt, $delta, $reasonText);
                            $logStmt->execute();
                            $logStmt->close();

                            $notificationQueue[] = [
                                'consultant_id' => $c,
                                'email' => $fRow['email'],
                                'name' => $fRow['name'],
                                'round_name' => $roundName,
                                'delta' => $delta,
                                'admin_name' => $adminName,
                                'reason' => $reasonText,
                                'time' => date('H:i:s d/m/Y')
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

                // Lấy danh sách Ticket Admins nhận thông báo
                $adminEmails = getTicketNotifyAdmins($conn);

                foreach ($notificationQueue as $notify) {
                    try {
                        if (!empty($notify['email'])) {
                            sendCompensationAddedEmailToSale(
                                $notify['email'],
                                $notify['name'],
                                $notify['round_name'],
                                $notify['delta'],
                                $notify['admin_name'],
                                $notify['reason'],
                                $notify['time']
                            );
                        }
                    } catch (Exception $mailEx) {
                        error_log("Error sending compensation email to sale " . $notify['consultant_id'] . ": " . $mailEx->getMessage());
                    }

                    try {
                        sendCompensationAddedZaloMessageToSale(
                            $notify['consultant_id'],
                            $notify['name'],
                            $notify['round_name'],
                            $notify['delta'],
                            $notify['admin_name'],
                            $notify['reason'],
                            $notify['time']
                        );
                    } catch (Exception $zaloEx) {
                        error_log("Error sending compensation Zalo to sale " . $notify['consultant_id'] . ": " . $zaloEx->getMessage());
                    }

                    // Báo cáo cho các admin thông báo
                    if (!empty($adminEmails)) {
                        foreach ($adminEmails as $adm) {
                            try {
                                if (!empty($adm['email'])) {
                                    sendActiveCompensationEmailToAdmins(
                                        $adm['email'],
                                        $adm['name'],
                                        $notify['name'],
                                        $notify['round_name'],
                                        $notify['delta'],
                                        $notify['admin_name'],
                                        $notify['reason'],
                                        $notify['time']
                                    );
                                }
                            } catch (Exception $mailEx2) {
                                error_log("Error sending active compensation report email to admin " . $adm['id'] . ": " . $mailEx2->getMessage());
                            }

                            try {
                                if (!empty($adm['zalo_chat_id'])) {
                                    sendCompensationAddedZaloMessageToAdmin(
                                        $adm['zalo_chat_id'],
                                        $adm['name'],
                                        $notify['name'],
                                        $notify['round_name'],
                                        $notify['delta'],
                                        $notify['admin_name'],
                                        $notify['reason'],
                                        $notify['time']
                                    );
                                }
                            } catch (Exception $zaloEx2) {
                                error_log("Error sending active compensation report Zalo to admin " . $adm['id'] . ": " . $zaloEx2->getMessage());
                            }
                        }
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

            // Check if this round is a fallback round
            $fallbackRounds = getSystemFallbackRoundIds($conn);
            if (in_array($id, $fallbackRounds)) {
                throw new Exception("Không thể xóa vòng này vì nó đang được cấu hình làm vòng dự phòng (fallback). Vui lòng cấu hình vòng dự phòng sang vòng khác trước.");
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
        $type = $_GET['type'] ?? '';
        if ($type === 'inventory_sheets') {
            $res = $conn->query("SELECT * FROM sheet_connections WHERE connection_type = 'inventory_sheets' ORDER BY created_at DESC");
        } else {
            $res = $conn->query("SELECT * FROM sheet_connections WHERE connection_type != 'inventory_sheets' ORDER BY created_at DESC");
        }
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
            $twoWaySync = (int) ($input['two_way_sync'] ?? 0);
            $googleScriptUrl = $input['google_script_url'] ?? null;
            $leadRecallMinutes = (int) ($input['lead_recall_minutes'] ?? 0);
            $notifyAdmin = isset($input['notify_admin']) ? (int) $input['notify_admin'] : ($connectionType === 'landing_page' ? 1 : 0);

            $stmt = $conn->prepare("INSERT INTO sheet_connections (sheet_name, spreadsheet_id, webhook_token, is_active, sync_interval, require_both_contact, connection_type, sync_mode, is_silent, sync_saleperson, email_template, two_way_sync, google_script_url, is_initialized, lead_recall_minutes, notify_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
            $stmt->bind_param("sssiiissiisiiii", $name, $spreadsheetId, $webhookToken, $isActive, $syncInterval, $requireBoth, $connectionType, $syncMode, $isSilent, $syncSaleperson, $emailTemplate, $twoWaySync, $googleScriptUrl, $leadRecallMinutes, $notifyAdmin);
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
            $twoWaySync = (int) ($input['two_way_sync'] ?? 0);
            $googleScriptUrl = $input['google_script_url'] ?? null;
            $leadRecallMinutes = (int) ($input['lead_recall_minutes'] ?? 0);
            $notifyAdmin = isset($input['notify_admin']) ? (int) $input['notify_admin'] : ($connectionType === 'landing_page' ? 1 : 0);

            $stmt = $conn->prepare("UPDATE sheet_connections SET sheet_name=?, spreadsheet_id=?, is_active=?, sync_interval=?, require_both_contact=?, connection_type=?, sync_mode=?, is_silent=?, sync_saleperson=?, email_template=?, two_way_sync=?, google_script_url=?, lead_recall_minutes=?, notify_admin=?, is_initialized=0, last_sync_at=NULL, sync_status='idle', last_error=NULL WHERE id=?");
            $stmt->bind_param("ssiiissiisiisii", $name, $spreadsheetId, $isActive, $syncInterval, $requireBoth, $connectionType, $syncMode, $isSilent, $syncSaleperson, $emailTemplate, $twoWaySync, $googleScriptUrl, $leadRecallMinutes, $notifyAdmin, $id);
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
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
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
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        // Force IPv4 to prevent misconfigured IPv6 gateway from causing connection timeout
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($csvData) || stripos($csvData, '<html') !== false || stripos($csvData, '<!DOCTYPE') !== false) {
            echo json_encode(['success' => false, 'message' => 'Failed to fetch spreadsheet columns. Spreadsheet might be private or invalid.']);
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

    case 'toggle_notify_admin':
        try {
            $id = (int) ($_GET['id'] ?? 0);
            $notify = (int) ($_GET['notify'] ?? 0);
            $stmt = $conn->prepare("UPDATE sheet_connections SET notify_admin=? WHERE id=?");
            $stmt->bind_param("ii", $notify, $id);
            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'TOGGLE_NOTIFY_ADMIN', ['id' => $id, 'notify_admin' => $notify]);
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

    case 'evaluate_rules_ai':
        try {
            $apiKey = get_system_setting($conn, 'gemini_api_key');
            $model = get_system_setting($conn, 'gemini_model') ?: 'gemini-2.5-flash-lite';
            
            if (empty($apiKey)) {
                echo json_encode(['success' => false, 'message' => 'Gemini API Key chưa được cấu hình trong phần Cài đặt.']);
                break;
            }

            // Read POST JSON input
            $input = json_decode(file_get_contents('php://input'), true);
            $sentRules = $input['rules'] ?? null;

            $rules = [];
            if (is_array($sentRules)) {
                // Use sent rules
                $roundRes = $conn->query("SELECT id, round_name FROM distribution_rounds");
                $roundMap = [];
                while ($rRow = $roundRes->fetch_assoc()) {
                    $roundMap[$rRow['id']] = $rRow['round_name'];
                }
                foreach ($sentRules as $r) {
                    $target_round_id = $r['target_round_id'] ?? 0;
                    $rName = $r['round_name'] ?? ($roundMap[$target_round_id] ?? ("Vòng ID " . $target_round_id));
                    $rules[] = [
                        'id' => $r['id'] ?? 0,
                        'connection_id' => $r['connection_id'] ?? '',
                        'condition_column' => $r['condition_column'] ?? '',
                        'condition_operator' => $r['condition_operator'] ?? '',
                        'condition_value' => $r['condition_value'] ?? '',
                        'conditions_json' => is_array($r['conditions_json']) ? json_encode($r['conditions_json'], JSON_UNESCAPED_UNICODE) : ($r['conditions_json'] ?? ''),
                        'target_round_id' => $target_round_id,
                        'round_name' => $rName
                    ];
                }
            } else {
                // Fetch all rules from database as fallback
                $res = $conn->query("SELECT rr.*, r.round_name FROM routing_rules rr LEFT JOIN distribution_rounds r ON rr.target_round_id = r.id ORDER BY rr.priority ASC, rr.id ASC");
                while ($row = $res->fetch_assoc()) {
                    $rules[] = $row;
                }
            }

            if (empty($rules)) {
                echo json_encode(['success' => false, 'message' => 'Hệ thống hiện tại chưa có quy tắc định tuyến nào để đánh giá.']);
                break;
            }

            // Fetch connections
            $connRes = $conn->query("SELECT id, sheet_name FROM sheet_connections");
            $connMap = [];
            while ($cRow = $connRes->fetch_assoc()) {
                $connMap[$cRow['id']] = $cRow['sheet_name'];
            }

            // Build rules text representation for prompt
            $rulesDesc = "";
            foreach ($rules as $idx => $r) {
                $priority = $idx + 1;
                $connStr = "Tất cả kết nối";
                if ($r['connection_id'] !== null && $r['connection_id'] !== '' && $r['connection_id'] !== 'all') {
                    $cIds = explode(',', $r['connection_id']);
                    $cNames = [];
                    foreach ($cIds as $cId) {
                        $cId = trim($cId);
                        if ($cId === '-1') $cNames[] = "Tất cả Google Sheets";
                        elseif ($cId === '-2') $cNames[] = "Tất cả API / Landing Pages";
                        elseif ($cId === '-3') $cNames[] = "Data Nhập tay";
                        elseif (isset($connMap[$cId])) $cNames[] = $connMap[$cId];
                        else $cNames[] = "Kết nối ID $cId";
                    }
                    $connStr = implode(', ', $cNames);
                }

                $conditions = [];
                if (!empty($r['conditions_json'])) {
                    $branches = json_decode($r['conditions_json'], true);
                    if (is_array($branches)) {
                        foreach ($branches as $bIdx => $branch) {
                            $condsStr = [];
                            $conds = $branch['conditions'] ?? [];
                            foreach ($conds as $c) {
                                $condsStr[] = "{$c['col']} {$c['op']} '{$c['val']}'";
                            }
                            $conditions[] = ($bIdx > 0 ? "HOẶC " : "") . "(" . implode(" VÀ ", $condsStr) . ")";
                        }
                    }
                }
                
                if (empty($conditions)) {
                    $conditions[] = "{$r['condition_column']} {$r['condition_operator']} '{$r['condition_value']}'";
                }

                $condsDesc = implode(" ", $conditions);
                $roundName = $r['round_name'] ?: "Vòng ID " . $r['target_round_id'];

                $rulesDesc .= "Ưu tiên {$priority} (ID: {$r['id']}):\n";
                $rulesDesc .= "  - Áp dụng cho: {$connStr}\n";
                $rulesDesc .= "  - Điều kiện: {$condsDesc}\n";
                $rulesDesc .= "  - Hành động xử lý (Phân phối về vòng): {$roundName}\n\n";
            }

            // Build Prompt
            $prompt = "Bạn là một chuyên gia cao cấp về thiết kế hệ thống phân phối dữ liệu khách hàng (Routing Rule Engine).\n"
                . "Dưới đây là danh sách các quy tắc định tuyến của chúng tôi (được sắp xếp theo thứ tự ưu tiên giảm dần từ trên xuống dưới, nghĩa là quy tắc khớp trước sẽ được áp dụng trước và dừng tìm kiếm):\n\n"
                . $rulesDesc
                . "Hãy phân tích toàn bộ cấu hình quy tắc trên và phản hồi bằng định dạng Markdown (tiếng Việt), tập trung vào các nội dung sau:\n"
                . "1. **Tổng quan**: Đánh giá ngắn gọn số lượng và độ phủ của các quy tắc.\n"
                . "2. **Xung đột logic hoặc Trùng lặp**: Chỉ ra các quy tắc bị che phủ bởi quy tắc ưu tiên cao hơn (Redundant/Shadowed rules - ví dụ: một quy tắc ở dưới có điều kiện hẹp hơn hoặc bằng quy tắc ở trên cùng kết nối và cùng vòng/khác vòng, khiến nó không bao giờ được chạy), hoặc mâu thuẫn điều kiện.\n"
                . "3. **Khe hở định tuyến (Gaps)**: Có trường hợp dữ liệu nào đổ về có nguy cơ không khớp bất kỳ quy tắc nào và bị trôi nổi không (thiếu quy tắc fallback cuối cùng).\n"
                . "4. **Đề xuất tối ưu hóa cụ thể**: Đề xuất cụ thể cách sắp xếp lại thứ tự, chỉnh sửa hoặc gộp các quy tắc để tăng độ tin cậy và chính xác.\n\n"
                . "Hãy trình bày mạch lạc, dễ hiểu, định dạng đẹp mắt bằng Markdown, chỉ tập trung phân tích logic của quy tắc.";

            // Make Gemini request
            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $prompt]
                        ]
                    ]
                ]
            ];

            $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model . ":generateContent?key=" . $apiKey;

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($response === false || $httpCode !== 200) {
                echo json_encode(['success' => false, 'message' => "Lỗi kết nối Gemini API (HTTP $httpCode)"]);
                break;
            }

            $resJson = json_decode($response, true);
            $rawText = $resJson['candidates'][0]['content']['parts'][0]['text'] ?? '';
            
            if (empty($rawText)) {
                echo json_encode(['success' => false, 'message' => "Gemini API trả về kết quả trống."]);
                break;
            }

            echo json_encode(['success' => true, 'feedback' => $rawText]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // --- REPORT DATA ENDPOINTS ---
    case 'get_report_context':
        // PUBLIC: Load lead/consultant/round info for the report page
        $lead_id = (int) ($_GET['lead_id'] ?? 0);
        $sale_id = (int) ($_GET['sale_id'] ?? 0);
        $round_id = (int) ($_GET['round_id'] ?? 0);

        if (!$lead_id || !$sale_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu tham số']);
            break;
        }

        // Auto-discover original assignment if this is a reminder lead (status = 'reminder') or round_id = 0
        $isReminder = false;
        if ($round_id <= 0) {
            $isReminder = true;
        } else {
            $chkLog = $conn->prepare("SELECT status FROM distribution_logs WHERE lead_id = ? AND assigned_to = ? AND round_id = ? LIMIT 1");
            if ($chkLog) {
                $chkLog->bind_param("iii", $lead_id, $sale_id, $round_id);
                $chkLog->execute();
                $resLog = $chkLog->get_result()->fetch_assoc();
                if ($resLog && $resLog['status'] === 'reminder') {
                    $isReminder = true;
                }
                $chkLog->close();
            }
        }

        if ($isReminder) {
            $findOrigStmt = $conn->prepare("
                SELECT dl.round_id, dl.assigned_to
                FROM distribution_logs dl
                WHERE dl.lead_id = ? AND dl.status IN ('assigned', 'compensation') AND dl.round_id > 0
                ORDER BY dl.received_at DESC
            ");
            if ($findOrigStmt) {
                $findOrigStmt->bind_param("i", $lead_id);
                $findOrigStmt->execute();
                $origRes = $findOrigStmt->get_result();
                $findOrigStmt->close();

                $foundOriginal = false;
                while ($origRow = $origRes->fetch_assoc()) {
                    $origRoundId = (int)$origRow['round_id'];
                    $origSaleId = (int)$origRow['assigned_to'];

                    // Check if ticket is processed (approved or rejected)
                    $ticketChk = $conn->prepare("
                        SELECT id FROM data_reports 
                        WHERE lead_id = ? AND consultant_id = ? AND round_id = ? AND status IN ('approved', 'rejected') 
                        LIMIT 1
                    ");
                    if ($ticketChk) {
                        $ticketChk->bind_param("iii", $lead_id, $origSaleId, $origRoundId);
                        $ticketChk->execute();
                        $ticketRes = $ticketChk->get_result();
                        $hasTicketProcessed = ($ticketRes->num_rows > 0);
                        $ticketChk->close();

                        if (!$hasTicketProcessed) {
                            $round_id = $origRoundId;
                            $sale_id = $origSaleId;
                            $foundOriginal = true;
                            break;
                        }
                    }
                }

                if (!$foundOriginal) {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Không thể báo cáo lỗi cho dữ liệu nhắc lại và không tìm thấy lượt phân bổ gốc chưa được xử lý.'
                    ]);
                    break;
                }
            }
        }

        // Verify ownership: lead must be assigned to this consultant in this round
        $verifyStmt = $conn->prepare("
            SELECT dl.id, l.name as lead_name, l.phone as lead_phone, l.email as lead_email, l.source, l.type as lead_type, l.note,
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

        $cEmail = $ctx['consultant_email'];
        $cRole = 'sale';
        $roleStmt = $conn->prepare("SELECT role FROM accounts WHERE email = ? LIMIT 1");
        if ($roleStmt) {
            $roleStmt->bind_param("s", $cEmail);
            $roleStmt->execute();
            $roleRes = $roleStmt->get_result()->fetch_assoc();
            if ($roleRes) {
                $cRole = $roleRes['role'];
            }
            $roleStmt->close();
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'lead_id' => $lead_id,
                'sale_id' => $sale_id,
                'round_id' => $round_id,
                'lead_name' => $ctx['lead_name'],
                'lead_phone' => $ctx['lead_phone'],
                'lead_email' => $ctx['lead_email'],
                'lead_source' => $ctx['source'],
                'lead_type' => $ctx['lead_type'],
                'lead_note' => $ctx['note'],
                'consultant_name' => $ctx['consultant_name'],
                'consultant_email' => $ctx['consultant_email'],
                'round_name' => $ctx['round_name'],
                'assigned_at' => $ctx['received_at'],
                'existing_report' => $existingReport ? $existingReport['status'] : null,
                'duplicate_check_months' => (int) get_system_setting($conn, 'duplicate_check_months') ?: 6,
                'report_error_reasons' => get_normalized_report_error_reasons($conn),
                'is_allowed_to_report' => true,
                'consultant_role' => $cRole
            ]
        ]);
        break;

    case 'submit_report':
        $input = json_decode(file_get_contents('php://input'), true);
        $lead_id = (int) ($input['lead_id'] ?? 0);
        $sale_id = (int) ($input['sale_id'] ?? 0);
        $round_id = (int) ($input['round_id'] ?? 0);
        $reason = trim($input['reason'] ?? '');

        // Auto-discover original assignment if this is a reminder lead (status = 'reminder') or round_id = 0
        $isReminder = false;
        if ($round_id <= 0) {
            $isReminder = true;
        } else {
            $chkLog = $conn->prepare("SELECT status FROM distribution_logs WHERE lead_id = ? AND assigned_to = ? AND round_id = ? LIMIT 1");
            if ($chkLog) {
                $chkLog->bind_param("iii", $lead_id, $sale_id, $round_id);
                $chkLog->execute();
                $resLog = $chkLog->get_result()->fetch_assoc();
                if ($resLog && $resLog['status'] === 'reminder') {
                    $isReminder = true;
                }
                $chkLog->close();
            }
        }

        if ($isReminder) {
            $findOrigStmt = $conn->prepare("
                SELECT dl.round_id, dl.assigned_to
                FROM distribution_logs dl
                WHERE dl.lead_id = ? AND dl.status IN ('assigned', 'compensation') AND dl.round_id > 0
                ORDER BY dl.received_at DESC
            ");
            if ($findOrigStmt) {
                $findOrigStmt->bind_param("i", $lead_id);
                $findOrigStmt->execute();
                $origRes = $findOrigStmt->get_result();
                $findOrigStmt->close();

                $foundOriginal = false;
                while ($origRow = $origRes->fetch_assoc()) {
                    $origRoundId = (int)$origRow['round_id'];
                    $origSaleId = (int)$origRow['assigned_to'];

                    // Check if ticket is processed (approved or rejected)
                    $ticketChk = $conn->prepare("
                        SELECT id FROM data_reports 
                        WHERE lead_id = ? AND consultant_id = ? AND round_id = ? AND status IN ('approved', 'rejected') 
                        LIMIT 1
                    ");
                    if ($ticketChk) {
                        $ticketChk->bind_param("iii", $lead_id, $origSaleId, $origRoundId);
                        $ticketChk->execute();
                        $ticketRes = $ticketChk->get_result();
                        $hasTicketProcessed = ($ticketRes->num_rows > 0);
                        $ticketChk->close();

                        if (!$hasTicketProcessed) {
                            $round_id = $origRoundId;
                            $sale_id = $origSaleId;
                            $foundOriginal = true;
                            break;
                        }
                    }
                }

                if (!$foundOriginal) {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Không thể báo cáo lỗi cho dữ liệu nhắc lại và không tìm thấy lượt phân bổ gốc chưa được xử lý.'
                    ]);
                    break;
                }
            }
        }

        if (!$lead_id || !$sale_id || !$round_id || empty($reason)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin bắt buộc']);
            break;
        }

        require_once __DIR__ . '/webhook_logic.php';
        $fallbackRoundIds = getAllFallbackRoundIds($conn);
        if (in_array((int) $round_id, $fallbackRoundIds)) {
            echo json_encode(['success' => false, 'message' => 'Không thể báo cáo lỗi cho dữ liệu dưới chuẩn.']);
            break;
        }



        // SECURITY: Verify ownership — lead must truly belong to this consultant in this round
        $verifyStmt = $conn->prepare("
            SELECT id, status FROM distribution_logs 
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
        $logRow = $verifyRes->fetch_assoc();
        if (($logRow['status'] ?? '') === 'reminder') {
            echo json_encode(['success' => false, 'message' => 'Không thể báo cáo lỗi cho dữ liệu nhắc lại.']);
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
            $leadConnId = (int) $resLeadInfo['connection_id'];
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
                        if (!is_array($ruleRounds)) {
                            $ruleRounds = is_string($ruleRounds) ? array_map('trim', explode(',', $ruleRounds)) : [$ruleRounds];
                        }
                        if (empty($ruleRounds) || in_array('all', $ruleRounds) || in_array((string) $round_id, array_map('strval', $ruleRounds))) {
                            $roundMatch = true;
                        }
                        if (!$roundMatch) {
                            continue;
                        }

                        // 2. Check sale condition
                        $saleMatch = false;
                        $ruleSales = $rule['sales'] ?? [];
                        if (!is_array($ruleSales)) {
                            $ruleSales = is_string($ruleSales) ? array_map('trim', explode(',', $ruleSales)) : [$ruleSales];
                        }
                        if (empty($ruleSales) || in_array('all', $ruleSales) || in_array((string) $sale_id, array_map('strval', $ruleSales))) {
                            $saleMatch = true;
                        }
                        if (!$saleMatch) {
                            continue;
                        }

                        // 3. Check source (connection_id) condition
                        $sourceMatch = false;
                        $ruleConnections = $rule['connections'] ?? [];
                        if (!is_array($ruleConnections)) {
                            $ruleConnections = is_string($ruleConnections) ? array_map('trim', explode(',', $ruleConnections)) : [$ruleConnections];
                        }
                        if (empty($ruleConnections) || in_array('all', $ruleConnections) || in_array((string) $leadConnId, array_map('strval', $ruleConnections))) {
                            $sourceMatch = true;
                        }
                        if (!$sourceMatch) {
                            continue;
                        }

                        // 4. Check keywords/reasons
                        $keywords = $rule['keywords'] ?? [];
                        if (!is_array($keywords)) {
                            if (is_string($keywords)) {
                                $keywords = array_map('trim', explode(',', $keywords));
                            } else {
                                $keywords = [];
                            }
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
                $stmt = $conn->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, status, resolved_by, created_at, resolved_at) VALUES (?, ?, ?, ?, 'approved', 'Hệ thống', (SELECT created_at FROM leads WHERE id = ?), (SELECT created_at FROM leads WHERE id = ?))");
                $stmt->bind_param("iiisii", $lead_id, $sale_id, $round_id, $reason, $lead_id, $lead_id);
                $stmt->execute();
                $report_id = $stmt->insert_id;
                $stmt->close();

                // 2. Mark lead as faulty
                $faultyMsg = "[LỖI - TỰ ĐỘNG DUYỆT (Luật: $matchedRuleName, Từ khóa: $matchedKeyword)]: " . $reason . " | Admin duyệt: Hệ thống | Thời gian: " . date('d/m/Y H:i:s');
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
                    sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg, false);
                }

                // Send Email to Sale
                if (!empty($consultant['email'])) {
                    require_once __DIR__ . '/mailer.php';
                    $emailSubj = "[BOT] Ticket Lỗi Data Đã Được Tự Động Duyệt - $lName";
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
                            sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg, false);
                        }
                    }

                    // Email to admins
                    require_once __DIR__ . '/mailer.php';
                    $toAdmin = array_shift($adminEmails);
                    $ccList = array_map(fn($a) => $a['email'], $adminEmails);
                    $ccString = implode(',', array_filter($ccList));

                    $emailSubjAdmin = "[Rich Land DATA] Thông báo Ticket Tự động duyệt - Sale: $cName";
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

        $stmt = $conn->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, created_at) VALUES (?, ?, ?, ?, (SELECT created_at FROM leads WHERE id = ?))");
        $stmt->bind_param("iiisi", $lead_id, $sale_id, $round_id, $reason, $lead_id);
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
                        . "  $reason";

                    $adminChatIds = [];
                    foreach ($allAdmins as $adm) {
                        if (!empty($adm['zalo_chat_id'])) {
                            $adminChatIds[] = $adm['zalo_chat_id'];
                        }
                    }
                    if (!empty($adminChatIds)) {
                        sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloMsg, false);
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
        $round_id = isset($_GET['round_id']) ? (int) $_GET['round_id'] : 0;
        $status = isset($_GET['status']) ? trim($_GET['status']) : 'all';
        $consultant = isset($_GET['consultant']) ? trim($_GET['consultant']) : '';
        
        $consultantId = isset($_GET['consultant_id']) && $_GET['consultant_id'] !== '' ? (int) $_GET['consultant_id'] : 0;
        if ($decodedUser['role'] === 'sale') {
            $consultantId = $currentSaleConsultantId;
            if ($consultantId <= 0) {
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'total_count' => 0,
                    'stats' => [
                        'pending' => 0,
                        'approved' => 0,
                        'rejected' => 0,
                        'all' => 0
                    ]
                ]);
                break;
            }
        }
        
        $date = isset($_GET['date']) ? trim($_GET['date']) : 'Tháng này';

        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : 50;
        if ($page < 1)
            $page = 1;
        if ($pageSize < 1)
            $pageSize = 50;
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
        if ($consultantId > 0) {
            $conds[] = "r.consultant_id = ?";
            $params[] = $consultantId;
            $types .= "i";
        } else if ($consultant !== '' && $consultant !== 'all') {
            $conds[] = "c.name = ?";
            $params[] = $consultant;
            $types .= "s";
        }

        // Parse date condition using the same logic (against r.created_at)
        $dateCondition = "r.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND r.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";

        if ($date === 'all' || $date === '') {
            $dateCondition = "1=1";
        } else if ($date === 'Hôm nay') {
            $dateCondition = "r.created_at >= CURDATE() AND r.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        } else if ($date === 'Hôm qua') {
            $dateCondition = "r.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND r.created_at < CURDATE()";
        } else if ($date === 'Tuần này') {
            $dateCondition = "r.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND r.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === 'Tuần trước') {
            $dateCondition = "r.created_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND r.created_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
        } else if ($date === 'Tuần trước nữa') {
            $dateCondition = "r.created_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND r.created_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === '7 ngày qua') {
            $dateCondition = "r.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } else if ($date === '30 ngày qua') {
            $dateCondition = "r.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        } else if ($date === 'Tháng này') {
            $dateCondition = "r.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND r.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
        } else if ($date === 'Tháng trước') {
            $dateCondition = "r.created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND r.created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "r.created_at >= '$start 00:00:00' AND r.created_at <= '$end 23:59:59'";
        }

        $baseConds = $conds;
        $baseParams = $params;
        $baseTypes = $types;

        // Records Condition (includes status and conditionally dateCondition)
        $recordsConds = $baseConds;
        $recordsParams = $baseParams;
        $recordsTypes = $baseTypes;
        if ($status === 'pending') {
            $recordsConds[] = "r.status = 'pending'";
        } else if ($status === 'approved_no_comp') {
            $recordsConds[] = "r.status = 'approved_no_comp'";
            if ($dateCondition !== "1=1") {
                $recordsConds[] = $dateCondition;
            }
        } else if ($status === 'approved' || $status === 'rejected') {
            $recordsConds[] = "r.status = ?";
            $recordsParams[] = $status;
            $recordsTypes .= "s";
            if ($dateCondition !== "1=1") {
                $recordsConds[] = $dateCondition;
            }
        } else {
            // $status === 'all'
            if ($dateCondition !== "1=1") {
                $recordsConds[] = "(r.status = 'pending' OR (r.status IN ('approved', 'rejected', 'approved_no_comp') AND $dateCondition))";
            }
        }

        $recordsWhere = count($recordsConds) > 0 ? "WHERE " . implode(" AND ", $recordsConds) : "";

        // Query 1: Get Stats per status (for badges)
        $statsSql = "
            SELECT 
                SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_cnt,
                SUM(CASE WHEN r.status = 'approved' AND ($dateCondition) THEN 1 ELSE 0 END) as approved_cnt,
                SUM(CASE WHEN r.status = 'approved_no_comp' AND ($dateCondition) THEN 1 ELSE 0 END) as approved_no_comp_cnt,
                SUM(CASE WHEN r.status = 'rejected' AND ($dateCondition) THEN 1 ELSE 0 END) as rejected_cnt
            FROM data_reports r
            JOIN leads l ON r.lead_id = l.id
            JOIN consultants c ON r.consultant_id = c.id
            JOIN distribution_rounds dr ON r.round_id = dr.id
            " . (count($baseConds) > 0 ? "WHERE " . implode(" AND ", $baseConds) : "") . "
        ";
        $stmtStats = $conn->prepare($statsSql);
        if (count($baseParams) > 0) {
            $stmtStats->bind_param($baseTypes, ...$baseParams);
        }
        $stmtStats->execute();
        $resStats = $stmtStats->get_result();
        $rowStats = $resStats->fetch_assoc();
        $stmtStats->close();

        $stats = [
            'pending' => (int) ($rowStats['pending_cnt'] ?? 0),
            'approved' => (int) ($rowStats['approved_cnt'] ?? 0),
            'approved_no_comp' => (int) ($rowStats['approved_no_comp_cnt'] ?? 0),
            'rejected' => (int) ($rowStats['rejected_cnt'] ?? 0),
        ];
        $stats['all'] = $stats['pending'] + $stats['approved'] + $stats['approved_no_comp'] + $stats['rejected'];

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
        $totalCount = (int) ($stmtCount->get_result()->fetch_assoc()['cnt'] ?? 0);

        // Query 3: Get paginated records
        $recordsSql = "
            SELECT r.*, l.name as lead_name, l.phone as lead_phone, l.email as lead_email,
                   l.source as lead_source, l.type as lead_type, l.note as lead_note,
                   l.created_at as lead_created_at, l.ai_screener_status, l.ai_evaluation,
                   c.name as consultant_name, c.zalo_chat_id, c.avatar as consultant_avatar, dr.round_name,
                   dl.id as log_id,
                   dl.status as log_status,
                   dl.received_at as log_received_at,
                   (SELECT MAX(dl2.received_at) FROM distribution_logs dl2 WHERE dl2.lead_id = r.lead_id AND dl2.id < dl.id) as last_activity_at,
                   a.avatar as resolved_by_avatar
            FROM data_reports r
            JOIN leads l ON r.lead_id = l.id
            JOIN consultants c ON r.consultant_id = c.id
            JOIN distribution_rounds dr ON r.round_id = dr.id
            LEFT JOIN (
                SELECT lead_id, assigned_to, round_id, MAX(id) as max_id
                FROM distribution_logs
                GROUP BY lead_id, assigned_to, round_id
            ) dl_max ON r.lead_id = dl_max.lead_id AND r.consultant_id = dl_max.assigned_to AND r.round_id = dl_max.round_id
            LEFT JOIN distribution_logs dl ON dl.id = dl_max.max_id
            LEFT JOIN accounts a ON r.resolved_by = a.name
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

    case 'get_active_compensation_logs':
        $round_id = isset($_GET['round_id']) ? (int) $_GET['round_id'] : 0;
        if ($round_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID Vòng không hợp lệ']);
            break;
        }
        $stmt = $conn->prepare("
            SELECT acl.*, c.name as consultant_name, c.avatar as consultant_avatar, a.name as admin_name, a.avatar as admin_avatar
            FROM active_compensation_logs acl
            JOIN consultants c ON acl.consultant_id = c.id
            JOIN accounts a ON acl.admin_id = a.id
            WHERE acl.round_id = ?
            ORDER BY acl.created_at DESC
        ");
        $stmt->bind_param("i", $round_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $data = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $data[] = $row;
            }
        }
        $stmt->close();
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'approve_report':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $report_id = (int) ($input['id'] ?? 0);
        $approval_reason = trim($input['approval_reason'] ?? '');
        $new_consultant_id = isset($input['new_consultant_id']) ? (int) $input['new_consultant_id'] : 0;
        $no_compensation = isset($input['no_compensation']) ? (bool) $input['no_compensation'] : false;
        if (!$report_id) {
            echo json_encode(['success' => false, 'message' => 'ID báo cáo không hợp lệ']);
            break;
        }

        // Lấy thông tin admin thực hiện sớm để ghi vào DB
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

            // 2. Mark report as approved or approved_no_comp
            $statusVal = $no_compensation ? 'approved_no_comp' : 'approved';
            $updRep = $conn->prepare("UPDATE data_reports SET status=?, approval_reason=?, resolved_by=?, resolved_at=(SELECT created_at FROM leads WHERE id=data_reports.lead_id) WHERE id=?");
            $updRep->bind_param("sssi", $statusVal, $approval_reason, $adminName, $report_id);
            $updRep->execute();

            // 3. Mark lead as faulty (Append to note and optionally assign to new consultant)
            $notePrefix = $no_compensation ? "[LỖI - DUYỆT KHÔNG BÙ]" : "[LỖI - ĐÃ DUYỆT]";
            $faultyMsg = $notePrefix . ": " . $report['reason'];
            if (!empty($approval_reason)) {
                $faultyMsg .= " | Lý do duyệt: " . $approval_reason;
            }
            $faultyMsg .= " | Admin duyệt: " . $adminName . " | Thời gian: " . date('d/m/Y H:i:s');

            if ($new_consultant_id > 0) {
                $faultyMsg .= " | Nhắc lại cho TVV: " . $newConsultantName;
                $updLead = $conn->prepare("UPDATE leads SET assigned_to = ?, note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
                $updLead->bind_param("isi", $new_consultant_id, $faultyMsg, $report['lead_id']);
            } else {
                $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
                $updLead->bind_param("si", $faultyMsg, $report['lead_id']);
            }
            $updLead->execute();

            if (!$no_compensation) {
                // Mark distribution_logs as error
                $updLog = $conn->prepare("UPDATE distribution_logs SET status='error' WHERE lead_id=? AND assigned_to=? AND round_id=?");
                $updLog->bind_param("iii", $report['lead_id'], $report['consultant_id'], $report['round_id']);
                $updLog->execute();

                // 4. Increment compensation_count for the consultant in that round
                $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id=? AND consultant_id=?");
                $updComp->bind_param("ii", $report['round_id'], $report['consultant_id']);
                $updComp->execute();
            }

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

            $adminActionType = $no_compensation ? 'APPROVE_REPORT_NO_COMP' : 'APPROVE_REPORT';
            logAdminAction($conn, $decodedUser['id'], $adminActionType, [
                'report_id' => $report_id,
                'lead_id' => $report['lead_id'],
                'consultant_id' => $report['consultant_id'],
                'round_id' => $report['round_id'],
                'approval_reason' => $approval_reason,
                'new_consultant_id' => $new_consultant_id
            ]);
            $conn->commit();
            // Trigger Live Two-Way Sync to Google Sheets
            triggerTwoWaySync($conn, $report['lead_id']);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // Đã commit DB thành công. Bắt đầu xử lý thông báo ngoài giao dịch DB
        try {
            // Lấy thông tin Sale & Lead để gửi thông báo
            $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $consultStmt->bind_param("i", $report['consultant_id']);
            $consultStmt->execute();
            $consultant = $consultStmt->get_result()->fetch_assoc();
            $consultStmt->close(); // Close open statement properly to avoid out of sync errors


            $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
            $leadStmt->bind_param("i", $report['lead_id']);
            $leadStmt->execute();
            $lead = $leadStmt->get_result()->fetch_assoc();
            $leadStmt->close();

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
                    if ($no_compensation) {
                        $zaloMsg = "[ TICKET ĐÃ ĐƯỢC DUYỆT KHÔNG ĐỀN BÙ ]\n\n"
                            . "Chào $cName, báo cáo lỗi Data của bạn đã ĐƯỢC DUYỆT KHÔNG ĐỀN BÙ bởi $adminName.\n\n"
                            . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                            . "  • Khách hàng: $lName ($lPhone)\n"
                            . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                            . "❖ LÝ DO DUYỆT:\n"
                            . "  " . (!empty($approval_reason) ? $approval_reason : "Không có lý do cụ thể") . "\n\n"
                            . "Lưu ý: Bạn vẫn sở hữu lead này và hệ thống KHÔNG cộng lượt đền bù cho ticket này.";
                    } else {
                        $zaloMsg = "[ TICKET ĐÃ ĐƯỢC DUYỆT ]\n\n"
                            . "Chào $cName, báo cáo lỗi Data của bạn đã ĐƯỢC PHÊ DUYỆT bởi $adminName.\n\n"
                            . "❖ THÔNG TIN KHÁCH HÀNG:\n"
                            . "  • Khách hàng: $lName ($lPhone)\n"
                            . "  • Lỗi bạn báo: {$report['reason']}\n\n"
                            . "❖ LÝ DO DUYỆT:\n"
                            . "  " . (!empty($approval_reason) ? $approval_reason : "Không có lý do cụ thể") . "\n\n"
                            . "Hệ thống đã ghi nhận 1 lượt đền bù. Bạn sẽ nhận được Data mới vào lần phân bổ tiếp theo.";
                    }
                    sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg, false);
                } catch (Exception $zEx1) {
                    error_log("Error sending Zalo message to consultant in approve_report: " . $zEx1->getMessage());
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
                    $ccEmailsArr = array_unique($ccEmailsArr);
                    $saleEmail = strtolower(trim($consultant['email']));
                    $ccEmailsArr = array_filter($ccEmailsArr, fn($e) => $e !== $saleEmail);
                    $ccString = implode(',', $ccEmailsArr);

                    if ($no_compensation) {
                        $emailSubj = "[BOT] Ticket Lỗi Data Đã Được Duyệt Không Đền Bù - $lName";
                        $emailBody = "<h3>Báo cáo lỗi Data được duyệt không đền bù</h3>
                                      <p>Chào $cName,</p>
                                      <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã được Quản trị viên <strong>$adminName</strong> duyệt không đền bù.</p>
                                      <p><strong>Lý do duyệt:</strong> " . (!empty($approval_reason) ? htmlspecialchars($approval_reason) : "Không có lý do cụ thể") . "</p>
                                      <p>Bạn vẫn sở hữu lead này và hệ thống không cộng lượt đền bù cho ticket này.</p>";
                    } else {
                        $emailSubj = "[BOT] Ticket Lỗi Data Đã Được Duyệt - $lName";
                        $emailBody = "<h3>Báo cáo lỗi Data được phê duyệt</h3>
                                      <p>Chào $cName,</p>
                                      <p>Báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã được Quản trị viên <strong>$adminName</strong> duyệt thành công.</p>
                                      <p><strong>Lý do duyệt:</strong> " . (!empty($approval_reason) ? htmlspecialchars($approval_reason) : "Không có lý do cụ thể") . "</p>
                                      <p>Hệ thống đã tự động cộng 1 lượt đền bù cho bạn trong vòng phân bổ hiện tại.</p>";
                    }
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

                            $timeline = getLeadHistoryTimeline($conn, $report['lead_id'], true);

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

    case 'compensate_approved_no_comp':
        $input = json_decode(file_get_contents('php://input'), true);
        $report_id = (int) ($input['id'] ?? 0);
        if (!$report_id) {
            echo json_encode(['success' => false, 'message' => 'ID báo cáo không hợp lệ']);
            break;
        }

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

        $conn->begin_transaction();
        try {
            // Fetch report information
            $stmt = $conn->prepare("
                SELECT r.lead_id, r.consultant_id, r.round_id, r.reason, r.status, c.name as consultant_name
                FROM data_reports r
                LEFT JOIN consultants c ON r.consultant_id = c.id
                WHERE r.id = ? FOR UPDATE
            ");
            $stmt->bind_param("i", $report_id);
            $stmt->execute();
            $report = $stmt->get_result()->fetch_assoc();

            if (!$report) {
                throw new Exception("Báo cáo không tồn tại.");
            }
            if ($report['status'] !== 'approved_no_comp') {
                throw new Exception("Báo cáo không ở trạng thái Duyệt không bù.");
            }

            // 1. Update report status to 'approved'
            $updRep = $conn->prepare("UPDATE data_reports SET status='approved', resolved_by=?, resolved_at=(SELECT created_at FROM leads WHERE id=data_reports.lead_id) WHERE id=?");
            $updRep->bind_param("si", $adminName, $report_id);
            $updRep->execute();

            // 2. Add compensation note to lead
            $compMsg = "\n[LỖI - ĐÃ BÙ LỖI TRỄ]: Chuyển trạng thái sang đền bù | Admin duyệt: " . $adminName . " | Thời gian: " . date('d/m/Y H:i:s');
            $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), ?) WHERE id=?");
            $updLead->bind_param("si", $compMsg, $report['lead_id']);
            $updLead->execute();

            // 3. Update distribution_logs status to 'error'
            $updLog = $conn->prepare("UPDATE distribution_logs SET status='error' WHERE lead_id=? AND assigned_to=? AND round_id=?");
            $updLog->bind_param("iii", $report['lead_id'], $report['consultant_id'], $report['round_id']);
            $updLog->execute();

            // 4. Increment compensation_count
            $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id=? AND consultant_id=?");
            $updComp->bind_param("ii", $report['round_id'], $report['consultant_id']);
            $updComp->execute();

            logAdminAction($conn, $decodedUser['id'], 'COMPENSATE_APPROVED_NO_COMP', [
                'report_id' => $report_id,
                'lead_id' => $report['lead_id'],
                'consultant_id' => $report['consultant_id'],
                'round_id' => $report['round_id']
            ]);

            $conn->commit();
            
            // Trigger Live Two-Way Sync
            require_once __DIR__ . '/webhook_logic.php';
            triggerTwoWaySync($conn, $report['lead_id']);

        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // DB committed successfully, now handle Zalo and Email notifications
        try {
            // Get consultant details
            $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $consultStmt->bind_param("i", $report['consultant_id']);
            $consultStmt->execute();
            $consultant = $consultStmt->get_result()->fetch_assoc();
            $consultStmt->close();

            // Get lead details
            $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
            $leadStmt->bind_param("i", $report['lead_id']);
            $leadStmt->execute();
            $lead = $leadStmt->get_result()->fetch_assoc();
            $leadStmt->close();

            $cName = $consultant['name'] ?? 'Tư vấn viên';
            $lName = $lead['name'] ?? 'Khách hàng';
            $lPhone = $lead['phone'] ?? 'Không rõ';

            // Send Zalo Notification
            require_once __DIR__ . '/zalo_bot.php';
            $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
            $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

            if (!empty($botToken) && !empty($consultant['zalo_chat_id'])) {
                try {
                    $zaloMsg = "[ BÙ LỖI TICKET THÀNH CÔNG ]\n\n"
                        . "Chào $cName, ticket lỗi trước đó cho khách hàng $lName ($lPhone) của bạn đã được bù lỗi trễ bởi $adminName.\n\n"
                        . "Hệ thống đã cộng 1 lượt đền bù. Bạn sẽ nhận được Data mới vào lần phân bổ tiếp theo.";
                    sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg, false);
                } catch (Exception $zEx) {
                    error_log("Error sending Zalo message for late compensation: " . $zEx->getMessage());
                }
            }

            // Send Email Notification
            if (!empty($consultant['email'])) {
                try {
                    require_once __DIR__ . '/mailer.php';
                    $emailSubj = "[BOT] Ticket Lỗi Data Đã Được Bù Lỗi Trễ - $lName";
                    $emailBody = "<h3>Báo cáo lỗi Data đã được bù lỗi trễ</h3>
                                  <p>Chào $cName,</p>
                                  <p>Ticket báo cáo lỗi của bạn cho khách hàng <strong>$lName ($lPhone)</strong> đã được chuyển sang trạng thái <strong>Đền bù</strong> bởi Quản trị viên <strong>$adminName</strong>.</p>
                                  <p>Hệ thống đã tự động cộng 1 lượt đền bù cho bạn trong vòng phân bổ hiện tại.</p>";
                    sendEmailNotification($consultant['email'], $emailSubj, 'Kết quả Báo cáo', $emailBody, '');
                } catch (Exception $emailEx) {
                    error_log("Error sending email for late compensation: " . $emailEx->getMessage());
                }
            }
        } catch (Exception $notifyEx) {
            error_log("Outer notification error in compensate_approved_no_comp: " . $notifyEx->getMessage());
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

        // Lấy thông tin admin thực hiện sớm để ghi vào DB
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

            $stmt = $conn->prepare("UPDATE data_reports SET status='rejected', reject_reason=?, resolved_by=?, resolved_at=(SELECT created_at FROM leads WHERE id=data_reports.lead_id) WHERE id=?");
            $stmt->bind_param("ssi", $reject_reason, $adminName, $report_id);
            $stmt->execute();

            $rejectMsg = "[LỖI - ĐÃ TỪ CHỐI]: " . $report['reason'];
            if (!empty($reject_reason)) {
                $rejectMsg .= " | Lý do từ chối: " . $reject_reason;
            }
            $rejectMsg .= " | Admin từ chối: " . $adminName . " | Thời gian: " . date('d/m/Y H:i:s');

            $updLead = $conn->prepare("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '\n', ?) WHERE id=?");
            $updLead->bind_param("si", $rejectMsg, $report['lead_id']);
            $updLead->execute();

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
            // Lấy thông tin Sale & Lead để gửi thông báo
            $consultStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            $consultStmt->bind_param("i", $report['consultant_id']);
            $consultStmt->execute();
            $consultant = $consultStmt->get_result()->fetch_assoc();
            $consultStmt->close(); // Close open statement properly to avoid out of sync errors

            $leadStmt = $conn->prepare("SELECT name, phone FROM leads WHERE id = ? LIMIT 1");
            $leadStmt->bind_param("i", $report['lead_id']);
            $leadStmt->execute();
            $lead = $leadStmt->get_result()->fetch_assoc();
            $leadStmt->close(); // Close open statement properly to avoid out of sync errors


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
                    sendZaloMessage($botToken, $consultant['zalo_chat_id'], $zaloMsg, false);
                } catch (Exception $zEx1) {
                    error_log("Error sending Zalo to sale in reject_report: " . $zEx1->getMessage());
                }
            }

            // [TẠM TẮT] Zalo cho các Ticket Admins (trừ admin thực hiện)
            /*
            if (!empty($botToken) && !empty($adminEmails)) {
                $adminChatIds = [];
                foreach ($adminEmails as $adm) {
                    if (!empty($adm['zalo_chat_id'])) {
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
                        sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg, false);
                    } catch (Exception $zEx2) {
                        error_log("Error sending Zalo to multiple admins in reject_report: " . $zEx2->getMessage());
                    }
                }
            }
            */

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
                    // [TẠM TẮT CC ADMIN]
                    /*
                    foreach ($adminEmails as $adm) {
                        if (!empty($adm['email'])) {
                            $email = trim($adm['email']);
                            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                                $ccEmailsArr[] = strtolower($email);
                            }
                        }
                    }
                    */
                    $ccEmailsArr = array_unique($ccEmailsArr);
                    $saleEmail = strtolower(trim($consultant['email']));
                    $ccEmailsArr = array_filter($ccEmailsArr, fn($e) => $e !== $saleEmail);
                    $ccString = implode(',', $ccEmailsArr);

                    $emailSubj = "[BOT] Ticket Lỗi Data Bị Từ Chối - $lName";
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

    case 'get_held_leads':
        // Retrieve query parameters
        $status = isset($_GET['status']) ? trim($_GET['status']) : 'pending_approval';
        $consultant = isset($_GET['consultant']) ? trim($_GET['consultant']) : ''; // unused but matched format
        $date = isset($_GET['date']) ? trim($_GET['date']) : 'Tháng này';

        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : 50;
        if ($page < 1)
            $page = 1;
        if ($pageSize < 1)
            $pageSize = 50;
        $offset = ($page - 1) * $pageSize;

        // Build base condition
        $conds = [];
        $params = [];
        $types = "";

        // Filter by queue status, rejected substandard, or approved substandard leads
        if ($status === 'rejected') {
            $conds[] = "l.status IN ('rejected', 'blacklisted')";
        } else if ($status === 'approved') {
            $conds[] = "(l.status = 'active' AND (l.ai_screener_status IN ('failed', 'error') OR l.note LIKE '%[Duyệt %'))";
        } else if ($status === 'ai_pending') {
            $conds[] = "l.status = 'pending_approval' AND (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        } else {
            $conds[] = "l.status = 'pending_approval' AND NOT ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) )";
        }

        // Search text filter
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        if ($search !== '') {
            $conds[] = "(l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)";
            $searchVal = "%$search%";
            $params[] = $searchVal;
            $params[] = $searchVal;
            $params[] = $searchVal;
            $types .= "sss";
        }

        // Parse date condition using l.created_at
        $dateCondition = "l.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND l.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";

        if ($date === 'all' || $date === '') {
            $dateCondition = "1=1";
        } else if ($date === 'Hôm nay') {
            $dateCondition = "l.created_at >= CURDATE() AND l.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        } else if ($date === 'Hôm qua') {
            $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND l.created_at < CURDATE()";
        } else if ($date === 'Tuần này') {
            $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND l.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === 'Tuần trước') {
            $dateCondition = "l.created_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND l.created_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
        } else if ($date === 'Tuần trước nữa') {
            $dateCondition = "l.created_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND l.created_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === '7 ngày qua') {
            $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } else if ($date === '30 ngày qua') {
            $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        } else if ($date === 'Tháng này') {
            $dateCondition = "l.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND l.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
        } else if ($date === 'Tháng trước') {
            $dateCondition = "l.created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND l.created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "l.created_at >= '$start 00:00:00' AND l.created_at <= '$end 23:59:59'";
        }

        if (in_array($status, ['rejected', 'approved'])) {
            if ($dateCondition !== "1=1") {
                $conds[] = $dateCondition;
            }
        }

        $where = count($conds) > 0 ? "WHERE " . implode(" AND ", $conds) : "";

        // Query 1: Get counts for all tabs under current search and date filters
        $commonConds = [];
        $commonParams = [];
        $commonTypes = "";
        if ($search !== '') {
            $commonConds[] = "(l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)";
            $commonParams[] = $searchVal;
            $commonParams[] = $searchVal;
            $commonParams[] = $searchVal;
            $commonTypes .= "sss";
        }
        $whereCommon = count($commonConds) > 0 ? "WHERE " . implode(" AND ", $commonConds) : "";

        $countsSql = "
            SELECT 
                SUM(CASE WHEN l.status = 'pending_approval' AND NOT ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ) THEN 1 ELSE 0 END) as queue_cnt,
                SUM(CASE WHEN l.status = 'pending_approval' AND ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ) THEN 1 ELSE 0 END) as ai_pending_cnt,
                SUM(CASE WHEN (l.status IN ('rejected', 'blacklisted')) AND ($dateCondition) THEN 1 ELSE 0 END) as substandard_cnt,
                SUM(CASE WHEN (l.status = 'active' AND (l.ai_screener_status IN ('failed', 'error') OR l.note LIKE '%[Duyệt %')) AND ($dateCondition) THEN 1 ELSE 0 END) as assigned_cnt
            FROM leads l
            $whereCommon
        ";
        $stmtCounts = $conn->prepare($countsSql);
        if (count($commonParams) > 0) {
            $stmtCounts->bind_param($commonTypes, ...$commonParams);
        }
        $stmtCounts->execute();
        $countsRes = $stmtCounts->get_result()->fetch_assoc();
        $stmtCounts->close();

        $queueCount = (int) ($countsRes['queue_cnt'] ?? 0);
        $aiPendingCount = (int) ($countsRes['ai_pending_cnt'] ?? 0);
        $substandardCount = (int) ($countsRes['substandard_cnt'] ?? 0);
        $assignedCount = (int) ($countsRes['assigned_cnt'] ?? 0);

        if ($status === 'rejected') {
            $totalCount = $substandardCount;
        } else if ($status === 'approved') {
            $totalCount = $assignedCount;
        } else if ($status === 'ai_pending') {
            $totalCount = $aiPendingCount;
        } else {
            $totalCount = $queueCount;
        }

        // Query 2: Get paginated records
        $recordsSql = "
            SELECT l.*, dr.round_name, c.name as consultant_name, c.avatar as consultant_avatar,
                   (SELECT dl.status FROM distribution_logs dl WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1) as log_status
            FROM leads l
            LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
            LEFT JOIN consultants c ON l.assigned_to = c.id
            $where
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        ";
        $stmtRecords = $conn->prepare($recordsSql);

        $recordsParams = $params;
        $recordsTypes = $types;
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
        $stmtRecords->close();

        $adminAvatars = [];
        $avatarQuery = $conn->query("SELECT name, avatar FROM accounts WHERE (role = 'admin' OR role = 'superadmin') OR role = 'superadmin'");
        if ($avatarQuery) {
            while ($row = $avatarQuery->fetch_assoc()) {
                if (!empty($row['avatar'])) {
                    $adminAvatars[$row['name']] = $row['avatar'];
                }
            }
        }

        echo json_encode([
            'success' => true,
            'data' => $data,
            'total_count' => $totalCount,
            'admin_avatars' => $adminAvatars,
            'counts' => [
                'queue' => $queueCount,
                'ai_pending' => $aiPendingCount,
                'substandard' => $substandardCount,
                'assigned' => $assignedCount
            ],
            'stats' => [
                'pending' => $totalCount
            ]
        ]);
        break;

    case 'check_lead_duplicate':
        require_once __DIR__ . '/webhook_logic.php';
        $input = trim($_GET['input'] ?? '');
        if (empty($input)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập số điện thoại hoặc email.']);
            break;
        }

        $phone = '';
        $email = '';
        if (filter_var($input, FILTER_VALIDATE_EMAIL)) {
            $email = $input;
        } else {
            $phone = normalizePhone($input);
        }

        $dupCheckMonths = (int)get_system_setting($conn, 'duplicate_check_months');
        if ($dupCheckMonths <= 0) {
            $dupCheckMonths = 6;
        }

        $crmCheck = checkCRMInteraction($conn, $phone, $email, true);

        // Fetch matched lead history
        $leads = [];
        $p1 = $phone;
        $p2 = '84' . ltrim($phone, '0');
        
        $sql = "
            SELECT l.*, 
                   COALESCE(dr.round_name, (SELECT r.round_name FROM distribution_logs dl JOIN distribution_rounds r ON dl.round_id = r.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as round_name,
                   COALESCE(c.name, (SELECT c2.name FROM distribution_logs dl JOIN consultants c2 ON dl.assigned_to = c2.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as consultant_name,
                   COALESCE(c.avatar, (SELECT c2.avatar FROM distribution_logs dl JOIN consultants c2 ON dl.assigned_to = c2.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as consultant_avatar
            FROM leads l
            LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
            LEFT JOIN consultants c ON l.assigned_to = c.id
            WHERE 1=0
        ";
        if (!empty($phone)) {
            $sql = "
                SELECT l.*, 
                       COALESCE(dr.round_name, (SELECT r.round_name FROM distribution_logs dl JOIN distribution_rounds r ON dl.round_id = r.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as round_name,
                       COALESCE(c.name, (SELECT c2.name FROM distribution_logs dl JOIN consultants c2 ON dl.assigned_to = c2.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as consultant_name,
                       COALESCE(c.avatar, (SELECT c2.avatar FROM distribution_logs dl JOIN consultants c2 ON dl.assigned_to = c2.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as consultant_avatar
                FROM leads l
                LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
                LEFT JOIN consultants c ON l.assigned_to = c.id
                WHERE l.phone = ? OR l.phone = ? OR l.phone LIKE ?
                ORDER BY l.last_interaction_date DESC, l.created_at DESC
            ";
        } else if (!empty($email)) {
            $sql = "
                SELECT l.*, 
                       COALESCE(dr.round_name, (SELECT r.round_name FROM distribution_logs dl JOIN distribution_rounds r ON dl.round_id = r.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as round_name,
                       COALESCE(c.name, (SELECT c2.name FROM distribution_logs dl JOIN consultants c2 ON dl.assigned_to = c2.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as consultant_name,
                       COALESCE(c.avatar, (SELECT c2.avatar FROM distribution_logs dl JOIN consultants c2 ON dl.assigned_to = c2.id WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1)) as consultant_avatar
                FROM leads l
                LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
                LEFT JOIN consultants c ON l.assigned_to = c.id
                WHERE l.email = ?
                ORDER BY l.last_interaction_date DESC, l.created_at DESC
            ";
        }

        $stmt = $conn->prepare($sql);
        if ($stmt) {
            if (!empty($phone)) {
                $likePhone = '%' . $phone . '%';
                $stmt->bind_param("sss", $p1, $p2, $likePhone);
            } else if (!empty($email)) {
                $stmt->bind_param("s", $email);
            }
            
            $stmt->execute();
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $leads[] = $row;
            }
            $stmt->close();
        }

        echo json_encode([
            'success' => true,
            'duplicate_check_months' => $dupCheckMonths,
            'crm_check' => $crmCheck,
            'history' => $leads
        ]);
        break;

    case 'get_gatekeeper_stats':
        try {
            $date = isset($_GET['date']) ? trim($_GET['date']) : 'Tháng này';

            // Parse date condition using l.created_at
            $dateCondition = "l.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND l.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
            if ($date === 'all' || $date === '') {
                $dateCondition = "1=1";
            } else if ($date === 'Hôm nay') {
                $dateCondition = "l.created_at >= CURDATE() AND l.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
            } else if ($date === 'Hôm qua') {
                $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND l.created_at < CURDATE()";
            } else if ($date === 'Tuần này') {
                $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND l.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            } else if ($date === 'Tuần trước') {
                $dateCondition = "l.created_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND l.created_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
            } else if ($date === 'Tuần trước nữa') {
                $dateCondition = "l.created_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND l.created_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            } else if ($date === '7 ngày qua') {
                $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            } else if ($date === '30 ngày qua') {
                $dateCondition = "l.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
            } else if ($date === 'Tháng này') {
                $dateCondition = "l.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND l.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
            } else if ($date === 'Tháng trước') {
                $dateCondition = "l.created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND l.created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
            } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
                $start = $conn->real_escape_string($matches[1]);
                $end = $conn->real_escape_string($matches[2]);
                $dateCondition = "l.created_at >= '$start 00:00:00' AND l.created_at <= '$end 23:59:59'";
            }

            // Helper to execute query safely and throw exception on error
            $safeQuery = function ($sql) use ($conn) {
                $res = $conn->query($sql);
                if (!$res) {
                    throw new Exception("Query failed: " . $conn->error . " | SQL: " . $sql);
                }
                return $res;
            };

            // Calculate 4 categories
            $countDuyetSql = "SELECT COUNT(*) as cnt FROM leads l WHERE l.status = 'active' AND l.ai_screener_status = 'passed' AND l.note NOT LIKE '%[Duyệt %' AND $dateCondition";
            $countDuyet = (int) ($safeQuery($countDuyetSql)->fetch_assoc()['cnt'] ?? 0);

            $countAiGiuSql = "SELECT COUNT(*) as cnt FROM leads l WHERE l.status = 'pending_approval' AND $dateCondition";
            $countAiGiu = (int) ($safeQuery($countAiGiuSql)->fetch_assoc()['cnt'] ?? 0);

            $countDuoiChuanSql = "SELECT COUNT(*) as cnt FROM leads l WHERE l.status IN ('rejected', 'blacklisted') AND $dateCondition";
            $countDuoiChuan = (int) ($safeQuery($countDuoiChuanSql)->fetch_assoc()['cnt'] ?? 0);

            $countGiaoLeadSql = "SELECT COUNT(*) as cnt FROM leads l WHERE l.status = 'active' AND (l.ai_screener_status IN ('failed', 'error') OR l.note LIKE '%[Duyệt %') AND $dateCondition";
            $countGiaoLead = (int) ($safeQuery($countGiaoLeadSql)->fetch_assoc()['cnt'] ?? 0);

            $totalLeads = $countDuyet + $countAiGiu + $countDuoiChuan + $countGiaoLead;
            $totalBelowStandard = $countDuoiChuan;
            $totalHeld = $countAiGiu;
            $totalRejected = $countDuoiChuan;

            $ratio = $totalLeads > 0 ? round(($totalBelowStandard / $totalLeads) * 100, 1) : 0;

            // 2. Breakdown by Vòng phân bổ (Rounds)
            $roundsSql = "
                SELECT 
                    l.target_round_id, 
                    COALESCE(dr.round_name, 'Chưa phân vòng') as round_name, 
                    COUNT(*) as cnt
                FROM leads l
                LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
                WHERE l.status IN ('rejected', 'blacklisted') AND $dateCondition
                GROUP BY l.target_round_id, dr.round_name
                ORDER BY cnt DESC
            ";
            $roundsRes = $safeQuery($roundsSql);
            $roundsBreakdown = [];
            if ($roundsRes) {
                while ($row = $roundsRes->fetch_assoc()) {
                    $roundsBreakdown[] = [
                        'round_id' => $row['target_round_id'],
                        'round_name' => $row['round_name'],
                        'count' => (int) $row['cnt']
                    ];
                }
            }

            // 3. Breakdown by Nguồn kết nối / Source (fixed sc.name -> sc.sheet_name)
            $sourcesSql = "
                SELECT 
                    l.connection_id,
                    COALESCE(sc.sheet_name, l.source, 'Khác/Tự nhập') as source_name,
                    COUNT(*) as cnt
                FROM leads l
                LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
                WHERE l.status IN ('rejected', 'blacklisted') AND $dateCondition
                GROUP BY l.connection_id, sc.sheet_name, l.source
                ORDER BY cnt DESC
            ";
            $sourcesRes = $safeQuery($sourcesSql);
            $sourcesBreakdown = [];
            if ($sourcesRes) {
                while ($row = $sourcesRes->fetch_assoc()) {
                    $sourcesBreakdown[] = [
                        'connection_id' => $row['connection_id'],
                        'source_name' => $row['source_name'],
                        'count' => (int) $row['cnt']
                    ];
                }
            }

            // 4. Breakdown by Reasons (dynamic from database, not hardcoded)
            $reasonsSql = "
                SELECT 
                    COALESCE(NULLIF(TRIM(l.ai_evaluation), ''), NULLIF(TRIM(l.note), ''), 'Chưa rõ lý do') as reason_name,
                    COUNT(*) as cnt
                FROM leads l
                WHERE l.status IN ('rejected', 'blacklisted') AND $dateCondition
                GROUP BY reason_name
                ORDER BY cnt DESC
                LIMIT 5
            ";
            $reasonsRes = $safeQuery($reasonsSql);
            $reasonsBreakdown = [];
            if ($reasonsRes) {
                while ($row = $reasonsRes->fetch_assoc()) {
                    $reasonText = trim($row['reason_name']);
                    if (mb_strlen($reasonText) > 60) {
                        $reasonText = mb_substr($reasonText, 0, 60) . '...';
                    }
                    $reasonsBreakdown[] = [
                        'reason' => $reasonText,
                        'count' => (int) $row['cnt']
                    ];
                }
            }

            // 5. Fetch recent below-standard leads for pagination
            $recentSql = "
                SELECT l.id, l.name, l.phone, l.email, l.source, l.note, l.ai_evaluation, l.status, l.created_at, dr.round_name
                FROM leads l
                LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
                WHERE l.status IN ('rejected', 'blacklisted') AND $dateCondition
                ORDER BY l.created_at DESC
            ";
            $recentRes = $safeQuery($recentSql);
            $recentBelowStandard = [];
            if ($recentRes) {
                while ($row = $recentRes->fetch_assoc()) {
                    $recentBelowStandard[] = $row;
                }
            }

            echo json_encode([
                'success' => true,
                'stats' => [
                    'total_leads' => $totalLeads,
                    'total_below_standard' => $totalBelowStandard,
                    'ratio_below_standard' => $ratio,
                    'total_held' => $totalHeld,
                    'total_rejected' => $totalRejected,
                    'count_duyet' => $countDuyet,
                    'count_ai_giu' => $countAiGiu,
                    'count_duoi_chuan' => $countDuoiChuan,
                    'count_giao_lead' => $countGiaoLead
                ],
                'rounds_breakdown' => $roundsBreakdown,
                'sources_breakdown' => $sourcesBreakdown,
                'reasons_breakdown' => $reasonsBreakdown,
                'recent_below_standard' => $recentBelowStandard
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Lỗi SQL/PHP: ' . $e->getMessage()
            ]);
        }
        break;

    case 'get_ai_token_stats':
        try {
            $date = isset($_GET['date']) ? trim($_GET['date']) : 'Tháng này';
            $dbVer = 0;
            $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
            if ($vStmt && $vStmt->num_rows > 0) {
                $dbVer = (int)$vStmt->fetch_assoc()['setting_value'];
            }
            $dateField = ($dbVer >= 140) ? "COALESCE(l.ai_screening_started_at, l.created_at)" : "l.created_at";

            // Parse date condition using l.created_at fallback
            $dateCondition = "$dateField >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND $dateField < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
            if ($date === 'all' || $date === '') {
                $dateCondition = "1=1";
            } else if ($date === 'Hôm nay') {
                $dateCondition = "$dateField >= CURDATE() AND $dateField < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
            } else if ($date === 'Hôm qua') {
                $dateCondition = "$dateField >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND $dateField < CURDATE()";
            } else if ($date === 'Tuần này') {
                $dateCondition = "$dateField >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND $dateField < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            } else if ($date === 'Tuần trước') {
                $dateCondition = "$dateField >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND $dateField < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
            } else if ($date === 'Tuần trước nữa') {
                $dateCondition = "$dateField >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND $dateField < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            } else if ($date === '7 ngày qua') {
                $dateCondition = "$dateField >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            } else if ($date === '30 ngày qua') {
                $dateCondition = "$dateField >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
            } else if ($date === 'Tháng này') {
                $dateCondition = "$dateField >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND $dateField < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
            } else if ($date === 'Tháng trước') {
                $dateCondition = "$dateField >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND $dateField < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
            } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
                $start = $conn->real_escape_string($matches[1]);
                $end = $conn->real_escape_string($matches[2]);
                $dateCondition = "$dateField >= '$start 00:00:00' AND $dateField <= '$end 23:59:59'";
            }

            // Helper to execute query safely and throw exception on error
            $safeQuery = function ($sql) use ($conn) {
                $res = $conn->query($sql);
                if (!$res) {
                    throw new Exception("Query failed: " . $conn->error . " | SQL: " . $sql);
                }
                return $res;
            };

            // 1. General stats
            $genSql = "
                SELECT 
                    COUNT(*) as total_leads,
                    IFNULL(SUM(l.ai_prompt_tokens), 0) as prompt_tokens,
                    IFNULL(SUM(l.ai_completion_tokens), 0) as completion_tokens,
                    IFNULL(SUM(l.ai_total_tokens), 0) as total_tokens
                FROM leads l
                WHERE l.ai_screener_status != 'not_screened' AND $dateCondition
            ";
            $genRow = $safeQuery($genSql)->fetch_assoc();
            $stats = [
                'total_leads' => (int)($genRow['total_leads'] ?? 0),
                'prompt_tokens' => (int)($genRow['prompt_tokens'] ?? 0),
                'completion_tokens' => (int)($genRow['completion_tokens'] ?? 0),
                'total_tokens' => (int)($genRow['total_tokens'] ?? 0)
            ];

            // 2. Breakdown by Rounds
            $roundsSql = "
                SELECT 
                    l.target_round_id, 
                    COALESCE(dr.round_name, 'Chưa phân vòng') as round_name, 
                    COUNT(*) as lead_count,
                    IFNULL(SUM(l.ai_prompt_tokens), 0) as prompt_tokens,
                    IFNULL(SUM(l.ai_completion_tokens), 0) as completion_tokens,
                    IFNULL(SUM(l.ai_total_tokens), 0) as total_tokens
                FROM leads l
                LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
                WHERE l.ai_screener_status != 'not_screened' AND $dateCondition
                GROUP BY l.target_round_id, dr.round_name
                ORDER BY total_tokens DESC
            ";
            $roundsRes = $safeQuery($roundsSql);
            $roundsBreakdown = [];
            while ($row = $roundsRes->fetch_assoc()) {
                $roundsBreakdown[] = [
                    'round_id' => $row['target_round_id'],
                    'round_name' => $row['round_name'],
                    'lead_count' => (int)$row['lead_count'],
                    'prompt_tokens' => (int)$row['prompt_tokens'],
                    'completion_tokens' => (int)$row['completion_tokens'],
                    'total_tokens' => (int)$row['total_tokens']
                ];
            }

            // 3. Breakdown by Connection
            $sourcesSql = "
                SELECT 
                    l.connection_id,
                    COALESCE(sc.sheet_name, l.source, 'Khác/Tự nhập') as source_name,
                    COUNT(*) as lead_count,
                    IFNULL(SUM(l.ai_prompt_tokens), 0) as prompt_tokens,
                    IFNULL(SUM(l.ai_completion_tokens), 0) as completion_tokens,
                    IFNULL(SUM(l.ai_total_tokens), 0) as total_tokens
                FROM leads l
                LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
                WHERE l.ai_screener_status != 'not_screened' AND $dateCondition
                GROUP BY l.connection_id, sc.sheet_name, l.source
                ORDER BY total_tokens DESC
            ";
            $sourcesRes = $safeQuery($sourcesSql);
            $sourcesBreakdown = [];
            while ($row = $sourcesRes->fetch_assoc()) {
                $sourcesBreakdown[] = [
                    'connection_id' => $row['connection_id'],
                    'source_name' => $row['source_name'],
                    'lead_count' => (int)$row['lead_count'],
                    'prompt_tokens' => (int)$row['prompt_tokens'],
                    'completion_tokens' => (int)$row['completion_tokens'],
                    'total_tokens' => (int)$row['total_tokens']
                ];
            }

            // 4. Recent AI leads (Paginated for performance optimization)
            $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
            $pageSize = isset($_GET['pageSize']) ? max(1, (int)$_GET['pageSize']) : 20;
            $offset = ($page - 1) * $pageSize;

            $countSql = "
                SELECT COUNT(*) as cnt 
                FROM leads l 
                WHERE l.ai_screener_status != 'not_screened' AND $dateCondition
            ";
            $countRow = $safeQuery($countSql)->fetch_assoc();
            $totalRecentLeads = (int)($countRow['cnt'] ?? 0);

            $recentSql = "
                SELECT 
                    l.id, 
                    l.name, 
                    l.phone, 
                    l.email, 
                    l.source, 
                    l.ai_screener_status, 
                    l.ai_prompt_tokens, 
                    l.ai_completion_tokens, 
                    l.ai_total_tokens, 
                    " . (($dbVer >= 140) ? "COALESCE(l.ai_screening_started_at, l.created_at)" : "l.created_at") . " as created_at, 
                    COALESCE(dr.round_name, 'Chưa phân vòng') as round_name
                FROM leads l
                LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
                WHERE l.ai_screener_status != 'not_screened' AND $dateCondition
                ORDER BY " . (($dbVer >= 140) ? "COALESCE(l.ai_screening_started_at, l.created_at)" : "l.created_at") . " DESC
                LIMIT $pageSize OFFSET $offset
            ";
            $recentRes = $safeQuery($recentSql);
            $recentLeads = [];
            while ($row = $recentRes->fetch_assoc()) {
                $recentLeads[] = $row;
            }

            echo json_encode([
                'success' => true,
                'stats' => $stats,
                'rounds_breakdown' => $roundsBreakdown,
                'sources_breakdown' => $sourcesBreakdown,
                'recent_leads' => $recentLeads,
                'total_recent_leads' => $totalRecentLeads
            ]);

        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Lỗi SQL/PHP: ' . $e->getMessage()
            ]);
        }
        break;

    case 'preview_held_lead_assignment':
        require_once __DIR__ . '/webhook_logic.php';
        $lead_id = (int) ($_GET['lead_id'] ?? 0);
        if ($lead_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID data không hợp lệ.']);
            break;
        }

        $stmt = $conn->prepare("SELECT target_round_id FROM leads WHERE id = ? LIMIT 1");
        $stmt->bind_param("i", $lead_id);
        $stmt->execute();
        $lead = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$lead) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy data tương ứng.']);
            break;
        }

        $roundId = (int) ($_GET['round_id'] ?? $lead['target_round_id'] ?? 0);
        if ($roundId <= 0) {
            echo json_encode(['success' => true, 'consultant' => null, 'message' => 'Không chỉ định vòng phân bổ. Sẽ chuyển thẳng cho Admin mặc định.']);
            break;
        }

        $preview = simulateNextConsultantInRound($conn, $roundId);
        if ($preview) {
            echo json_encode([
                'success' => true,
                'consultant' => $preview,
                'message' => 'Tư vấn viên tiếp theo dự kiến nhận số.'
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'consultant' => null,
                'message' => 'Không có tư vấn viên nào đang hoạt động trong vòng này.'
            ]);
        }
        break;

    case 'approve_held_lead':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $lead_id = (int) ($input['lead_id'] ?? 0);
        if (!$lead_id) {
            echo json_encode(['success' => false, 'message' => 'ID data không hợp lệ']);
            break;
        }

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

        $conn->begin_transaction();
        try {
            // 1. Fetch and lock lead
            $stmt = $conn->prepare("SELECT * FROM leads WHERE id = ? AND status = 'pending_approval' FOR UPDATE");
            $stmt->bind_param("i", $lead_id);
            $stmt->execute();
            $lead = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$lead) {
                throw new Exception("Lead không tồn tại hoặc đã được xử lý duyệt trước đó.");
            }

            $targetRoundId = (int) ($input['round_id'] ?? $lead['target_round_id'] ?? 0);
            $assignedConsultantId = null;
            $status = 'unassigned';
            $message = 'Không khớp vòng phân bổ hoặc vòng không hoạt động.';

            $isFallbackAdmin = false;
            $fallbackAdminData = null;
            $fallbackCcEmails = '';

            // --- Check CRM (Duplication & dynamic threshold rule) ---
            require_once __DIR__ . '/webhook_logic.php';
            $phone = $lead['phone'] ?? '';
            $email = $lead['email'] ?? '';
            $crmCheckResult = checkCRMInteraction($conn, $phone, $email, false, $lead_id);

            // Load dynamic duplicate check threshold
            $dupCheckMonths = (int)get_system_setting($conn, 'duplicate_check_months');
            if ($dupCheckMonths <= 0) {
                $dupCheckMonths = 6;
            }

            $isDuplicate = false;
            if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
                $assignedConsultantId = $crmCheckResult['assignedTo'];
                $status = 'reminder';
                $message = 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng.';
                $isDuplicate = true;
            }

            $dupSuffix = '';
            if ($crmCheckResult['isDuplicate']) {
                $oldSaleName = !empty($crmCheckResult['assignedName']) ? $crmCheckResult['assignedName'] : 'Không rõ';
                $oldSaleMonths = $crmCheckResult['monthsSinceLastInteraction'];
                $dupSuffix = " (Trùng số: Sale cũ $oldSaleName > $oldSaleMonths tháng).";
            }

            // Append duplicate note if duplicate exists
            if ($crmCheckResult['isDuplicate']) {
                $prevName = $crmCheckResult['assignedName'] ?? 'Sale cũ';
                $prevDate = !empty($crmCheckResult['lastInteractionDate']) ? date('d/m/Y', strtotime($crmCheckResult['lastInteractionDate'])) : 'Không rõ';
                $dupMonths = $crmCheckResult['monthsSinceLastInteraction'] ?? $dupCheckMonths;
                $noteAppend = "\n[Lưu ý: Trùng số của $prevName trên $dupMonths tháng. Cập nhật lần cuối: $prevDate]";
                $lead['note'] .= $noteAppend;
            }

            // Run Round Robin assignment
            if ($isDuplicate) {
                // Skip Round-Robin, keep duplicate owner
            } else if ($targetRoundId > 0) {
                $assignResult = getNextConsultantInRound($conn, $targetRoundId);
                if ($assignResult) {
                    $assignedConsultantId = $assignResult['id'];
                    $status = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                    $message = $assignResult['is_compensation']
                        ? (isset($assignResult['is_starvation']) ? 'Được phân bổ bù lượt ngoài giờ/nghỉ phép (Starvation Prevention).' : 'Được phân bổ đền bù lượt lỗi.')
                        : 'Được phân bổ tự động qua vòng xoay.';
                    $message .= $dupSuffix;

                    // Check work hours
                    $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
                    $whStmt->bind_param("i", $assignedConsultantId);
                    $whStmt->execute();
                    $whRes = $whStmt->get_result();
                    if ($whRes && $whRow = $whRes->fetch_assoc()) {
                        $whStart = $whRow['work_start_time'] ?? '00:00';
                        $whEnd = $whRow['work_end_time'] ?? '23:59';
                        $workSchedule = $whRow['work_schedule'] ?? null;
                        $currentTime = date('H:i');
                        if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                            $status = 'pending_work_hours';
                            $message .= ' (Trì hoãn: ngoài khung giờ làm việc)';
                        }
                    }
                    $whStmt->close();
                } else {
                    $status = 'pending';
                    $message = 'No active consultants in this round.' . $dupSuffix;
                }
            } else {
                // Direct routing to Fallback Admin
                $fbSettings = [];
                $fbRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('fallback_type', 'fallback_admin_id', 'fallback_cc_email')");
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
                        $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND (role = 'admin' OR role = 'superadmin') LIMIT 1");
                        if ($admStmt) {
                            $admStmt->bind_param("i", $fbAdminId);
                            $admStmt->execute();
                            $admRes = $admStmt->get_result();
                            if ($admRes->num_rows > 0) {
                                $fallbackAdminData = $admRes->fetch_assoc();
                                $isFallbackAdmin = true;
                                $status = 'fallback';
                                $message = 'No matching rule. Routed directly to fallback Admin: ' . $fallbackAdminData['name'];
                                $fallbackCcEmails = $fbCc;
                            }
                            $admStmt->close();
                        }
                    }
                }
            }

            // Append admin note
            $approveReason = trim($input['reason'] ?? '');
            if (empty($approveReason)) {
                $approveReason = 'Phê duyệt phân bổ lead';
            }
            $adminNote = "\n[Duyệt AI]: " . $approveReason . " | Admin: " . $adminName . " | Lúc: " . date('d/m/Y H:i:s');
            $note = $lead['note'] . $adminNote;

            // 2. Update Lead Table
            $updLead = $conn->prepare("UPDATE leads SET status = 'active', assigned_to = ?, note = ?, last_interaction_date = NOW(), target_round_id = ?, ai_screener_status = 'passed' WHERE id = ?");
            $updLead->bind_param("isii", $assignedConsultantId, $note, $targetRoundId, $lead_id);
            $updLead->execute();
            $updLead->close();

            // 3. Log Distribution (Clean up pending logs and insert approved log)
            $logMsg = $message . " (Admin phê duyệt)";
            $delStmt = $conn->prepare("DELETE FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval'");
            $delStmt->bind_param("i", $lead_id);
            $delStmt->execute();
            $delStmt->close();

            logDistribution($conn, $lead_id, $assignedConsultantId, $targetRoundId > 0 ? $targetRoundId : null, $status, $logMsg, false);

            logAdminAction($conn, $decodedUser['id'], 'APPROVE_HELD_LEAD', [
                'lead_id' => $lead_id,
                'name' => $lead['name'],
                'phone' => $lead['phone'],
                'assigned_to' => $assignedConsultantId,
                'round_id' => $targetRoundId
            ]);
            $conn->commit();
            triggerTwoWaySync($conn, $lead_id);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            break;
        }

        // Send notifications outside transaction
        try {
            require_once __DIR__ . '/mailer.php';
            require_once __DIR__ . '/zalo_bot.php';

            $ccEmails = '';
            $roundName = '';
            if ($targetRoundId > 0) {
                $stmtQ = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
                if ($stmtQ) {
                    $stmtQ->bind_param("i", $targetRoundId);
                    $stmtQ->execute();
                    $rData = $stmtQ->get_result()->fetch_assoc();
                    $ccEmails = $rData['cc_emails'] ?? '';
                    $roundName = $rData['round_name'] ?? '';
                    $stmtQ->close();
                }
            }

            if ($isFallbackAdmin && $fallbackAdminData) {
                try {
                    sendLeadAssignedEmailToSale(
                        $fallbackAdminData['email'],
                        $fallbackAdminData['name'],
                        $lead['name'],
                        $lead['phone'],
                        $lead['note'],
                        $lead['source'],
                        $fallbackCcEmails,
                        'Fallback Admin',
                        $lead_id,
                        0,
                        0
                    );
                } catch (Exception $e) {
                }
                if (!empty($fallbackAdminData['zalo_chat_id'])) {
                    try {
                        sendLeadAssignedZaloMessageToAdmin(
                            $fallbackAdminData['zalo_chat_id'],
                            $fallbackAdminData['name'],
                            $lead['name'],
                            $lead['phone'],
                            $lead['note'],
                            $lead['source'],
                            $lead_id,
                            $lead['email'],
                            $lead['type']
                        );
                    } catch (Exception $e) {
                    }
                }
            } else if ($assignedConsultantId > 0 && $status !== 'pending_work_hours') {
                $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                if ($stmtC) {
                    $stmtC->bind_param("i", $assignedConsultantId);
                    $stmtC->execute();
                    $c = $stmtC->get_result()->fetch_assoc();
                    $stmtC->close();
                    if ($c) {
                        if ($status === 'reminder') {
                            try {
                                $timeline = getLeadHistoryTimeline($conn, $lead_id, true);
                                sendLeadReminderEmailToSale(
                                    $c['email'],
                                    $c['name'],
                                    $lead['name'],
                                    $lead['phone'],
                                    $lead['note'],
                                    $lead['source'],
                                    $ccEmails,
                                    $roundName,
                                    $timeline,
                                    $lead_id
                                );
                            } catch (Exception $e) {
                            }
                            try {
                                $timeline = getLeadHistoryTimeline($conn, $lead_id, true);
                                sendLeadReminderZaloMessageToSale(
                                    $assignedConsultantId,
                                    $c['name'],
                                    $lead['name'],
                                    $lead['phone'],
                                    $lead['note'],
                                    $lead['source'],
                                    $roundName,
                                    $timeline,
                                    $lead_id,
                                    $lead['email'],
                                    $lead['type']
                                );
                            } catch (Exception $e) {
                            }
                        } else {
                            try {
                                sendLeadAssignedEmailToSale($c['email'], $c['name'], $lead['name'], $lead['phone'], $lead['note'], $lead['source'], $ccEmails, $roundName, $lead_id, $assignedConsultantId, $targetRoundId);
                            } catch (Exception $e) {
                            }
                            try {
                                sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $lead['name'], $lead['phone'], $lead['note'], $lead['source'], $roundName, $lead_id, $targetRoundId, $lead['email'], $lead['type']);
                            } catch (Exception $e) {
                            }
                        }
                    }
                }
            }
        } catch (Exception $notifyEx) {
            error_log("Error sending notifications after approve_held_lead: " . $notifyEx->getMessage());
        }

        echo json_encode(['success' => true]);
        break;

    case 'reject_held_lead':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $lead_id = (int) ($input['lead_id'] ?? 0);
        $reason = trim($input['reason'] ?? '');

        if (!$lead_id) {
            echo json_encode(['success' => false, 'message' => 'ID data không hợp lệ']);
            break;
        }
        if (empty($reason)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập lý do từ chối']);
            break;
        }

        $adminName = 'Quản trị viên';
        if (isset($decodedUser['id'])) {
            $admQuery = $conn->prepare("SELECT name FROM accounts WHERE id = ? LIMIT 1");
            $admQuery->bind_param("i", $decodedUser['id']);
            $admQuery->execute();
            $admRes = $admQuery->get_result()->fetch_assoc();
            if ($admRes && !empty($admRes['name'])) {
                $adminName = $admRes['name'];
            }
            $admQuery->close();
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("SELECT * FROM leads WHERE id = ? AND status = 'pending_approval' FOR UPDATE");
            $stmt->bind_param("i", $lead_id);
            $stmt->execute();
            $lead = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$lead) {
                throw new Exception("Lead không tồn tại hoặc đã được xử lý trước đó.");
            }

            $config = getScreenerConfigForRound($conn, $lead['target_round_id']);
            $bsFallbackEnabled = 0;
            $bsFallbackRoundId = 0;
            if ($config) {
                $bsFallbackEnabled = !empty($config['below_standard_fallback_enabled']) ? 1 : 0;
                $bsFallbackRoundId = !empty($config['below_standard_fallback_round_id']) ? (int) $config['below_standard_fallback_round_id'] : 0;
            } else {
                $bsFallbackEnabled = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_enabled');
                $bsFallbackRoundId = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_round_id');
            }

            if ($bsFallbackEnabled === 1 && $bsFallbackRoundId > 0) {
                // Route to fallback round!
                $targetRoundId = $bsFallbackRoundId;
                $assignedConsultantId = null;
                $status = 'unassigned';
                $message = 'Không khớp vòng phân bổ hoặc vòng không hoạt động.';

                $assignResult = getNextConsultantInRound($conn, $targetRoundId);
                if ($assignResult) {
                    $assignedConsultantId = $assignResult['id'];
                    $status = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                    $message = $assignResult['is_compensation']
                        ? (isset($assignResult['is_starvation']) ? 'Được phân bổ bù lượt ngoài giờ/nghỉ phép (Starvation Prevention).' : 'Được phân bổ đền bù lượt lỗi.')
                        : 'Được phân bổ tự động qua vòng xoay.';

                    // Check work hours
                    $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
                    $whStmt->bind_param("i", $assignedConsultantId);
                    $whStmt->execute();
                    $whRes = $whStmt->get_result();
                    if ($whRes && $whRow = $whRes->fetch_assoc()) {
                        $whStart = $whRow['work_start_time'] ?? '00:00';
                        $whEnd = $whRow['work_end_time'] ?? '23:59';
                        $workSchedule = $whRow['work_schedule'] ?? null;
                        $currentTime = date('H:i');
                        if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                            $status = 'pending_work_hours';
                            $message .= ' (Trì hoãn: ngoài khung giờ làm việc)';
                        }
                    }
                    $whStmt->close();
                } else {
                    $status = 'pending';
                    $message = 'No active consultants in this round.';
                }

                $adminNote = "\n[Xác nhận dưới chuẩn - Fallback]: " . $reason . " | Admin: " . $adminName . " | Lúc: " . date('d/m/Y H:i:s');
                $note = $lead['note'] . $adminNote;

                $upd = $conn->prepare("UPDATE leads SET status = 'active', target_round_id = ?, assigned_to = ?, note = ?, last_interaction_date = NOW(), ai_screener_status = 'failed' WHERE id = ?");
                $upd->bind_param("iiisi", $targetRoundId, $assignedConsultantId, $note, $lead_id);
                $upd->execute();
                $upd->close();

                $logMsg = $message . " (Admin xác nhận dưới chuẩn & Fallback)";
                $delStmt = $conn->prepare("DELETE FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval'");
                $delStmt->bind_param("i", $lead_id);
                $delStmt->execute();
                $delStmt->close();

                logDistribution($conn, $lead_id, $assignedConsultantId, $targetRoundId, $status, $logMsg, false);

                logAdminAction($conn, $decodedUser['id'], 'REJECT_HELD_LEAD', [
                    'lead_id' => $lead_id,
                    'name' => $lead['name'],
                    'phone' => $lead['phone'],
                    'reason' => $reason . " (Fallback to round " . $targetRoundId . ")"
                ]);

                $conn->commit();
                triggerTwoWaySync($conn, $lead_id);

                // Notifications
                try {
                    if ($assignedConsultantId && ($status === 'assigned' || $status === 'compensation')) {
                        $ccEmails = '';
                        $roundName = 'Vòng dưới chuẩn';
                        $stmtQ = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
                        if ($stmtQ) {
                            $stmtQ->bind_param("i", $targetRoundId);
                            $stmtQ->execute();
                            $rData = $stmtQ->get_result()->fetch_assoc();
                            if ($rData) {
                                $ccEmails = $rData['cc_emails'] ?? '';
                                $roundName = $rData['round_name'] ?? 'Vòng dưới chuẩn';
                            }
                            $stmtQ->close();
                        }

                        $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                        if ($stmtC) {
                            $stmtC->bind_param("i", $assignedConsultantId);
                            $stmtC->execute();
                            $c = $stmtC->get_result()->fetch_assoc();
                            $stmtC->close();
                            if ($c) {
                                require_once __DIR__ . '/mailer.php';
                                require_once __DIR__ . '/zalo_bot.php';
                                try {
                                    sendLeadAssignedEmailToSale($c['email'], $c['name'], $lead['name'], $lead['phone'], $note, $lead['source'], $ccEmails, $roundName, $lead_id, $assignedConsultantId, $targetRoundId);
                                } catch (Exception $e) {
                                }
                                try {
                                    sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $lead['name'], $lead['phone'], $note, $lead['source'], $roundName, $lead_id, $targetRoundId, $lead['email'], $lead['type']);
                                } catch (Exception $e) {
                                }
                            }
                        }
                    }
                } catch (Exception $notifyEx) {
                    error_log("Error sending notifications after reject_held_lead with fallback: " . $notifyEx->getMessage());
                }
            } else {
                $adminNote = "\n[Từ chối AI]: " . $reason . " | Admin: " . $adminName . " | Lúc: " . date('d/m/Y H:i:s');
                $note = $lead['note'] . $adminNote;

                $upd = $conn->prepare("UPDATE leads SET status = 'rejected', note = ?, ai_screener_status = 'failed' WHERE id = ?");
                $upd->bind_param("si", $note, $lead_id);
                $upd->execute();
                $upd->close();

                $logMsg = "Từ chối bởi Admin: " . $reason;
                $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
                $chkLog->bind_param("i", $lead_id);
                $chkLog->execute();
                $logRow = $chkLog->get_result()->fetch_assoc();
                $chkLog->close();

                if ($logRow) {
                    $updLog = $conn->prepare("UPDATE distribution_logs SET status = 'rejected', message = ? WHERE id = ?");
                    $updLog->bind_param("si", $logMsg, $logRow['id']);
                    $updLog->execute();
                    $updLog->close();
                } else {
                    logDistribution($conn, $lead_id, null, $lead['target_round_id'] ? $lead['target_round_id'] : null, 'rejected', $logMsg, false, $lead['created_at']);
                }

                logAdminAction($conn, $decodedUser['id'], 'REJECT_HELD_LEAD', [
                    'lead_id' => $lead_id,
                    'name' => $lead['name'],
                    'phone' => $lead['phone'],
                    'reason' => $reason
                ]);
                $conn->commit();
                triggerTwoWaySync($conn, $lead_id);
            }
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            break;
        }

        echo json_encode(['success' => true]);
        break;

    case 'blacklist_held_lead':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $lead_id = (int) ($input['lead_id'] ?? 0);
        $reason = trim($input['reason'] ?? '');

        if (!$lead_id) {
            echo json_encode(['success' => false, 'message' => 'ID data không hợp lệ']);
            break;
        }
        if (empty($reason)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập lý do đưa vào danh sách đen']);
            break;
        }

        $adminName = 'Quản trị viên';
        if (isset($decodedUser['id'])) {
            $admQuery = $conn->prepare("SELECT name FROM accounts WHERE id = ? LIMIT 1");
            $admQuery->bind_param("i", $decodedUser['id']);
            $admQuery->execute();
            $admRes = $admQuery->get_result()->fetch_assoc();
            if ($admRes && !empty($admRes['name'])) {
                $adminName = $admRes['name'];
            }
            $admQuery->close();
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("SELECT * FROM leads WHERE id = ? AND status = 'pending_approval' FOR UPDATE");
            $stmt->bind_param("i", $lead_id);
            $stmt->execute();
            $lead = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$lead) {
                throw new Exception("Lead không tồn tại hoặc đã được xử lý trước đó.");
            }

            $adminNote = "\n[Blacklist AI]: " . $reason . " | Admin: " . $adminName . " | Lúc: " . date('d/m/Y H:i:s');
            $note = $lead['note'] . $adminNote;

            $upd = $conn->prepare("UPDATE leads SET status = 'blacklisted', note = ?, ai_screener_status = 'failed' WHERE id = ?");
            $upd->bind_param("si", $note, $lead_id);
            $upd->execute();
            $upd->close();

            // Append to global_exclusion_contacts
            $blacklistContacts = get_system_setting($conn, 'global_exclusion_contacts');
            $contactsArray = !empty($blacklistContacts) ? array_map('trim', explode(',', $blacklistContacts)) : [];

            $added = false;
            if (!empty($lead['phone']) && !in_array($lead['phone'], $contactsArray)) {
                $contactsArray[] = $lead['phone'];
                $added = true;
            }
            if (!empty($lead['email']) && !in_array($lead['email'], $contactsArray)) {
                $contactsArray[] = $lead['email'];
                $added = true;
            }

            if ($added) {
                $newBlacklist = implode(', ', $contactsArray);
                $updSetting = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('global_exclusion_contacts', ?)");
                $updSetting->bind_param("s", $newBlacklist);
                $updSetting->execute();
                $updSetting->close();
            }

            $logMsg = "Chặn Blacklist bởi Admin: " . $reason;
            $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
            $chkLog->bind_param("i", $lead_id);
            $chkLog->execute();
            $logRow = $chkLog->get_result()->fetch_assoc();
            $chkLog->close();

            if ($logRow) {
                // Giữ nguyên ngày nhận lead ban đầu (không cập nhật received_at)
                $updLog = $conn->prepare("UPDATE distribution_logs SET status = 'blacklisted', message = ? WHERE id = ?");
                $updLog->bind_param("si", $logMsg, $logRow['id']);
                $updLog->execute();
                $updLog->close();
            } else {
                logDistribution($conn, $lead_id, null, $lead['target_round_id'] ? $lead['target_round_id'] : null, 'blacklisted', $logMsg, false, $lead['created_at']);
            }

            logAdminAction($conn, $decodedUser['id'], 'BLACKLIST_HELD_LEAD', [
                'lead_id' => $lead_id,
                'name' => $lead['name'],
                'phone' => $lead['phone'],
                'reason' => $reason
            ]);
            $conn->commit();
            triggerTwoWaySync($conn, $lead_id);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            break;
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
            $conn_id = (int) ($input['connection_id'] ?? 0);
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
            $dupStmt = $conn->prepare("SELECT id FROM field_mappings WHERE connection_id = ? AND sheet_column = ? AND system_field = ?");
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
            $conn_id = (int) $mappingRow['connection_id'];
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
            $dupStmt = $conn->prepare("SELECT id FROM field_mappings WHERE connection_id = ? AND sheet_column = ? AND system_field = ? AND id != ?");
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

        // Validate AI pre-screener configurations to prevent corrupt settings
        foreach ($input as $k => $v) {
            if ($k === 'ai_screener_enabled') {
                if ($v !== '0' && $v !== '1' && $v !== 0 && $v !== 1) {
                    echo json_encode(['success' => false, 'message' => 'Cấu hình trạng thái AI Pre-screener không hợp lệ (phải là 0 hoặc 1).']);
                    break 2;
                }
            }
            if ($k === 'fallback_round_id') {
                $val = (int) $v;
                if ($val > 0) {
                    $chk = $conn->prepare("SELECT is_active, round_name FROM distribution_rounds WHERE id = ?");
                    $chk->bind_param("i", $val);
                    $chk->execute();
                    $r = $chk->get_result()->fetch_assoc();
                    $chk->close();
                    if (!$r) {
                        echo json_encode(['success' => false, 'message' => "Không tìm thấy vòng phân bổ dự phòng (ID: $val)."]);
                        break 2;
                    }
                    if ((int) $r['is_active'] !== 1) {
                        echo json_encode(['success' => false, 'message' => "Vòng phân bổ dự phòng '{$r['round_name']}' đang ngưng hoạt động, không thể chọn làm fallback."]);
                        break 2;
                    }
                    $chkActive = $conn->prepare("
                        SELECT COUNT(*) as cnt 
                        FROM round_consultants rc 
                        JOIN consultants c ON rc.consultant_id = c.id 
                        WHERE rc.round_id = ? AND c.status = 'active'
                    ");
                    $chkActive->bind_param("i", $val);
                    $chkActive->execute();
                    $activeCount = (int) ($chkActive->get_result()->fetch_assoc()['cnt'] ?? 0);
                    $chkActive->close();
                    if ($activeCount === 0) {
                        echo json_encode(['success' => false, 'message' => "Vòng phân bổ dự phòng '{$r['round_name']}' phải có ít nhất một TVV đang hoạt động."]);
                        break 2;
                    }
                }
            }
            if ($k === 'ai_screener_below_standard_fallback_round_id') {
                $val = (int) $v;
                if ($val > 0) {
                    $chk = $conn->prepare("SELECT is_active, round_name FROM distribution_rounds WHERE id = ?");
                    $chk->bind_param("i", $val);
                    $chk->execute();
                    $r = $chk->get_result()->fetch_assoc();
                    $chk->close();
                    if (!$r) {
                        echo json_encode(['success' => false, 'message' => "Không tìm thấy vòng phân bổ dưới chuẩn (ID: $val)."]);
                        break 2;
                    }
                    if ((int) $r['is_active'] !== 1) {
                        echo json_encode(['success' => false, 'message' => "Vòng phân bổ dưới chuẩn '{$r['round_name']}' đang ngưng hoạt động, không thể chọn làm fallback."]);
                        break 2;
                    }
                    $chkActive = $conn->prepare("
                        SELECT COUNT(*) as cnt 
                        FROM round_consultants rc 
                        JOIN consultants c ON rc.consultant_id = c.id 
                        WHERE rc.round_id = ? AND c.status = 'active'
                    ");
                    $chkActive->bind_param("i", $val);
                    $chkActive->execute();
                    $activeCount = (int) ($chkActive->get_result()->fetch_assoc()['cnt'] ?? 0);
                    $chkActive->close();
                    if ($activeCount === 0) {
                        echo json_encode(['success' => false, 'message' => "Vòng phân bổ dưới chuẩn '{$r['round_name']}' phải có ít nhất một TVV đang hoạt động."]);
                        break 2;
                    }
                }
            }
            if ($k === 'ai_screener_configs') {
                $configs = is_array($v) ? $v : json_decode($v, true);
                if (!is_array($configs)) {
                    echo json_encode(['success' => false, 'message' => 'Cấu hình nhóm lọc AI (ai_screener_configs) không đúng định dạng JSON.']);
                    break 2;
                }
                foreach ($configs as $idx => $cfg) {
                    $cfgName = $cfg['name'] ?? ('Nhóm thứ ' . ($idx + 1));
                    if (!isset($cfg['rounds']) || !is_array($cfg['rounds'])) {
                        echo json_encode(['success' => false, 'message' => "Cấu hình '$cfgName' thiếu danh sách vòng phân bổ áp dụng."]);
                        break 3;
                    }
                    $mode = $cfg['mode'] ?? 'ai';
                    if (!in_array($mode, ['ai', 'manual', 'hybrid'])) {
                        echo json_encode(['success' => false, 'message' => "Chế độ lọc '$mode' của nhóm '$cfgName' không hợp lệ."]);
                        break 3;
                    }
                    $manual_action = $cfg['manual_action'] ?? 'hold';
                    if (!in_array($manual_action, ['hold', 'pass'])) {
                        echo json_encode(['success' => false, 'message' => "Hành động lọc thủ công '$manual_action' của nhóm '$cfgName' không hợp lệ."]);
                        break 3;
                    }
                    if (isset($cfg['manual_rules']) && !is_array($cfg['manual_rules'])) {
                        echo json_encode(['success' => false, 'message' => "Bộ lọc thủ công của nhóm '$cfgName' phải là danh sách quy tắc (array)."]);
                        break 3;
                    }

                    // Validate fallback settings logic
                    $fb_enabled = !empty($cfg['below_standard_fallback_enabled']) ? 1 : 0;
                    if ($fb_enabled) {
                        $fb_round = (int) ($cfg['below_standard_fallback_round_id'] ?? 0);
                        if ($fb_round <= 0) {
                            echo json_encode(['success' => false, 'message' => "Nhóm '$cfgName' đã bật phân bổ dưới chuẩn nhưng chưa chọn vòng phân bổ fallback hợp lệ."]);
                            break 3;
                        }
                        // Fallback round cannot be in the list of applied rounds for this configuration
                        $appliedRounds = array_map('intval', $cfg['rounds']);
                        if (in_array($fb_round, $appliedRounds)) {
                            echo json_encode(['success' => false, 'message' => "Vòng fallback (ID: $fb_round) không được trùng với các vòng áp dụng của nhóm '$cfgName'."]);
                            break 3;
                        }

                        // Validate active round & active consultants
                        $chk = $conn->prepare("SELECT is_active, round_name FROM distribution_rounds WHERE id = ?");
                        $chk->bind_param("i", $fb_round);
                        $chk->execute();
                        $r = $chk->get_result()->fetch_assoc();
                        $chk->close();
                        if (!$r) {
                            echo json_encode(['success' => false, 'message' => "Không tìm thấy vòng phân bổ fallback (ID: $fb_round) cho nhóm '$cfgName'."]);
                            break 3;
                        }
                        if ((int) $r['is_active'] !== 1) {
                            echo json_encode(['success' => false, 'message' => "Vòng phân bổ fallback '{$r['round_name']}' của nhóm '$cfgName' đang ngưng hoạt động, không thể chọn làm fallback."]);
                            break 3;
                        }
                        $chkActive = $conn->prepare("
                            SELECT COUNT(*) as cnt 
                            FROM round_consultants rc 
                            JOIN consultants c ON rc.consultant_id = c.id 
                            WHERE rc.round_id = ? AND c.status = 'active'
                        ");
                        $chkActive->bind_param("i", $fb_round);
                        $chkActive->execute();
                        $activeCount = (int) ($chkActive->get_result()->fetch_assoc()['cnt'] ?? 0);
                        $chkActive->close();
                        if ($activeCount === 0) {
                            echo json_encode(['success' => false, 'message' => "Vòng phân bổ fallback '{$r['round_name']}' của nhóm '$cfgName' phải có ít nhất một TVV đang hoạt động."]);
                            break 3;
                        }
                    }
                }
            }
            if ($k === 'ai_screener_mode') {
                if (!in_array($v, ['ai', 'manual', 'hybrid'])) {
                    echo json_encode(['success' => false, 'message' => 'Chế độ ai_screener_mode không hợp lệ.']);
                    break 2;
                }
            }
            if ($k === 'ai_screener_manual_action') {
                if (!in_array($v, ['hold', 'pass'])) {
                    echo json_encode(['success' => false, 'message' => 'Hành động lọc thủ công không hợp lệ.']);
                    break 2;
                }
            }
            if ($k === 'ai_screener_manual_rules') {
                $rules = is_array($v) ? $v : json_decode($v, true);
                if ($v !== null && $v !== '' && !is_array($rules)) {
                    echo json_encode(['success' => false, 'message' => 'Cấu hình quy tắc lọc thủ công không hợp lệ.']);
                    break 2;
                }
            }
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

    case 'test_master_sync':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $url = $input['google_script_url'] ?? '';
            $sheetName = $input['sheet_name'] ?? '';

            if (empty($url)) {
                echo json_encode(['success' => false, 'message' => 'Thiếu URL Web App Apps Script']);
                break;
            }

            // Tạo payload thử nghiệm
            $payload = [
                'sheet_name' => $sheetName,
                'search_col_phone' => 'Số điện thoại',
                'search_val_phone' => '0999999999',
                'search_col_email' => 'Email',
                'search_val_email' => 'test@richland.net',
                'allow_insert' => true,
                'updates' => [
                    'Thời gian' => date('Y-m-d H:i:s'),
                    'Nguồn' => 'TEST CONNECTION',
                    'Vòng' => 'Vòng chia Test',
                    'Sale phụ trách' => 'Sale Test',
                    'Họ tên' => 'Khách hàng Thử nghiệm',
                    'Số điện thoại' => '0999999999',
                    'Email' => 'test@richland.net',
                    'Ghi chú' => 'Đồng bộ thử nghiệm thành công! Kết nối hoạt động tốt.',
                    'Trạng thái' => 'Kiểm thử'
                ]
            ];

            $jsonData = json_encode($payload, JSON_UNESCAPED_UNICODE);

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Content-Length: ' . strlen($jsonData)
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 6); // Timeout 6s tối đa cho kiểm thử
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 RICH LAND CRM Client");
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($httpCode !== 200) {
                $errDetail = !empty($curlError) ? " (Lỗi: $curlError)" : " (Mã phản hồi HTTP: $httpCode)";
                echo json_encode(['success' => false, 'message' => 'Không thể kết nối đến Web App Apps Script' . $errDetail]);
                break;
            }

            $resObj = json_decode($response, true);
            if (!$resObj) {
                echo json_encode(['success' => false, 'message' => 'Apps Script trả về định dạng phản hồi không hợp lệ: ' . substr($response, 0, 100)]);
                break;
            }

            if (($resObj['status'] ?? '') === 'error') {
                echo json_encode(['success' => false, 'message' => 'Apps Script trả về lỗi: ' . ($resObj['message'] ?? 'Không rõ lý do')]);
                break;
            }

            echo json_encode(['success' => true, 'data' => $resObj]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'ai_chat':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $message = trim($input['message'] ?? '');
            $history = $input['history'] ?? [];

            if (empty($message)) {
                echo json_encode(['success' => false, 'message' => 'Tin nhắn không được để trống']);
                break;
            }

            $apiKey = get_system_setting($conn, 'gemini_api_key');
            $model = get_system_setting($conn, 'gemini_model');
            if (empty($model)) {
                $model = 'gemini-2.5-flash';
            }

            if (empty($apiKey)) {
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'reply' => "⚠️ **Chưa cấu hình Gemini API Key!**\n\nVui lòng truy cập trang **Cài đặt -> Cấu hình Trợ lý AI** để nhập khóa API Key của Google Gemini trước khi trò chuyện với trợ lý trí tuệ nhân tạo."
                    ]
                ]);
                break;
            }

            // Safe SQL parser and execution wrapper
            $executeSafeSql = function ($conn, $sql) {
                $sql = trim($sql);
                if (empty($sql)) {
                    return ['error' => 'Query is empty'];
                }

                // Clean SQL comments to prevent comment-based filter bypasses
                $cleanSql = preg_replace('/(\/\*([\s\S]*?)\*\/)|(--.*)/', '', $sql);
                $cleanSql = trim($cleanSql);

                // Enforce SELECT check
                if (!preg_match('/^select\b/i', $cleanSql)) {
                    return ['error' => 'Chỉ cho phép thực hiện truy vấn đọc dữ liệu (SELECT)'];
                }

                // Block alteration keywords
                $blockedKeywords = [
                    'insert',
                    'update',
                    'delete',
                    'drop',
                    'alter',
                    'truncate',
                    'replace',
                    'create',
                    'grant',
                    'revoke',
                    'rename',
                    'call',
                    'exec',
                    'execute',
                    'union select',
                    'into outfile',
                    'into dumpfile',
                    'load_file'
                ];
                foreach ($blockedKeywords as $kw) {
                    if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $cleanSql)) {
                        return ['error' => "Không cho phép sử dụng từ khóa '$kw' để bảo mật hệ thống"];
                    }
                }

                // Block query targeting sensitive columns
                if (preg_match('/\bpassword_hash\b/i', $cleanSql) || preg_match('/\bconfirm_token\b/i', $cleanSql)) {
                    return ['error' => 'Không được phép truy vấn thông tin mật khẩu hoặc mã xác nhận bảo mật'];
                }

                // Block settings query targeting sensitive keys
                if (preg_match('/\bsystem_settings\b/i', $cleanSql) && preg_match('/(api_key|password|secret|token|key)/i', $cleanSql)) {
                    return ['error' => 'Không được phép truy vấn các khóa bảo mật (API keys, passwords, secrets) trong cài đặt hệ thống'];
                }

                // Strip trailing semicolon from clean SQL
                $cleanSql = rtrim($cleanSql, ';');
                $cleanSql = trim($cleanSql);

                // Restrict limit to max 100 rows
                if (preg_match('/limit\s+(\d+)(?:\s*,\s*(\d+))?/i', $cleanSql, $matches)) {
                    $limitVal = isset($matches[2]) ? (int) $matches[2] : (int) $matches[1];
                    if ($limitVal > 100) {
                        $cleanSql = preg_replace('/limit\s+(\d+)(?:\s*,\s*(\d+))?/i', 'LIMIT 100', $cleanSql);
                    }
                } else {
                    $cleanSql .= " LIMIT 100";
                }

                $result = $conn->query($cleanSql);
                if (!$result) {
                    return ['error' => 'Lỗi thực thi SQL: ' . $conn->error];
                }

                $rows = [];
                while ($row = $result->fetch_assoc()) {
                    // Redact sensitive keys in any returned row
                    foreach ($row as $key => $val) {
                        $lowerKey = strtolower($key);
                        if (
                            strpos($lowerKey, 'password') !== false ||
                            strpos($lowerKey, 'token') !== false ||
                            strpos($lowerKey, 'api_key') !== false ||
                            strpos($lowerKey, 'secret') !== false ||
                            strpos($lowerKey, 'key') !== false ||
                            strpos($lowerKey, 'hash') !== false
                        ) {
                            $row[$key] = '[REDACTED]';
                        }
                    }
                    $rows[] = $row;
                }

                return [
                    'success' => true,
                    'rows' => $rows,
                    'count' => count($rows)
                ];
            };

            // Enhanced system instruction detailing database schemas
            $systemInstruction = "Bạn là Trợ lý AI Rich Land, một chatbot hỗ trợ đắc lực tích hợp sẵn trong hệ thống quản trị phân chia lead dữ liệu Rich Land.\n" .
                "Hãy trả lời người dùng một cách thân thiện, chuyên nghiệp, bằng tiếng Việt. Sử dụng markdown (in đậm, danh sách, bảng biểu) để câu trả lời rõ ràng.\n\n" .
                "QUY TẮC PHẢN HỒI (BẮT BUỘC): BẠN KHÔNG ĐƯỢC CHÀO HỎI LAN MAN HOẶC HỎI LẠI NGƯỜI DÙNG TRƯỚC KHI TRUY VẤN. BẤT KỲ CÂU HỎI NÀO CÓ THỂ CẦN TRA CỨU DỮ LIỆU, BẠN PHẢI GỌI CÔNG CỤ `execute_readonly_query` NGAY LẬP TỨC TRONG LƯỢT ĐẦU TIÊN ĐỂ TRA CỨU. NẾU BẠN KHÔNG GỌI CÔNG CỤ MÀ TRẢ LỜI NGAY HOẶC HỎI LẠI, ĐÓ LÀ LỖI VẬN HÀNH NGHIÊM TRỌNG.\n\n" .
                "QUY TẮC HIỂU NGÔN NGỮ VIẾT TẮT TIẾNG VIỆT:\n" .
                "- Người dùng thường dùng viết tắt: 'v' hoặc 'vậy' (KHÔNG phải là tên người 'V'), 'ko' hoặc 'k' (không), 'tvv' hoặc 'sale' (tư vấn viên), 'nv' (nhân viên), 'đc' (được), 'tks' (cảm ơn), 'ns' (nhận số/chia số).\n" .
                "- Nếu người dùng hỏi 'tại sao Uyên nhiều data hơn v', chữ 'v' ở đây nghĩa là 'vậy' chứ không phải là một người tên V. Hãy tự hiểu là so sánh Uyên với những tư vấn viên khác hoặc so với mặt bằng chung của cả đội nhận data.\n\n" .
                "BẠN CÓ QUYỀN TRUY VẤN DỮ LIỆU THỜI GIAN THỰC qua công cụ `execute_readonly_query`. Hãy sử dụng công cụ này khi người dùng hỏi các câu hỏi cần thông tin từ cơ sở dữ liệu (ví dụ: thống kê hôm nay, số liệu của sale, trạng thái ticket đền bù, lịch sử đồng bộ Google Sheets, hoặc lịch sử hoạt động hệ thống).\n\n" .
                "SƠ ĐỒ CƠ SỞ DỮ LIỆU HỆ THỐNG:\n" .
                "1. accounts: Thông tin tài khoản quản trị (id, username, role ['admin', 'assistant', 'viewer'], name, email, zalo_chat_id, is_confirmed, last_login, avatar) - Password hash và token are omitted/redacted.\n" .
                "2. consultants: Thông tin tư vấn viên / sales nhận số (id, name, email, status ['active', 'inactive', 'leave'], leave_start, leave_end, zalo_chat_id, vacation_mode, created_at)\n" .
                "3. distribution_rounds: Các vòng xoay chia số (id, round_name, description, cc_emails, last_assigned_consultant_id, is_active)\n" .
                "4. round_consultants: Danh sách sale nằm trong vòng xoay (round_id, consultant_id, is_active, receive_ratio, skip_count, compensation_count, data_per_turn, current_turn_remaining)\n" .
                "5. leads: Dữ liệu khách hàng được tiếp nhận (id, phone, email, name, source, type, note, last_interaction_date, assigned_to (FK consultants.id), connection_id (FK sheet_connections.id), created_at)\n" .
                "6. distribution_logs: Nhật ký kết quả định tuyến/chia lead cho sale (id, lead_id, assigned_to (FK consultants.id), round_id, status (ví dụ: 'assigned' (đã chia), 'compensation' (chia đền bù), 'rule_6_month', 'duplicate', 'pending_work_hours', 'blacklisted', 'error', 'no_consultant'), message, received_at)\n" .
                "7. data_reports: Danh sách ticket báo lỗi đền bù của sale (id, lead_id, consultant_id, round_id, reason, status ['pending', 'approved', 'rejected'], created_at, resolved_at, reject_reason, approval_reason)\n" .
                "8. routing_rules: Các quy tắc phân phối định tuyến (id, connection_id, target_round_id, condition_column, condition_operator, condition_value, priority, conditions_json, logical_operator)\n" .
                "9. sheet_connections: Kết nối các nguồn Google Sheets (id, sheet_name, spreadsheet_id, connection_type, is_active, sync_interval, last_sync_at, sync_status, email_template, require_both_contact, sync_mode, is_initialized, is_silent, created_at)\n" .
                "10. admin_logs: Nhật ký hoạt động quản trị của các tài khoản admin (id, account_id, action, details (JSON), ip_address, created_at)\n" .
                "QUY TẮC CẤM HỎI NGƯỢC LẠI NGƯỜI DÙNG (CỰC KỲ QUAN TRỌNG):\n" .
                "- TUYỆT ĐỐI NGHIÊM CẤM hỏi lại người dùng để làm rõ khoảng thời gian, yêu cầu chọn mốc thời gian ('hôm nay', 'tuần này', 'tháng này') hay yêu cầu ID/thông tin thêm. Bạn phải CHỦ ĐỘNG suy đoán và chạy truy vấn SQL ngay lập tức.\n" .
                "- Khi người dùng hỏi bất kỳ câu hỏi nào liên quan đến số liệu hoặc so sánh data (ví dụ: 'Tại sao Phúc ít số', 'Sao Uyên nhiều data', 'data của Đan hôm nay thế nào'), bạn PHẢI tự động truy vấn dữ liệu hôm nay (`received_at >= CURDATE()`) làm mặc định. Nếu không có dữ liệu hôm nay, hãy tự động truy vấn 7 ngày gần nhất, hoặc toàn bộ lịch sử, và trả lời ngay kết quả phân tích mà không được xin phép hay hỏi ý kiến người dùng.\n\n" .
                "QUY TẮC TRA CỨU TƯ VẤN VIÊN (SALE / TVV):\n" .
                "- Hãy CHỦ ĐỘNG dùng SQL tìm kiếm tư vấn viên trong bảng `consultants` bằng tên riêng (ví dụ: `name LIKE '%Phúc%'` hoặc `name LIKE '%Uyên%'`). Sau khi tìm được ID tư vấn viên, tiếp tục dùng ID đó để truy vấn.\n\n" .
                "QUY TẮC PHÂN TÍCH KHI HỎI VỀ SỐ LƯỢNG DATA CỦA TƯ VẤN VIÊN (Ví dụ: \"Tại sao Phúc chỉ có 15 data?\"):\n" .
                "- Khi người dùng thắc mắc về số lượng hoặc lý do phân phối của một tư vấn viên, bạn PHẢI gọi công cụ `execute_readonly_query` ngay lập tức để kiểm tra 3 điểm sau:\n" .
                "  1. Trạng thái trong bảng `consultants`: Xem cột `status` (có phải 'leave' hoặc 'inactive' không) và cột `vacation_mode` (có phải 1 không).\n" .
                "  2. Cấu hình trong các vòng xoay ở bảng `round_consultants`: Kiểm tra xem có bị tắt hoạt động (`is_active = 0`) không, và tỷ lệ nhận số `receive_ratio` là bao nhiêu so với các sale khác trong cùng vòng xoay đó.\n" .
                "  3. Nhật ký phân phối trong `distribution_logs`: Đếm số lượng data thực tế đã phân phối thành công (`status IN ('assigned', 'compensation')`) và số lượt bị bỏ qua hoặc gặp lỗi của tư vấn viên này.\n" .
                "- Tổng hợp câu trả lời cụ thể, đi thẳng vào vấn đề dựa trên kết quả SQL thu được (ví dụ: giải thích cụ thể rằng tỉ lệ nhận của Phúc là 1 còn Uyên là 2, hoặc Phúc đang bật tạm ngưng nhận số). Trả lời ngắn gọn, súc tích, tránh lan man hay liệt kê lý do lý thuyết nếu chưa đối chiếu dữ liệu thực tế.\n\n" .
                "QUY TẮC KHÔNG ĐƯỢC ĐẾM HOẶC THỐNG KÊ DATA SILENT (ĐỒNG BỘ ẨN):\n" .
                "- TUYỆT ĐỐI KHÔNG ĐƯỢC đếm, hiển thị hoặc thống kê các data có trạng thái 'silent' (đồng bộ ẩn/chỉ check trùng) trong bất kỳ số liệu hay báo cáo nào của tư vấn viên. Trạng thái 'silent' KHÔNG phải là data thực tế được chia.\n" .
                "- Khi tính lượng data nhận được của một tư vấn viên, bạn KHÔNG ĐƯỢC đếm trực tiếp từ bảng `leads` (vì bảng `leads` chứa cả các data đồng bộ ẩn từ Google Sheets có `is_silent = 1` của sheet_connections). Bạn BẮT BUỘC phải đếm từ bảng `distribution_logs` với điều kiện `status IN ('assigned', 'compensation')`. Tuyệt đối không tính các log có trạng thái `status = 'silent'` hoặc các lead thuộc kết nối có `is_silent = 1`.\n\n" .
                "LƯU Ý KHI VIẾT TRUY VẤN SQL:\n" .
                "- Luôn viết truy vấn SELECT hợp lệ cho MariaDB.\n" .
                "- Chỉ đếm các dòng trong bảng `distribution_logs` có trạng thái thành công (`status IN ('assigned', 'compensation')`) để tính lượng data thực tế được nhận.\n" .
                "- Sử dụng các phép JOIN để kết nối các bảng lấy tên của Sale thay vì chỉ hiển thị ID.\n" .
                "- Tránh trả về dữ liệu quá dài. Hãy sử dụng COUNT, SUM, GROUP BY, ORDER BY, LIMIT để thu gọn dữ liệu trước khi trả về.\n" .
                "- Luôn xử lý khoảng thời gian dựa trên các hàm ngày tháng của SQL (ví dụ: `received_at >= CURDATE()` hoặc `received_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`).\n" .
                "- Giải thích câu trả lời của bạn một cách rõ ràng dựa trên kết quả thu thập được.";

            // Format history for Gemini API
            $contents = [];
            foreach ($history as $h) {
                $contents[] = [
                    'role' => $h['role'] === 'user' ? 'user' : 'model',
                    'parts' => [['text' => $h['text']]]
                ];
            }
            $contents[] = [
                'role' => 'user',
                'parts' => [['text' => $message]]
            ];

            // Define tools schema
            $tools = [
                [
                    'functionDeclarations' => [
                        [
                            'name' => 'execute_readonly_query',
                            'description' => 'Thực thi một câu lệnh SQL SELECT an toàn trên hệ thống cơ sở dữ liệu để tra cứu thông tin thực tế về leads, tư vấn viên (consultants), cấu hình chia số (rounds), vé lỗi (tickets), nhật ký định tuyến (distribution_logs), hoặc nhật ký quản trị (admin_logs).',
                            'parameters' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'query' => [
                                        'type' => 'STRING',
                                        'description' => 'Câu lệnh SQL SELECT cần thực thi.'
                                    ]
                                ],
                                'required' => ['query']
                            ]
                        ]
                    ]
                ]
            ];

            $maxTurns = 3;
            $currentTurn = 0;
            $replyText = '';

            while ($currentTurn < $maxTurns) {
                $payload = [
                    'contents' => $contents,
                    'systemInstruction' => [
                        'parts' => [['text' => $systemInstruction]]
                    ],
                    'tools' => $tools
                ];

                $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model . ":generateContent?key=" . $apiKey;

                $httpOpts = [
                    'http' => [
                        'header' => "Content-Type: application/json\r\n",
                        'method' => 'POST',
                        'content' => json_encode($payload),
                        'timeout' => 20,
                        'ignore_errors' => true
                    ],
                    'ssl' => [
                        'verify_peer' => true,
                        'verify_peer_name' => true
                    ]
                ];
                $contextStream = stream_context_create($httpOpts);
                $response = @file_get_contents($url, false, $contextStream);

                $httpCode = 500;
                if (isset($http_response_header) && is_array($http_response_header) && count($http_response_header) > 0) {
                    if (preg_match('/HTTP\/\d\.\d\s+(\d+)/i', $http_response_header[0], $matches)) {
                        $httpCode = (int) $matches[1];
                    }
                }

                if ($response === false || $httpCode !== 200) {
                    $errMessage = "Lỗi kết nối Gemini API (HTTP " . $httpCode . ")";
                    if ($response !== false) {
                        $errJson = json_decode($response, true);
                        if (isset($errJson['error']['message'])) {
                            $errMessage = "Lỗi Gemini: " . $errJson['error']['message'];
                        }
                    }

                    echo json_encode([
                        'success' => true,
                        'data' => [
                            'reply' => "⚠️ **Hệ thống gặp lỗi khi liên kết với Gemini API!**\n\nChi tiết: `" . $errMessage . "`"
                        ]
                    ]);
                    exit;
                }

                $resJson = json_decode($response, true);
                $candidate = $resJson['candidates'][0] ?? null;
                if (!$candidate) {
                    $replyText = "Không nhận được phản hồi từ AI.";
                    break;
                }

                $parts = $candidate['content']['parts'] ?? [];
                $hasFunctionCall = false;
                $functionCallObj = null;

                foreach ($parts as $part) {
                    if (isset($part['functionCall'])) {
                        $hasFunctionCall = true;
                        $functionCallObj = $part['functionCall'];
                        break;
                    }
                }

                // Append model's response to contents
                $contents[] = $candidate['content'];

                if ($hasFunctionCall && $functionCallObj) {
                    $funcName = $functionCallObj['name'];
                    $funcArgs = $functionCallObj['args'] ?? [];

                    if ($funcName === 'execute_readonly_query') {
                        $sqlQuery = $funcArgs['query'] ?? '';
                        $queryResult = $executeSafeSql($conn, $sqlQuery);

                        $functionResponsePart = [
                            'functionResponse' => [
                                'name' => $funcName,
                                'response' => [
                                    'result' => $queryResult
                                ]
                            ]
                        ];

                        if (isset($functionCallObj['id'])) {
                            $functionResponsePart['functionResponse']['id'] = $functionCallObj['id'];
                        }

                        $contents[] = [
                            'role' => 'function',
                            'parts' => [$functionResponsePart]
                        ];
                    } else {
                        $contents[] = [
                            'role' => 'function',
                            'parts' => [
                                [
                                    'functionResponse' => [
                                        'name' => $funcName,
                                        'response' => ['error' => 'Hàm không tồn tại']
                                    ]
                                ]
                            ]
                        ];
                    }

                    $currentTurn++;
                } else {
                    $replyText = $candidate['content']['parts'][0]['text'] ?? '';
                    break;
                }
            }

            if (empty($replyText)) {
                $replyText = "Tôi không nhận được câu trả lời từ AI hoặc quá trình xử lý quá hạn. Vui lòng thử lại.";
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'reply' => $replyText
                ]
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                'success' => true,
                'data' => [
                    'reply' => "⚠️ **Hệ thống gặp sự cố khi xử lý dữ liệu AI!**\n\nChi tiết lỗi: `" . $e->getMessage() . "`\n\nVui lòng báo lại quản trị viên hệ thống để kiểm tra."
                ]
            ]);
        }
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
                    <p style="color: #ef4444; font-weight: 700; font-size: 15px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Báo cáo Data</p>
                    <p style="color: #64748b; font-size: 14px; margin: 0 0 12px;">Nếu Data này bị sai SĐT, Spam hoặc trùng lặp, vui lòng nhấn nút bên dưới để báo cáo và nhận Data bù.</p>
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
            sendAdminConfirmationEmail($email, "Admin Test", "https://open.richland.net/confirm?token=123456");
            $success = true;
        } else if ($type === 'daily_report') {
            $statsHtml = "<li>Sale Test 1: <b>15</b> data</li><li>Sale Test 2: <b>12</b> data</li>";
            sendDailyReportEmailToAdmins($email, "Admin Test", 27, $statsHtml, 3);
            $success = true;
        } else {
            $subject = "Test Cấu hình Email từ RICH LAND";
            $body = "<p>Nếu bạn nhận được email này, nghĩa là cấu hình gửi mail của bạn (Amazon SES hoặc AppScript) đang hoạt động hoàn hảo!</p><p style='color:#64748b;font-size:14px;'>Gửi lúc: " . date('d/m/Y H:i:s') . "</p>";
            $success = sendEmailNotification($email, $subject, "Kết nối thành công ✅", $body, '', true);
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
        if ($decodedUser['role'] === 'sale' || $decodedUser['role'] === 'sales') {
            $stmt = $conn->prepare("SELECT id, username, name, email, role, created_at, zalo_chat_id, is_confirmed, last_login, avatar FROM accounts WHERE id = ?");
            $stmt->bind_param("i", $decodedUser['id']);
            $stmt->execute();
            $res = $stmt->get_result();
        } else {
            $res = $conn->query("SELECT id, username, name, email, role, created_at, zalo_chat_id, is_confirmed, last_login, avatar FROM accounts ORDER BY created_at DESC");
        }
        $data = [];
        while ($row = $res->fetch_assoc())
            $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'rollback_admin_action':
        if ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'superadmin') {
            echo json_encode(['success' => false, 'message' => 'Bạn không có quyền thực hiện hành động này.']);
            break;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $logId = (int) ($input['log_id'] ?? 0);

            if (!$logId) {
                throw new Exception('ID log không hợp lệ');
            }

            // Fetch the log
            $stmt = $conn->prepare("SELECT * FROM admin_logs WHERE id = ?");
            $stmt->bind_param("i", $logId);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res->num_rows === 0) {
                $stmt->close();
                throw new Exception('Không tìm thấy bản ghi nhật ký hoạt động.');
            }
            $log = $res->fetch_assoc();
            $stmt->close();

            if ((int)$log['is_rolled_back'] === 1) {
                throw new Exception('Hành động này đã được hoàn tác trước đó.');
            }

            $action = $log['action'];
            $details = json_decode($log['details'], true) ?: [];

            $conn->begin_transaction();

            switch ($action) {
                case 'REASSIGN_LEAD':
                    $leadId = (int) ($details['lead_id'] ?? 0);
                    $oldConsultantId = (int) ($details['old_consultant_id'] ?? 0);
                    $newConsultantId = (int) ($details['new_consultant_id'] ?? 0);
                    $compensated = !empty($details['compensated']);

                    if (!$leadId || !$oldConsultantId) {
                        throw new Exception('Dữ liệu nhật ký không đầy đủ để hoàn tác.');
                    }

                    // 1. Reassign the lead's assigned_to back
                    $updLead = $conn->prepare("UPDATE leads SET assigned_to = ?, status = 'assigned' WHERE id = ?");
                    $updLead->bind_param("ii", $oldConsultantId, $leadId);
                    $updLead->execute();
                    $updLead->close();

                    // 2. Revert distribution_logs entries
                    // Delete the reassignment log entry
                    $delDistLog = $conn->prepare("DELETE FROM distribution_logs WHERE lead_id = ? AND assigned_to = ? AND status = 'reassigned' ORDER BY id DESC LIMIT 1");
                    $delDistLog->bind_param("ii", $leadId, $newConsultantId);
                    $delDistLog->execute();
                    $delDistLog->close();

                    // Update the original entry back to 'assigned'
                    $updOriginalDist = $conn->prepare("UPDATE distribution_logs SET status = 'assigned' WHERE lead_id = ? AND assigned_to = ? ORDER BY id DESC LIMIT 1");
                    $updOriginalDist->bind_param("ii", $leadId, $oldConsultantId);
                    $updOriginalDist->execute();
                    $updOriginalDist->close();

                    // 3. Revert compensation if it was given
                    if ($compensated) {
                        $roundId = isset($details['round_id']) ? (int)$details['round_id'] : 0;
                        if (!$roundId) {
                            $rRes = $conn->query("SELECT round_id FROM distribution_logs WHERE lead_id = " . $leadId . " ORDER BY id DESC LIMIT 1");
                            if ($rRes && $rRes->num_rows > 0) {
                                $roundId = (int) $rRes->fetch_assoc()['round_id'];
                            }
                        }

                        if ($roundId) {
                            $updRC = $conn->prepare("UPDATE round_consultants SET compensation_count = GREATEST(0, compensation_count - 1) WHERE round_id = ? AND consultant_id = ?");
                            $updRC->bind_param("ii", $roundId, $oldConsultantId);
                            $updRC->execute();
                            $updRC->close();

                            $reasonLike = "%chuyển giao Lead%sang cho TVV%";
                            $delComp = $conn->prepare("DELETE FROM active_compensation_logs WHERE round_id = ? AND consultant_id = ? AND reason LIKE ? ORDER BY id DESC LIMIT 1");
                            $delComp->bind_param("iis", $roundId, $oldConsultantId, $reasonLike);
                            $delComp->execute();
                            $delComp->close();
                        }
                    }
                    break;

                case 'TOGGLE_CONSULTANT_VACATION':
                    $consId = (int) ($details['id'] ?? 0);
                    $loggedVacationMode = (int) ($details['vacation_mode'] ?? 0);

                    if (!$consId) {
                        throw new Exception('ID tư vấn viên không hợp lệ trong log.');
                    }

                    $oldVacationMode = $loggedVacationMode ? 0 : 1;
                    $updVac = $conn->prepare("UPDATE consultants SET vacation_mode = ? WHERE id = ?");
                    $updVac->bind_param("ii", $oldVacationMode, $consId);
                    $updVac->execute();
                    $updVac->close();
                    break;

                case 'EDIT_CONSULTANT':
                    $consId = (int) ($details['id'] ?? 0);
                    $oldData = $details['old'] ?? null;

                    if (!$consId || !$oldData) {
                        throw new Exception('Không tìm thấy dữ liệu cũ để hoàn tác.');
                    }

                    $updCons = $conn->prepare("UPDATE consultants SET name=?, email=?, status=?, leave_start=?, leave_end=?, zalo_chat_id=?, work_start_time=?, work_end_time=?, work_schedule=?, avatar=? WHERE id=?");
                    $updCons->bind_param(
                        "ssssssssssi",
                        $oldData['name'],
                        $oldData['email'],
                        $oldData['status'],
                        $oldData['leave_start'],
                        $oldData['leave_end'],
                        $oldData['zalo_chat_id'],
                        $oldData['work_start_time'],
                        $oldData['work_end_time'],
                        $oldData['work_schedule'],
                        $oldData['avatar'],
                        $consId
                    );
                    $updCons->execute();
                    $updCons->close();
                    break;

                case 'APPROVE_REPORT':
                    $leadId = (int) ($details['lead_id'] ?? 0);
                    $consId = (int) ($details['consultant_id'] ?? 0);
                    $roundId = (int) ($details['round_id'] ?? 0);

                    if (!$leadId) {
                        throw new Exception('ID lead không hợp lệ trong log.');
                    }

                    $updReport = $conn->prepare("UPDATE data_reports SET status = 'pending', resolved_at = NULL, resolved_by = NULL, approval_reason = NULL WHERE lead_id = ?");
                    $updReport->bind_param("i", $leadId);
                    $updReport->execute();
                    $updReport->close();

                    $updLead = $conn->prepare("UPDATE leads SET status = 'error' WHERE id = ?");
                    $updLead->bind_param("i", $leadId);
                    $updLead->execute();
                    $updLead->close();

                    if ($roundId && $consId) {
                        $updRC = $conn->prepare("UPDATE round_consultants SET compensation_count = GREATEST(0, compensation_count - 1) WHERE round_id = ? AND consultant_id = ?");
                        $updRC->bind_param("ii", $roundId, $consId);
                        $updRC->execute();
                        $updRC->close();
                    }
                    break;

                case 'APPROVE_REPORT_NO_COMP':
                    $leadId = (int) ($details['lead_id'] ?? 0);

                    if (!$leadId) {
                        throw new Exception('ID lead không hợp lệ trong log.');
                    }

                    $updReport = $conn->prepare("UPDATE data_reports SET status = 'pending', resolved_at = NULL, resolved_by = NULL, approval_reason = NULL WHERE lead_id = ?");
                    $updReport->bind_param("i", $leadId);
                    $updReport->execute();
                    $updReport->close();

                    $updLead = $conn->prepare("UPDATE leads SET status = 'error' WHERE id = ?");
                    $updLead->bind_param("i", $leadId);
                    $updLead->execute();
                    $updLead->close();
                    break;

                case 'COMPENSATE_APPROVED_NO_COMP':
                    $leadId = (int) ($details['lead_id'] ?? 0);
                    $consId = (int) ($details['consultant_id'] ?? 0);
                    $roundId = (int) ($details['round_id'] ?? 0);

                    if (!$leadId) {
                        throw new Exception('ID lead không hợp lệ trong log.');
                    }

                    $updReport = $conn->prepare("UPDATE data_reports SET status = 'approved_no_comp' WHERE lead_id = ?");
                    $updReport->bind_param("i", $leadId);
                    $updReport->execute();
                    $updReport->close();

                    if ($consId && $roundId) {
                        $updLog = $conn->prepare("UPDATE distribution_logs SET status = 'assigned' WHERE lead_id = ? AND assigned_to = ? AND round_id = ? AND status = 'error'");
                        $updLog->bind_param("iii", $leadId, $consId, $roundId);
                        $updLog->execute();
                        $updLog->close();

                        $updRC = $conn->prepare("UPDATE round_consultants SET compensation_count = GREATEST(0, compensation_count - 1) WHERE round_id = ? AND consultant_id = ?");
                        $updRC->bind_param("ii", $roundId, $consId);
                        $updRC->execute();
                        $updRC->close();
                    }
                    break;

                case 'REJECT_REPORT':
                    $leadId = (int) ($details['lead_id'] ?? 0);

                    if (!$leadId) {
                        throw new Exception('ID lead không hợp lệ trong log.');
                    }

                    $updReport = $conn->prepare("UPDATE data_reports SET status = 'pending', resolved_at = NULL, resolved_by = NULL, reject_reason = NULL WHERE lead_id = ?");
                    $updReport->bind_param("i", $leadId);
                    $updReport->execute();
                    $updReport->close();

                    $updLead = $conn->prepare("UPDATE leads SET status = 'error' WHERE id = ?");
                    $updLead->bind_param("i", $leadId);
                    $updLead->execute();
                    $updLead->close();
                    break;

                default:
                    throw new Exception('Hành động này không hỗ trợ hoàn tác.');
            }

            // Mark the original log as rolled back
            $updLog = $conn->prepare("UPDATE admin_logs SET is_rolled_back = 1 WHERE id = ?");
            $updLog->bind_param("i", $logId);
            $updLog->execute();
            $updLog->close();

            logAdminAction($conn, $decodedUser['id'], 'ROLLBACK_ACTION', [
                'target_log_id' => $logId,
                'target_action' => $action
            ]);

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Hoàn tác thành công!']);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'get_admin_logs':
        $res = $conn->query("SELECT al.*, a.name as account_name, a.email as account_email, a.avatar as account_avatar 
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

    case 'get_system_activity_feed':
        $distLogs = [];
        // Query recent distribution logs
        $sqlDist = "SELECT dl.id, dl.lead_id, dl.assigned_to, dl.round_id, dl.status, dl.message, dl.received_at as timestamp,
                           l.name as lead_name, l.phone as lead_phone,
                           c.name as consultant_name, c.avatar as consultant_avatar,
                           r.round_name
                    FROM distribution_logs dl
                    LEFT JOIN leads l ON dl.lead_id = l.id
                    LEFT JOIN consultants c ON dl.assigned_to = c.id
                    LEFT JOIN distribution_rounds r ON dl.round_id = r.id
                    WHERE dl.status != 'silent'
                    ORDER BY dl.id DESC LIMIT 40";
        $resDist = $conn->query($sqlDist);
        if ($resDist) {
            while ($row = $resDist->fetch_assoc()) {
                $status = $row['status'];
                $leadName = $row['lead_name'] ?: 'Khách hàng ẩn danh';
                $leadNameEscaped = htmlspecialchars($leadName, ENT_QUOTES, 'UTF-8');
                $leadPhoneRaw = $row['lead_phone'] ?: '';
                $leadPhone = '';
                if (!empty($leadPhoneRaw)) {
                    $len = strlen($leadPhoneRaw);
                    if ($len > 3) {
                        $leadPhone = substr($leadPhoneRaw, 0, $len - 3) . '***';
                    } else {
                        $leadPhone = '***';
                    }
                }
                $leadPhoneEscaped = htmlspecialchars($leadPhone, ENT_QUOTES, 'UTF-8');
                $consultantName = $row['consultant_name'] ?: '';
                $consultantNameEscaped = htmlspecialchars($consultantName, ENT_QUOTES, 'UTF-8');
                $roundName = $row['round_name'] ?: '';

                $title = "";
                $description = "";
                $tag = "";
                $tagColor = "neutral";

                switch ($status) {
                    case 'assigned':
                        $title = "Bàn giao lead mới";
                        $description = "Bàn giao lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) cho Sale <strong>$consultantNameEscaped</strong>.";
                        $tag = $roundName ?: "Đã chia";
                        $tagColor = "success";
                        break;
                    case 'compensation':
                        $title = "Bù lead";
                        $description = "Bù lượt lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) cho Sale <strong>$consultantNameEscaped</strong>.";
                        $tag = "Bù lượt";
                        $tagColor = "success";
                        break;
                    case 'pending_work_hours':
                        $title = "Tạm giữ ngoài giờ";
                        $description = "Tạm giữ lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) ngoài giờ làm việc của Sale <strong>$consultantNameEscaped</strong>.";
                        $tag = "Chờ giờ làm";
                        $tagColor = "warning";
                        break;
                    case 'duplicate':
                        $title = "Từ chối trùng lặp";
                        $description = "Từ chối phân bổ lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) do trùng số điện thoại hệ thống.";
                        $tag = "Trùng lặp";
                        $tagColor = "danger";
                        break;
                    case 'blacklisted':
                        $title = "Chặn danh sách đen";
                        $description = "Chặn lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) do trùng số điện thoại/email trong Blacklist.";
                        $tag = "Blacklist";
                        $tagColor = "danger";
                        break;
                    case 'reallocated':
                        $title = "Thu hồi lead";
                        $description = "Thu hồi lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) từ Sale <strong>$consultantNameEscaped</strong>.";
                        $tag = "Tái phân bổ";
                        $tagColor = "info";
                        break;
                    case 'silent':
                        $title = "Đồng bộ im lặng";
                        $description = "Đồng bộ lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) nhưng không chia (chế độ Silent).";
                        $tag = "Chỉ đồng bộ";
                        $tagColor = "neutral";
                        break;
                    default:
                        $title = "Phân bổ lead";
                        $description = "Trạng thái phân bổ của lead <strong>$leadNameEscaped</strong> ($leadPhoneEscaped) là " . htmlspecialchars($status) . ".";
                        $tag = $status;
                        $tagColor = "neutral";
                        break;
                }

                $distLogs[] = [
                    'id' => 'dist_' . $row['id'],
                    'type' => 'distribution',
                    'timestamp' => $row['timestamp'],
                    'title' => $title,
                    'description' => $description,
                    'tag' => $tag,
                    'tag_color' => $tagColor,
                    'details' => $row['message'] ?: '',
                    'consultant_name' => $row['consultant_name'],
                    'consultant_avatar' => $row['consultant_avatar']
                ];
            }
        }

        // Query recent admin logs
        $adminLogs = [];
        $sqlAdmin = "SELECT al.id, al.account_id, al.action, al.details, al.created_at as timestamp, al.ip_address,
                            a.name as admin_name, a.avatar as admin_avatar
                     FROM admin_logs al
                     LEFT JOIN accounts a ON al.account_id = a.id
                     ORDER BY al.id DESC LIMIT 40";
        $resAdmin = $conn->query($sqlAdmin);
        if ($resAdmin) {
            while ($row = $resAdmin->fetch_assoc()) {
                $action = $row['action'];
                $adminName = $row['admin_name'] ?: ($row['account_id'] == 0 ? 'Hệ thống' : 'Người dùng ẩn danh');
                $adminNameEscaped = htmlspecialchars($adminName, ENT_QUOTES, 'UTF-8');
                $detailsStr = $row['details'] ?: '';

                $title = "";
                $description = "";
                $tag = "";
                $tagColor = "info";

                $detailsObj = json_decode($detailsStr, true);
                if (is_array($detailsObj)) {
                    if (isset($detailsObj['phone'])) {
                        $p = trim($detailsObj['phone']);
                        $len = strlen($p);
                        $detailsObj['phone'] = ($len > 3) ? substr($p, 0, $len - 3) . '***' : '***';
                    }
                    $detailsStr = json_encode($detailsObj, JSON_UNESCAPED_UNICODE);
                }

                switch ($action) {
                    case 'BLOCK_LEAD_BLACKLIST':
                        $type = $detailsObj['type'] ?? 'manual';
                        $leadPhone = $detailsObj['phone'] ?? '';
                        $leadPhoneEscaped = htmlspecialchars($leadPhone, ENT_QUOTES, 'UTF-8');
                        if ($type === 'auto') {
                            $title = "Chặn Blacklist tự động";
                            $description = "Hệ thống tự động chặn liên hệ <strong>$leadPhoneEscaped</strong> khớp danh sách đen.";
                            $tag = "Tự động";
                        } else {
                            $title = "Chặn Blacklist thủ công";
                            $description = "Admin <strong>$adminNameEscaped</strong> chặn thủ công liên hệ <strong>$leadPhoneEscaped</strong>.";
                            $tag = "Thủ công";
                        }
                        $tagColor = "danger";
                        break;
                    case 'IMPORT_BLACKLIST':
                        $count = $detailsObj['count'] ?? 0;
                        $title = "Nhập danh sách đen";
                        $description = "Admin <strong>$adminNameEscaped</strong> tải lên <strong>$count</strong> liên hệ chặn vào Blacklist.";
                        $tag = "Excel/CSV";
                        $tagColor = "warning";
                        break;
                    case 'UPDATE_SETTINGS':
                        $title = "Cập nhật cấu hình";
                        $description = "Admin <strong>$adminNameEscaped</strong> thay đổi các thiết lập hệ thống.";
                        $tag = "Cấu hình";
                        $tagColor = "info";
                        break;
                    case 'LOGIN':
                        $title = "Đăng nhập";
                        $description = "Người dùng <strong>$adminNameEscaped</strong> đăng nhập vào hệ thống quản trị.";
                        $tag = "Bảo mật";
                        $tagColor = "success";
                        break;
                    case 'APPROVE_REPORT_ZALO':
                    case 'APPROVE_REPORT':
                        $leadId = $detailsObj['lead_id'] ?? 0;
                        $title = "Duyệt báo cáo lỗi";
                        $description = "Admin <strong>$adminNameEscaped</strong> duyệt báo cáo lỗi cho lead ID <strong>#$leadId</strong>.";
                        $tag = "Duyệt ticket";
                        $tagColor = "success";
                        break;
                    case 'REJECT_REPORT_ZALO':
                    case 'REJECT_REPORT':
                        $leadId = $detailsObj['lead_id'] ?? 0;
                        $title = "Từ chối báo cáo lỗi";
                        $description = "Admin <strong>$adminNameEscaped</strong> từ chối báo cáo lỗi cho lead ID <strong>#$leadId</strong>.";
                        $tag = "Từ chối ticket";
                        $tagColor = "danger";
                        break;
                    case 'AUTO_APPROVE_REPORT':
                        $leadId = $detailsObj['lead_id'] ?? 0;
                        $title = "Tự động duyệt báo cáo lỗi";
                        $description = "Hệ thống tự động duyệt báo cáo lỗi cho lead ID <strong>#$leadId</strong>.";
                        $tag = "Tự động duyệt";
                        $tagColor = "success";
                        break;
                    case 'REASSIGN_LEAD':
                        $leadId = $detailsObj['lead_id'] ?? 0;
                        $title = "Giao lại lead";
                        $description = "Admin <strong>$adminNameEscaped</strong> giao lại lead ID <strong>#$leadId</strong>.";
                        $tag = "Giao lại";
                        $tagColor = "info";
                        break;
                    case 'FORCE_SYNC':
                        $title = "Ép buộc đồng bộ";
                        $description = "Admin <strong>$adminNameEscaped</strong> kích hoạt ép buộc đồng bộ dữ liệu.";
                        $tag = "Đồng bộ";
                        $tagColor = "info";
                        break;
                    case 'ADD_CONSULTANT':
                        $name = $detailsObj['name'] ?? '';
                        $title = "Thêm TVV";
                        $description = "Admin <strong>$adminNameEscaped</strong> thêm Tư vấn viên <strong>" . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . "</strong>.";
                        $tag = "Nhân sự";
                        $tagColor = "success";
                        break;
                    case 'EDIT_CONSULTANT':
                        $name = $detailsObj['name'] ?? '';
                        $title = "Sửa TVV";
                        $description = "Admin <strong>$adminNameEscaped</strong> sửa thông tin Tư vấn viên <strong>" . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . "</strong>.";
                        $tag = "Nhân sự";
                        $tagColor = "info";
                        break;
                    case 'DELETE_CONSULTANT':
                        $title = "Xóa TVV";
                        $description = "Admin <strong>$adminNameEscaped</strong> xóa nhân sự Tư vấn viên.";
                        $tag = "Nhân sự";
                        $tagColor = "danger";
                        break;
                    default:
                        $title = "Thao tác quản trị";
                        $description = "Admin <strong>$adminNameEscaped</strong> thực hiện hành động: <strong>$action</strong>.";
                        $tag = $action;
                        $tagColor = "info";
                        break;
                }

                $adminLogs[] = [
                    'id' => 'admin_' . $row['id'],
                    'type' => 'admin',
                    'timestamp' => $row['timestamp'],
                    'title' => $title,
                    'description' => $description,
                    'tag' => $tag,
                    'tag_color' => $tagColor,
                    'details' => $detailsStr,
                    'admin_name' => $adminName,
                    'consultant_avatar' => $row['admin_avatar']
                ];
            }
        }

        // Query recent data reports (Tickets)
        $ticketLogs = [];
        $sqlTicket = "SELECT dr.id, dr.lead_id, dr.consultant_id, dr.reason, dr.status, dr.created_at as timestamp,
                             c.name as consultant_name, c.avatar as consultant_avatar,
                             l.name as lead_name
                      FROM data_reports dr
                      LEFT JOIN consultants c ON dr.consultant_id = c.id
                      LEFT JOIN leads l ON dr.lead_id = l.id
                      ORDER BY dr.id DESC LIMIT 40";
        $resTicket = $conn->query($sqlTicket);
        if ($resTicket) {
            while ($row = $resTicket->fetch_assoc()) {
                $status = $row['status'];
                $consultantName = $row['consultant_name'] ?: 'Ẩn danh';
                $consultantNameEscaped = htmlspecialchars($consultantName, ENT_QUOTES, 'UTF-8');
                $leadName = $row['lead_name'] ?: 'Khách hàng ẩn danh';
                $leadNameEscaped = htmlspecialchars($leadName, ENT_QUOTES, 'UTF-8');
                $reason = $row['reason'] ?: 'Không có lý do';
                $reasonEscaped = htmlspecialchars($reason, ENT_QUOTES, 'UTF-8');

                $title = "Báo cáo lỗi Ticket";
                $description = "";
                $tag = "";
                $tagColor = "warning";

                switch ($status) {
                    case 'pending':
                        $description = "Sale <strong>$consultantNameEscaped</strong> gửi báo cáo lỗi cho lead <strong>$leadNameEscaped</strong>. Lý do: <em>$reasonEscaped</em>.";
                        $tag = "Chờ duyệt";
                        $tagColor = "warning";
                        break;
                    case 'resolved':
                        $description = "Báo cáo lỗi cho lead <strong>$leadNameEscaped</strong> từ Sale <strong>$consultantNameEscaped</strong> đã được phê duyệt.";
                        $tag = "Đã duyệt";
                        $tagColor = "success";
                        break;
                    case 'rejected':
                        $description = "Báo cáo lỗi cho lead <strong>$leadNameEscaped</strong> từ Sale <strong>$consultantNameEscaped</strong> đã bị từ chối.";
                        $tag = "Bị từ chối";
                        $tagColor = "danger";
                        break;
                }

                $ticketLogs[] = [
                    'id' => 'ticket_' . $row['id'],
                    'type' => 'ticket',
                    'timestamp' => $row['timestamp'],
                    'title' => $title,
                    'description' => $description,
                    'tag' => $tag,
                    'tag_color' => $tagColor,
                    'details' => "Lý do báo cáo: " . $reason,
                    'consultant_name' => $row['consultant_name'],
                    'consultant_avatar' => $row['consultant_avatar']
                ];
            }
        }

        // Merge arrays
        $merged = array_merge($distLogs, $adminLogs, $ticketLogs);

        // Sort by timestamp DESC
        usort($merged, function ($a, $b) {
            return strcmp($b['timestamp'], $a['timestamp']);
        });

        // Limit to 50 items
        $merged = array_slice($merged, 0, 50);

        echo json_encode(['success' => true, 'data' => $merged]);
        break;

    case 'get_notification_logs':
        if (!isset($decodedUser) || !$decodedUser) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            break;
        }

        $channel = $_GET['channel'] ?? 'all'; // all, email, zalo
        $type = $_GET['type'] ?? 'all';       // all, sale, admin
        $saleId = isset($_GET['sale']) && $_GET['sale'] !== 'all' ? (int)$_GET['sale'] : 0;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 10;
        if ($page < 1) $page = 1;
        if ($pageSize < 1) $pageSize = 10;

        $saleEmail = '';
        $saleZaloChatId = '';
        if ($saleId > 0) {
            $stmtC = $conn->prepare("SELECT email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
            if ($stmtC) {
                $stmtC->bind_param("i", $saleId);
                $stmtC->execute();
                $cRow = $stmtC->get_result()->fetch_assoc();
                if ($cRow) {
                    $saleEmail = trim($cRow['email'] ?? '');
                    $saleZaloChatId = trim($cRow['zalo_chat_id'] ?? '');
                }
                $stmtC->close();
            }
        }

        $mailLogs = [];
        if ($channel === 'all' || $channel === 'email') {
            $mailConds = ["1=1"];
            $mailParams = [];
            $mailTypes = "";
            if ($saleId > 0) {
                if (!empty($saleEmail)) {
                    $mailConds[] = "to_email = ?";
                    $mailParams[] = $saleEmail;
                    $mailTypes .= "s";
                } else {
                    $mailConds[] = "1=0";
                }
            }
            if (!empty($search)) {
                $searchParam = '%' . $search . '%';
                $mailConds[] = "(to_email LIKE ? OR subject LIKE ? OR body_html LIKE ?)";
                $mailParams[] = $searchParam;
                $mailParams[] = $searchParam;
                $mailParams[] = $searchParam;
                $mailTypes .= "sss";
            }
            $mailWhere = implode(" AND ", $mailConds);
            $stmtM = $conn->prepare("
                SELECT id, to_email as target, subject, body_html as body, status, created_at, sent_at 
                FROM mail_queue 
                WHERE $mailWhere 
                ORDER BY id DESC LIMIT 1000
            ");
            if ($stmtM) {
                if (!empty($mailTypes)) {
                    $stmtM->bind_param($mailTypes, ...$mailParams);
                }
                $stmtM->execute();
                $resMail = $stmtM->get_result();
                while ($row = $resMail->fetch_assoc()) {
                    $mailLogs[] = [
                        'id' => 'mail_' . $row['id'],
                        'channel' => 'email',
                        'target' => $row['target'],
                        'subject' => $row['subject'],
                        'body' => strip_tags($row['body']),
                        'status' => $row['status'],
                        'created_at' => $row['created_at'],
                        'sent_at' => $row['sent_at'] ?: $row['created_at']
                    ];
                }
                $stmtM->close();
            }
        }

        $zaloQueueLogs = [];
        if ($channel === 'all' || $channel === 'zalo') {
            $zaloConds = ["1=1"];
            $zaloParams = [];
            $zaloTypes = "";
            if ($saleId > 0) {
                if (!empty($saleZaloChatId)) {
                    $zaloConds[] = "chat_id = ?";
                    $zaloParams[] = $saleZaloChatId;
                    $zaloTypes .= "s";
                } else {
                    $zaloConds[] = "1=0";
                }
            }
            if (!empty($search)) {
                $searchParam = '%' . $search . '%';
                $zaloConds[] = "(chat_id LIKE ? OR body_text LIKE ?)";
                $zaloParams[] = $searchParam;
                $zaloParams[] = $searchParam;
                $zaloTypes .= "ss";
            }
            $zaloWhere = implode(" AND ", $zaloConds);
            $stmtZ = $conn->prepare("
                SELECT id, chat_id as target, body_text as body, status, created_at, sent_at 
                FROM zalo_queue 
                WHERE $zaloWhere 
                ORDER BY id DESC LIMIT 1000
            ");
            if ($stmtZ) {
                if (!empty($zaloTypes)) {
                    $stmtZ->bind_param($zaloTypes, ...$zaloParams);
                }
                $stmtZ->execute();
                $resZalo = $stmtZ->get_result();
                while ($row = $resZalo->fetch_assoc()) {
                    $zaloQueueLogs[] = [
                        'id' => 'zalo_' . $row['id'],
                        'channel' => 'zalo',
                        'target' => $row['target'],
                        'subject' => 'Zalo Message',
                        'body' => $row['body'],
                        'status' => $row['status'],
                        'created_at' => $row['created_at'],
                        'sent_at' => $row['sent_at'] ?: $row['created_at']
                    ];
                }
                $stmtZ->close();
            }
        }

        $zaloDirectLogs = [];
        if ($channel === 'all' || $channel === 'zalo') {
            $zaloLogFile = __DIR__ . '/zalo_send_log.txt';
            $zaloDirectLogs = parse_zalo_direct_logs($zaloLogFile);
            
            // Deduplicate direct logs with zalo queue logs in memory
            $dedupedDirectLogs = [];
            foreach ($zaloDirectLogs as $dirLog) {
                $isDup = false;
                $dirTime = strtotime($dirLog['created_at']);
                $dirBodyTrim = trim($dirLog['body']);
                
                foreach ($zaloQueueLogs as $qLog) {
                    if ($qLog['target'] === $dirLog['target'] && trim($qLog['body']) === $dirBodyTrim) {
                        $qTime = strtotime($qLog['created_at']);
                        if (abs($dirTime - $qTime) <= 180) {
                            $isDup = true;
                            break;
                        }
                    }
                }
                if (!$isDup) {
                    $dedupedDirectLogs[] = $dirLog;
                }
            }
            $zaloDirectLogs = $dedupedDirectLogs;
        }

        $rawLogs = array_merge($mailLogs, $zaloQueueLogs, $zaloDirectLogs);

        $filteredLogs = [];
        foreach ($rawLogs as $item) {
            $lowerBody = mb_strtolower($item['body'], 'UTF-8');
            $lowerSubject = mb_strtolower($item['subject'], 'UTF-8');
            
            $isAdmin = false;
            if (
                strpos($lowerBody, 'duyệt') !== false && 
                (strpos($lowerBody, '/duyet') !== false || strpos($lowerBody, '/tuchoi') !== false || strpos($lowerBody, 'lệnh duyệt nhanh') !== false)
            ) {
                $isAdmin = true;
            } else if (
                strpos($lowerBody, 'cảnh báo data dưới chuẩn') !== false || 
                strpos($lowerBody, 'cảnh báo sót lead') !== false || 
                strpos($lowerBody, 'dưới chuẩn') !== false
            ) {
                $isAdmin = true;
            } else if (
                strpos($lowerSubject, 'cảnh báo') !== false || 
                strpos($lowerSubject, 'sót lead') !== false
            ) {
                $isAdmin = true;
            }
            
            $item['type'] = $isAdmin ? 'admin' : 'sale';

            if ($type !== 'all' && $item['type'] !== $type) {
                continue;
            }
            // Check direct logs for saleId and search filter since parse_zalo_direct_logs returns raw log entries
            if (!empty($item['is_direct'])) {
                if ($saleId > 0) {
                    $isMatchSale = false;
                    $cleanTarget = strtolower(trim($item['target']));
                    if (!empty($saleEmail) && strtolower($saleEmail) === $cleanTarget) {
                        $isMatchSale = true;
                    }
                    if (!empty($saleZaloChatId) && strtolower($saleZaloChatId) === $cleanTarget) {
                        $isMatchSale = true;
                    }
                    if (!$isMatchSale) {
                        continue;
                    }
                }
                if (!empty($search)) {
                    $lowerSearch = mb_strtolower($search, 'UTF-8');
                    $matchSearch = (
                        strpos(mb_strtolower($item['target'], 'UTF-8'), $lowerSearch) !== false ||
                        strpos(mb_strtolower($item['subject'], 'UTF-8'), $lowerSearch) !== false ||
                        strpos($lowerBody, $lowerSearch) !== false
                    );
                    if (!$matchSearch) {
                        continue;
                    }
                }
            }

            $filteredLogs[] = $item;
        }

        usort($filteredLogs, function ($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        $totalCount = count($filteredLogs);
        $offset = ($page - 1) * $pageSize;
        $paginatedLogs = array_slice($filteredLogs, $offset, $pageSize);

        echo json_encode([
            'success' => true,
            'data' => $paginatedLogs,
            'total_count' => $totalCount,
            'page' => $page,
            'pageSize' => $pageSize
        ]);
        break;

    case 'add_account':
        if ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'superadmin' && $decodedUser['role'] !== 'super_admin') {
            echo json_encode(['success' => false, 'message' => 'Bạn không có quyền tạo tài khoản mới']);
            break;
        }
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $username = trim($input['username'] ?? '');
            $password = $input['password'] ?? '';
            $name = trim($input['name'] ?? '');
            $role = $input['role'] ?? 'viewer';
            $email = trim($input['email'] ?? '');
            $zalo_chat_id = trim($input['zalo_chat_id'] ?? '');
            $avatar = isset($input['avatar']) ? trim($input['avatar']) : null;
            if ($avatar === '')
                $avatar = null;

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

            $stmt = $conn->prepare("INSERT INTO accounts (username, password_hash, name, role, email, is_confirmed, confirm_token, zalo_chat_id, avatar) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)");
            $stmt->bind_param("ssssssss", $username, $hash, $name, $role, $email, $token, $zalo_chat_id, $avatar);

            if ($stmt->execute()) {
                $newId = $conn->insert_id;

                // Build confirm link
                $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                $basePath = preg_replace('/\/api\.php.*$/i', '', $_SERVER['REQUEST_URI'] ?? '');
                $confirmLink = $proto . '://' . $host . $basePath . '/confirm.php?token=' . $token . '&p=' . base64_encode($password);

                require_once 'mailer.php';
                sendAdminConfirmationEmail($email, $name, $confirmLink);
                logAdminAction($conn, $decodedUser['id'], 'ADD_ACCOUNT', ['id' => $newId, 'username' => $username, 'name' => $name, 'role' => $role, 'email' => $email, 'avatar' => $avatar]);

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
            
            $isTargetSelf = $id === (int)$decodedUser['id'];
            $isAdmin = $decodedUser['role'] === 'admin' || $decodedUser['role'] === 'superadmin' || $decodedUser['role'] === 'super_admin';

            if (!$isAdmin && !$isTargetSelf) {
                echo json_encode(['success' => false, 'message' => 'Bạn không có quyền chỉnh sửa tài khoản này']);
                break;
            }

            $username = trim($input['username'] ?? '');
            $password = $input['password'] ?? '';
            $name = trim($input['name'] ?? '');
            $role = $input['role'] ?? 'viewer';
            
            if (!$isAdmin) {
                $exRes = $conn->query("SELECT role FROM accounts WHERE id = " . $id);
                $exRow = $exRes ? $exRes->fetch_assoc() : null;
                $role = $exRow ? $exRow['role'] : 'viewer';
            }

            $email = trim($input['email'] ?? '');
            $zalo_chat_id = trim($input['zalo_chat_id'] ?? '');
            $avatar = isset($input['avatar']) ? trim($input['avatar']) : null;
            if ($avatar === '')
                $avatar = null;

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
                $stmt = $conn->prepare("UPDATE accounts SET username=?, password_hash=?, name=?, role=?, email=?, zalo_chat_id=?, avatar=? WHERE id=?");
                $stmt->bind_param("sssssssi", $username, $hash, $name, $role, $dbEmail, $zalo_chat_id, $avatar, $id);
            } else {
                $stmt = $conn->prepare("UPDATE accounts SET username=?, name=?, role=?, email=?, zalo_chat_id=?, avatar=? WHERE id=?");
                $stmt->bind_param("ssssssi", $username, $name, $role, $dbEmail, $zalo_chat_id, $avatar, $id);
            }

            if ($stmt->execute()) {
                logAdminAction($conn, $decodedUser['id'], 'EDIT_ACCOUNT', ['id' => $id, 'username' => $username, 'name' => $name, 'role' => $role, 'email' => $email, 'avatar' => $avatar]);
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
        $name = trim($input['name'] ?? '');
        $avatar = isset($input['avatar']) ? trim($input['avatar']) : null;
        if ($avatar === '')
            $avatar = null;
        $userId = $decodedUser['id'];

        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tên không được để trống']);
            break;
        }

        $upd = $conn->prepare("UPDATE accounts SET name = ?, avatar = ? WHERE id = ?");
        $upd->bind_param("ssi", $name, $avatar, $userId);
        if ($upd->execute()) {
            logAdminAction($conn, $userId, 'UPDATE_PROFILE', ['name' => $name, 'avatar' => $avatar]);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Lỗi khi cập nhật hồ sơ']);
        }
        break;

    case 'update_consultant_self_profile':
        $input = json_decode(file_get_contents('php://input'), true);
        $name = trim($input['name'] ?? '');
        $avatar = isset($input['avatar']) ? trim($input['avatar']) : null;
        if ($avatar === '') $avatar = null;
        $work_start_time = trim($input['work_start_time'] ?? '00:00');
        $work_end_time = trim($input['work_end_time'] ?? '23:59');
        
        $isSale = $decodedUser['role'] === 'sale';
        $isAdmin = ($decodedUser['role'] === 'admin' || $decodedUser['role'] === 'superadmin');
        $saleFilterId = isset($input['consultant_id']) && $input['consultant_id'] !== '' ? (int) $input['consultant_id'] : null;
        
        if ($isSale) {
            $targetId = $decodedUser['id'];
        } else if ($isAdmin) {
            $targetId = $saleFilterId;
        } else {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: Bạn không có quyền cập nhật hồ sơ tư vấn viên này.']);
            break;
        }

        if (!$targetId) {
            echo json_encode(['success' => false, 'message' => 'Không xác định được ID tư vấn viên.']);
            break;
        }

        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tên không được để trống.']);
            break;
        }

        if (empty($work_start_time) || !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $work_start_time)) {
            echo json_encode(['success' => false, 'message' => 'Giờ bắt đầu làm việc không hợp lệ (định dạng HH:MM từ 00:00 đến 23:59)']);
            break;
        }
        if (empty($work_end_time) || !preg_match('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/', $work_end_time)) {
            echo json_encode(['success' => false, 'message' => 'Giờ kết thúc làm việc không hợp lệ (định dạng HH:MM từ 00:00 đến 23:59)']);
            break;
        }
        $work_schedule = isset($input['work_schedule']) ? (is_array($input['work_schedule']) ? json_encode($input['work_schedule']) : $input['work_schedule']) : null;
        if ($work_schedule !== null && !validateWorkSchedule($work_schedule)) {
            echo json_encode(['success' => false, 'message' => 'Cấu hình lịch làm việc chi tiết không hợp lệ.']);
            break;
        }

        $dob = !empty($input['dob']) ? $input['dob'] : null;
        $gender = !empty($input['gender']) ? $input['gender'] : null;
        $citizen_id = !empty($input['citizen_id']) ? $input['citizen_id'] : null;
        $address = !empty($input['address']) ? $input['address'] : null;
        $bank_name = !empty($input['bank_name']) ? $input['bank_name'] : null;
        $bank_account = !empty($input['bank_account']) ? $input['bank_account'] : null;

        $stmt = $conn->prepare("UPDATE consultants SET name=?, work_start_time=?, work_end_time=?, work_schedule=?, avatar=?, dob=?, gender=?, citizen_id=?, address=?, bank_name=?, bank_account=? WHERE id=?");
        $stmt->bind_param("sssssssssssi", $name, $work_start_time, $work_end_time, $work_schedule, $avatar, $dob, $gender, $citizen_id, $address, $bank_name, $bank_account, $targetId);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Lỗi khi cập nhật cấu hình cá nhân.']);
        }
        $stmt->close();
        break;

    case 'get_my_activity_logs':
        $userId = $decodedUser['id'];
        $stmt = $conn->prepare("SELECT al.*, a.name as account_name, a.email as account_email 
                                FROM admin_logs al 
                                LEFT JOIN accounts a ON al.account_id = a.id 
                                WHERE al.account_id = ? 
                                ORDER BY al.created_at DESC 
                                LIMIT 200");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $res = $stmt->get_result();
        $data = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $data[] = $row;
            }
        }
        $stmt->close();
        echo json_encode(['success' => true, 'data' => $data]);
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
        if ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'superadmin' && $decodedUser['role'] !== 'super_admin') {
            echo json_encode(['success' => false, 'message' => 'Bạn không có quyền thực hiện hành động này']);
            break;
        }
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
        $stmtOther = $conn->prepare("SELECT id, name, username, email FROM accounts WHERE (role = 'admin' OR role = 'superadmin') AND id != ?");
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
        if ($decodedUser['role'] !== 'admin' && $decodedUser['role'] !== 'superadmin' && $decodedUser['role'] !== 'super_admin') {
            echo json_encode(['success' => false, 'message' => 'Bạn không có quyền thực hiện hành động này']);
            break;
        }
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
                $stmtVerify = $conn->prepare("SELECT id FROM accounts WHERE id = ? AND (role = 'admin' OR role = 'superadmin') LIMIT 1");
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
                if (!empty($row['setting_value']))
                    $botLink = $row['setting_value'];
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
                if (!empty($row['setting_value']))
                    $botLink = $row['setting_value'];
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
                                    . "Bạn vừa được cấp quyền xử lý Báo cáo lỗi (Ticket) từ hệ thống Rich Land DATA.\n\n"
                                    . "Từ bây giờ, hệ thống sẽ tự động gửi thông báo cho bạn mỗi khi có Ticket mới chờ duyệt.";
                                sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg, false);
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
            } catch (Throwable $e) {
                ob_end_clean();
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid ID']);
        }
        break;

    case 'get_dashboard_stats':
        $date = $_GET['date'] ?? 'Hôm nay';
        $dbVer = 0;
        $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
        if ($vStmt && $vStmt->num_rows > 0) {
            $dbVer = (int)$vStmt->fetch_assoc()['setting_value'];
        }

        // Define date filters - SARGable for performance
        $dateCondition = "received_at >= CURDATE() AND received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        $prevDateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND received_at < CURDATE()";

        if ($date === 'Hôm qua') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND received_at < CURDATE()";
            $prevDateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        } else if ($date === 'Tuần này') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND received_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            $prevDateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
        } else if ($date === 'Tuần trước') {
            $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
            $prevDateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === 'Tuần trước nữa') {
            $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
            $prevDateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 21 DAY) AND received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY)";
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

        $dateConditionDl = str_replace('received_at', 'dl.received_at', $dateCondition);
        $prevDateConditionDl = str_replace('received_at', 'dl.received_at', $prevDateCondition);

        // Query current period stats using GROUP BY for index optimization
        $statsSql = "SELECT dl.status, COUNT(*) as cnt 
                     FROM distribution_logs dl 
                     INNER JOIN (
                         SELECT lead_id, MAX(id) as max_id 
                         FROM distribution_logs 
                         WHERE status != 'silent' AND $dateCondition
                         GROUP BY lead_id
                     ) dl_max ON dl.id = dl_max.max_id
                     WHERE $dateConditionDl 
                     GROUP BY dl.status";
        $statsResRaw = $conn->query($statsSql);
        $statusCounts = [
            'assigned' => 0,
            'compensation' => 0,
            'rule_6_month' => 0,
            'pending_work_hours' => 0,
            'error' => 0,
            'duplicate' => 0,
            'reminder' => 0,
            'no_consultant' => 0,
            'blacklisted' => 0,
            'pending_approval' => 0,
            'rejected' => 0,
            'fallback' => 0,
            'success' => 0
        ];
        if ($statsResRaw) {
            while ($row = $statsResRaw->fetch_assoc()) {
                $status = $row['status'];
                $cnt = (int) $row['cnt'];
                if (array_key_exists($status, $statusCounts)) {
                    $statusCounts[$status] = $cnt;
                }
            }
        }

        // Query previous period stats for % change
        $prevStatsSql = "SELECT dl.status, COUNT(*) as cnt 
                         FROM distribution_logs dl 
                         INNER JOIN (
                             SELECT lead_id, MAX(id) as max_id 
                             FROM distribution_logs 
                             WHERE status != 'silent' AND $prevDateCondition
                             GROUP BY lead_id
                         ) dl_max ON dl.id = dl_max.max_id
                         WHERE $prevDateConditionDl 
                         GROUP BY dl.status";
        $prevStatsResRaw = $conn->query($prevStatsSql);
        $prevStatusCounts = [
            'assigned' => 0,
            'compensation' => 0,
            'rule_6_month' => 0,
            'pending_work_hours' => 0,
            'error' => 0,
            'duplicate' => 0,
            'reminder' => 0,
            'no_consultant' => 0,
            'blacklisted' => 0,
            'pending_approval' => 0,
            'rejected' => 0,
            'fallback' => 0,
            'success' => 0
        ];
        if ($prevStatsResRaw) {
            while ($row = $prevStatsResRaw->fetch_assoc()) {
                $status = $row['status'];
                $cnt = (int) $row['cnt'];
                if (array_key_exists($status, $prevStatusCounts)) {
                    $prevStatusCounts[$status] = $cnt;
                }
            }
        }

        // Query active blacklist counts from admin_logs (excluding manual ones that are already in distribution_logs as status='blacklisted' to avoid double-counting)
        $dateConditionCreated = str_replace('received_at', 'created_at', $dateCondition);
        $prevDateConditionCreated = str_replace('received_at', 'created_at', $prevDateCondition);

        $autoBlacklistCnt = 0;
        $blacklistRes = $conn->query("SELECT COUNT(*) as cnt FROM admin_logs WHERE action = 'BLOCK_LEAD_BLACKLIST' AND log_type = 'auto' AND $dateConditionCreated");
        if ($blacklistRes && $row = $blacklistRes->fetch_assoc()) {
            $autoBlacklistCnt = (int) $row['cnt'];
        }

        $prevAutoBlacklistCnt = 0;
        $prevBlacklistRes = $conn->query("SELECT COUNT(*) as cnt FROM admin_logs WHERE action = 'BLOCK_LEAD_BLACKLIST' AND log_type = 'auto' AND $prevDateConditionCreated");
        if ($prevBlacklistRes && $row = $prevBlacklistRes->fetch_assoc()) {
            $prevAutoBlacklistCnt = (int) $row['cnt'];
        }

        // Query AI Pre-screener statistics (passed vs failed)
        $aiPassedCount = 0;
        $aiFailedCount = 0;
        if ($dbVer >= 140) {
            $cond1 = str_replace('received_at', 'ai_screening_started_at', $dateCondition);
            $cond2 = str_replace('received_at', 'created_at', $dateCondition);
            $dateConditionAI = "(($cond1) OR (ai_screening_started_at IS NULL AND $cond2))";
        } else {
            $dateConditionAI = str_replace('received_at', 'created_at', $dateCondition);
        }
        $aiScreenerSql = "SELECT ai_screener_status, COUNT(*) as cnt FROM leads WHERE $dateConditionAI AND ai_screener_status IN ('passed', 'failed') GROUP BY ai_screener_status";
        $aiScreenerRes = $conn->query($aiScreenerSql);
        if ($aiScreenerRes) {
            while ($row = $aiScreenerRes->fetch_assoc()) {
                if ($row['ai_screener_status'] === 'passed') {
                    $aiPassedCount = (int) $row['cnt'];
                } else if ($row['ai_screener_status'] === 'failed') {
                    $aiFailedCount = (int) $row['cnt'];
                }
            }
        }

        // Query accepted leads count
        $acceptedCount = 0;
        $acceptedRes = $conn->query("SELECT COUNT(*) as cnt FROM leads WHERE $dateConditionCreated AND is_accepted = 1");
        if ($acceptedRes && $row = $acceptedRes->fetch_assoc()) {
            $acceptedCount = (int) $row['cnt'];
        }

        // ticket_count counts ALL tickets created in the date range (for Chatbot card)
        $todayTickets = 0;
        $ticketRes = $conn->query("SELECT COUNT(*) as cnt FROM data_reports WHERE $dateConditionCreated");
        if ($ticketRes && $row = $ticketRes->fetch_assoc()) {
            $todayTickets = (int) $row['cnt'];
        }

        // ticket_errors counts only APPROVED tickets in the date range created_at (for Dashboard card details)
        $ticketErrors = 0;
        $tktErrRes = $conn->query("SELECT COUNT(*) as cnt FROM data_reports WHERE status IN ('approved', 'approved_no_comp') AND $dateConditionCreated");
        if ($tktErrRes && $row = $tktErrRes->fetch_assoc()) {
            $ticketErrors = (int) $row['cnt'];
        }

        // Previous period calculations for change percentage
        $prevTicketErrors = 0;
        $prevTktErrRes = $conn->query("SELECT COUNT(*) as cnt FROM data_reports WHERE status IN ('approved', 'approved_no_comp') AND $prevDateConditionCreated");
        if ($prevTktErrRes && $row = $prevTktErrRes->fetch_assoc()) {
            $prevTicketErrors = (int) $row['cnt'];
        }

        // 1. Success (Distributed) Calculations
        $raw_distributed = $statusCounts['assigned'] + $statusCounts['rule_6_month'] + $statusCounts['pending_work_hours'] + $statusCounts['fallback'] + $statusCounts['success'] + $statusCounts['compensation'];
        $distributed_today = max(0, $raw_distributed - $ticketErrors);

        // Keep details consistent: distributed_assigned + distributed_compensation = distributed_today
        $assigned_count = $statusCounts['assigned'] + $statusCounts['rule_6_month'] + $statusCounts['pending_work_hours'] + $statusCounts['fallback'] + $statusCounts['success'];
        $compensation_count = $statusCounts['compensation'];
        $assigned_adjusted = max(0, $assigned_count - $ticketErrors);
        $rem = max(0, $ticketErrors - $assigned_count);
        $compensation_adjusted = max(0, $compensation_count - $rem);
        
        $assigned_total = $assigned_adjusted;
        $compensation_total = $compensation_adjusted;

        // 2. Duplicates Calculations
        $duplicates = $statusCounts['duplicate'] + $statusCounts['reminder'];

        // 3. Errors Calculations
        $underStandard = $statusCounts['rejected'] + $statusCounts['pending_approval'] + $statusCounts['error'] + $statusCounts['no_consultant'];
        $blacklistCnt = $statusCounts['blacklisted'] + $autoBlacklistCnt;
        $errors = $ticketErrors + $underStandard + $blacklistCnt;

        // 4. Total Calculations
        $total_today = $distributed_today + $duplicates + $errors;

        $statsRes = [
            'total' => $total_today,
            'distributed' => $distributed_today,
            'duplicates' => $duplicates,
            'errors' => $errors
        ];

        // Do the same for previous period to keep % change consistent
        $prev_raw_distributed = $prevStatusCounts['assigned'] + $prevStatusCounts['rule_6_month'] + $prevStatusCounts['pending_work_hours'] + $prevStatusCounts['fallback'] + $prevStatusCounts['success'] + $prevStatusCounts['compensation'];
        $prev_distributed_today = max(0, $prev_raw_distributed - $prevTicketErrors);
        $prev_duplicates = $prevStatusCounts['duplicate'] + $prevStatusCounts['reminder'];
        $prev_underStandard = $prevStatusCounts['rejected'] + $prevStatusCounts['pending_approval'] + $prevStatusCounts['error'] + $prevStatusCounts['no_consultant'];
        $prev_blacklistCnt = $prevStatusCounts['blacklisted'] + $prevAutoBlacklistCnt;
        $prev_errors = $prevTicketErrors + $prev_underStandard + $prev_blacklistCnt;
        $prev_total_today = $prev_distributed_today + $prev_duplicates + $prev_errors;

        $prevStatsRes = [
            'total' => $prev_total_today,
            'distributed' => $prev_distributed_today,
            'duplicates' => $prev_duplicates,
            'errors' => $prev_errors
        ];

        // Also define $raw_duplicates and $raw_errors to keep totalLogsCount consistent
        $raw_duplicates = $duplicates;
        $raw_errors = $underStandard;

        $calcChange = function ($current, $prev) {
            $current = (int) $current;
            $prev = (int) $prev;
            if ($prev == 0)
                return $current > 0 ? '+100%' : '0%';
            $change = (($current - $prev) / $prev) * 100;
            return ($change > 0 ? '+' : '') . number_format($change, 1) . '%';
        };

        // NEW CALCULATIONS: Out-of-Hours Lead Ratio and Fair-Share Equity
        // 1. Out of Hours Lead Ratio
        $outOfHoursRes = $conn->query("SELECT COUNT(*) as cnt FROM distribution_logs WHERE (status = 'pending_work_hours' OR message LIKE '%ngoài khung giờ làm việc%' OR message LIKE '%outside working hours%') AND $dateCondition");
        $outOfHoursCount = ($outOfHoursRes && $row = $outOfHoursRes->fetch_assoc()) ? (int)$row['cnt'] : 0;
        
        $totalLogsCount = (int)$statsRes['total'];
        $outOfHoursRatioVal = $totalLogsCount > 0 ? ($outOfHoursCount / $totalLogsCount) * 100 : 0;
        $outOfHoursRatio = number_format($outOfHoursRatioVal, 1) . '%';

        $prevOutOfHoursRes = $conn->query("SELECT COUNT(*) as cnt FROM distribution_logs WHERE (status = 'pending_work_hours' OR message LIKE '%ngoài khung giờ làm việc%' OR message LIKE '%outside working hours%') AND $prevDateCondition");
        $prevOutOfHoursCount = ($prevOutOfHoursRes && $row = $prevOutOfHoursRes->fetch_assoc()) ? (int)$row['cnt'] : 0;
        
        $prevTotalLogsCount = (int)$prevStatsRes['total'];
        $prevOutOfHoursRatioVal = $prevTotalLogsCount > 0 ? ($prevOutOfHoursCount / $prevTotalLogsCount) * 100 : 0;
        
        $outOfHoursChange = $calcChange($outOfHoursCount, $prevOutOfHoursCount);

        // 2. Fair-Share Equity
        $calcFairness = function($conn, $dateCondition) {
            $consultants = [];
            $sql = "SELECT id FROM consultants WHERE status = 'active'";
            $res = $conn->query($sql);
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $cId = (int)$row['id'];
                    $consultants[$cId] = [
                        'id' => $cId,
                        'receive_ratio' => 1,
                        'assigned_count' => 0
                    ];
                }
            }
            
            if (empty($consultants)) {
                return ['fairness' => 100.0, 'sd' => 0.0];
            }
            
            $leadCountsSql = "SELECT assigned_to, 
                                     CASE 
                                       WHEN status = 'pending_work_hours' AND (message LIKE '%đền bù%' OR message LIKE '%compensation%' OR message LIKE '%Bù lượt%') THEN 'compensation'
                                       ELSE status 
                                     END as adjusted_status, 
                                     COUNT(*) as cnt 
                              FROM distribution_logs 
                              WHERE $dateCondition 
                                AND status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours') 
                              GROUP BY assigned_to, adjusted_status";
            $countsRes = $conn->query($leadCountsSql);
            $consultantStatusCounts = [];
            if ($countsRes) {
                while ($row = $countsRes->fetch_assoc()) {
                    $cId = (int)$row['assigned_to'];
                    $status = $row['adjusted_status'];
                    $cnt = (int)$row['cnt'];
                    if (!isset($consultantStatusCounts[$cId])) {
                        $consultantStatusCounts[$cId] = [
                            'assigned' => 0,
                            'compensation' => 0,
                            'rule_6_month' => 0,
                            'pending_work_hours' => 0,
                            'error' => 0
                        ];
                    }
                    if (array_key_exists($status, $consultantStatusCounts[$cId])) {
                        $consultantStatusCounts[$cId][$status] = $cnt;
                    }
                }
            }
            
            foreach ($consultants as $cId => &$c) {
                if (isset($consultantStatusCounts[$cId])) {
                    $sc = $consultantStatusCounts[$cId];
                    $c['assigned_count'] = $sc['assigned'] + $sc['compensation'] + $sc['rule_6_month'] + $sc['pending_work_hours'] + max(0, $sc['error'] - $sc['compensation']);
                }
            }
            unset($c);
            
            $rawCounts = [];
            $normalizedCounts = [];
            $totalLeads = 0;
            foreach ($consultants as $c) {
                $rawCounts[] = $c['assigned_count'];
                $ratio = max(1, $c['receive_ratio']);
                $normalizedCounts[] = $c['assigned_count'] * $ratio;
                $totalLeads += $c['assigned_count'];
            }
            
            $N = count($consultants);
            $mean = 0;
            $standardDeviation = 0;
            $giniNormalized = 0;
            
            if ($N > 0) {
                $mean = $totalLeads / $N;
                
                $sumSqDiff = 0;
                foreach ($rawCounts as $x) {
                    $sumSqDiff += pow($x - $mean, 2);
                }
                $standardDeviation = sqrt($sumSqDiff / $N);
                
                $sumNorm = array_sum($normalizedCounts);
                if ($sumNorm > 0) {
                    $doubleSumDiffNorm = 0;
                    for ($i = 0; $i < $N; $i++) {
                        for ($j = 0; $j < $N; $j++) {
                            $doubleSumDiffNorm += abs($normalizedCounts[$i] - $normalizedCounts[$j]);
                        }
                    }
                    $giniNormalized = $doubleSumDiffNorm / (2 * $N * $sumNorm);
                }
            }
            
            $fairnessIndex = (1 - $giniNormalized) * 100;
            return [
                'fairness' => round($fairnessIndex, 1),
                'sd' => round($standardDeviation, 1)
            ];
        };

        $currentFairShare = $calcFairness($conn, $dateCondition);
        $prevFairShare = $calcFairness($conn, $prevDateCondition);
        
        $fairShareEquity = $currentFairShare['fairness'] . '%';
        $fairShareSD = $currentFairShare['sd'];
        
        $fairShareEquityChangeVal = $currentFairShare['fairness'] - $prevFairShare['fairness'];
        $fairShareEquityChange = ($fairShareEquityChangeVal >= 0 ? '+' : '') . number_format($fairShareEquityChangeVal, 1) . '%';

        // Query hourly/daily chart data
        $chartMode = $_GET['chart_mode'] ?? '';
        $chartMetric = $_GET['chart_metric'] ?? 'lead';
        $chartData = [];

        if ($chartMetric === 'zalo' || $chartMetric === 'email') {
            $type = $chartMetric;
            $dateConditionSent = str_replace('received_at', 'sent_at', $dateCondition);
            if ($chartMode === 'heatmap') {
                $heatmapSql = "SELECT WEEKDAY(sent_at) as wday, HOUR(sent_at) as h, COUNT(*) as vol 
                               FROM communication_logs 
                               WHERE type = '$type' AND status = 'sent' AND $dateConditionSent
                               GROUP BY WEEKDAY(sent_at), HOUR(sent_at) 
                               ORDER BY wday ASC, h ASC";
                $res = $conn->query($heatmapSql);
                if ($res) {
                    while ($row = $res->fetch_assoc()) {
                        $chartData[] = [
                            'wday' => (int) $row['wday'],
                            'hour' => (int) $row['h'],
                            'volume' => (int) $row['vol']
                        ];
                    }
                }
            } else {
                $useHourly = ($chartMode === 'hour') || ($chartMode !== 'day' && ($date === 'Hôm nay' || $date === 'Hôm qua'));
                if ($useHourly) {
                    $hourlySql = "SELECT HOUR(sent_at) as h, COUNT(*) as vol 
                                  FROM communication_logs 
                                  WHERE type = '$type' AND status = 'sent' AND $dateConditionSent
                                  GROUP BY HOUR(sent_at) 
                                  ORDER BY h ASC";
                    $res = $conn->query($hourlySql);
                    $hourlyMap = [];
                    if ($res) {
                        while ($row = $res->fetch_assoc()) {
                            $hourlyMap[(int) $row['h']] = (int) $row['vol'];
                        }
                    }
                    for ($i = 0; $i <= 23; $i++) {
                        $vol = $hourlyMap[$i] ?? 0;
                        $chartData[] = ['time' => str_pad($i, 2, '0', STR_PAD_LEFT) . 'h', 'volume' => $vol];
                    }
                } else {
                    $dailySql = "SELECT DATE(sent_at) as d, COUNT(*) as vol 
                                 FROM communication_logs 
                                 WHERE type = '$type' AND status = 'sent' AND $dateConditionSent
                                 GROUP BY DATE(sent_at) 
                                 ORDER BY d ASC";
                    $res = $conn->query($dailySql);
                    if ($res) {
                        while ($row = $res->fetch_assoc()) {
                            $chartData[] = ['time' => date('d/m', strtotime($row['d'])), 'volume' => (int) $row['vol']];
                        }
                    }
                }
            }
        } else if ($chartMetric === 'token') {
            $timeCol = ($dbVer >= 140) ? "COALESCE(ai_screening_started_at, created_at)" : "created_at";
            if ($chartMode === 'heatmap') {
                $heatmapSql = "SELECT WEEKDAY($timeCol) as wday, HOUR($timeCol) as h, SUM(ai_total_tokens) as vol 
                               FROM leads 
                               WHERE $dateConditionAI
                               GROUP BY WEEKDAY($timeCol), HOUR($timeCol) 
                               ORDER BY wday ASC, h ASC";
                $res = $conn->query($heatmapSql);
                if ($res) {
                    while ($row = $res->fetch_assoc()) {
                        $chartData[] = [
                            'wday' => (int) $row['wday'],
                            'hour' => (int) $row['h'],
                            'volume' => (int) $row['vol']
                        ];
                    }
                }
            } else {
                $useHourly = ($chartMode === 'hour') || ($chartMode !== 'day' && ($date === 'Hôm nay' || $date === 'Hôm qua'));
                if ($useHourly) {
                    $hourlySql = "SELECT HOUR($timeCol) as h, SUM(ai_total_tokens) as vol 
                                  FROM leads 
                                  WHERE $dateConditionAI
                                  GROUP BY HOUR($timeCol) 
                                  ORDER BY h ASC";
                    $res = $conn->query($hourlySql);
                    $hourlyMap = [];
                    if ($res) {
                        while ($row = $res->fetch_assoc()) {
                            $hourlyMap[(int) $row['h']] = (int) $row['vol'];
                        }
                    }
                    for ($i = 0; $i <= 23; $i++) {
                        $vol = $hourlyMap[$i] ?? 0;
                        $chartData[] = ['time' => str_pad($i, 2, '0', STR_PAD_LEFT) . 'h', 'volume' => $vol];
                    }
                } else {
                    $dailySql = "SELECT DATE($timeCol) as d, SUM(ai_total_tokens) as vol 
                                 FROM leads 
                                 WHERE $dateConditionAI
                                 GROUP BY DATE($timeCol) 
                                 ORDER BY d ASC";
                    $res = $conn->query($dailySql);
                    if ($res) {
                        while ($row = $res->fetch_assoc()) {
                            $chartData[] = ['time' => date('d/m', strtotime($row['d'])), 'volume' => (int) $row['vol']];
                        }
                    }
                }
            }
        } else {
            if ($chartMode === 'heatmap') {
                $heatmapSql = "SELECT WEEKDAY(dl.received_at) as wday, HOUR(dl.received_at) as h, COUNT(*) as vol 
                               FROM distribution_logs dl 
                               INNER JOIN (
                                   SELECT lead_id, MAX(id) as max_id 
                                   FROM distribution_logs 
                                   WHERE status != 'silent' AND $dateCondition
                                   GROUP BY lead_id
                               ) dl_max ON dl.id = dl_max.max_id
                               WHERE $dateConditionDl 
                               GROUP BY WEEKDAY(dl.received_at), HOUR(dl.received_at) 
                               ORDER BY wday ASC, h ASC";
                $res = $conn->query($heatmapSql);
                if ($res) {
                    while ($row = $res->fetch_assoc()) {
                        $chartData[] = [
                            'wday' => (int) $row['wday'],
                            'hour' => (int) $row['h'],
                            'volume' => (int) $row['vol']
                        ];
                    }
                }
            } else {
                $useHourly = ($chartMode === 'hour') || ($chartMode !== 'day' && ($date === 'Hôm nay' || $date === 'Hôm qua'));
                if ($useHourly) {
                    $hourlySql = "SELECT HOUR(dl.received_at) as h, COUNT(*) as vol 
                                  FROM distribution_logs dl 
                                  INNER JOIN (
                                      SELECT lead_id, MAX(id) as max_id 
                                      FROM distribution_logs 
                                      WHERE status != 'silent' AND $dateCondition
                                      GROUP BY lead_id
                                  ) dl_max ON dl.id = dl_max.max_id
                                  WHERE $dateConditionDl 
                                  GROUP BY HOUR(dl.received_at) 
                                  ORDER BY h ASC";
                    $res = $conn->query($hourlySql);
                    $hourlyMap = [];
                    if ($res) {
                        while ($row = $res->fetch_assoc()) {
                            $hourlyMap[(int) $row['h']] = (int) $row['vol'];
                        }
                    }
                    for ($i = 0; $i <= 23; $i++) {
                        $vol = $hourlyMap[$i] ?? 0;
                        $chartData[] = ['time' => str_pad($i, 2, '0', STR_PAD_LEFT) . 'h', 'volume' => $vol];
                    }
                } else {
                    // For daily
                    $dailySql = "SELECT DATE(dl.received_at) as d, COUNT(*) as vol 
                                 FROM distribution_logs dl 
                                 INNER JOIN (
                                     SELECT lead_id, MAX(id) as max_id 
                                     FROM distribution_logs 
                                     WHERE status != 'silent' AND $dateCondition
                                     GROUP BY lead_id
                                 ) dl_max ON dl.id = dl_max.max_id
                                 WHERE $dateConditionDl 
                                 GROUP BY DATE(dl.received_at) 
                                 ORDER BY d ASC";
                    $res = $conn->query($dailySql);
                    if ($res) {
                        while ($row = $res->fetch_assoc()) {
                            $chartData[] = ['time' => date('d/m', strtotime($row['d'])), 'volume' => (int) $row['vol']];
                        }
                    }
                }
            }
        }

        // Query Top Consultants
        $topConsultantsSql = "SELECT c.id, c.name, c.email, c.avatar, c.status as c_status, c.vacation_mode as c_vacation_mode, dl.status as dl_status, COUNT(dl.id) as cnt 
                              FROM distribution_logs dl 
                              INNER JOIN (
                                  SELECT lead_id, MAX(id) as max_id 
                                  FROM distribution_logs 
                                  WHERE status != 'silent' AND $dateCondition
                                  GROUP BY lead_id
                              ) dl_max ON dl.id = dl_max.max_id
                              JOIN consultants c ON dl.assigned_to = c.id 
                              WHERE $dateConditionDl AND dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'error', 'reminder') 
                              GROUP BY c.id, c.status, c.vacation_mode, dl.status";
        $topConsultantsRes = $conn->query($topConsultantsSql);
        $consultantStats = [];
        if ($topConsultantsRes) {
            while ($row = $topConsultantsRes->fetch_assoc()) {
                $cId = (int) $row['id'];
                if (!isset($consultantStats[$cId])) {
                    $consultantStats[$cId] = [
                        'id' => $cId,
                        'name' => $row['name'],
                        'email' => $row['email'],
                        'avatar' => $row['avatar'],
                        'status' => $row['c_status'],
                        'vacation_mode' => (int) $row['c_vacation_mode'],
                        'assigned' => 0,
                        'compensation' => 0,
                        'rule_6_month' => 0,
                        'pending_work_hours' => 0,
                        'error' => 0,
                        'reminder' => 0
                    ];
                }
                $dl_status = $row['dl_status'];
                if (isset($consultantStats[$cId][$dl_status])) {
                    $consultantStats[$cId][$dl_status] = (int) $row['cnt'];
                }
            }
        }

        $topConsultantsList = [];
        foreach ($consultantStats as $cId => $cStats) {
            $data_count = $cStats['assigned'] + $cStats['compensation'] + $cStats['rule_6_month'] + $cStats['pending_work_hours'] + $cStats['reminder'] + max(0, $cStats['error'] - $cStats['compensation']);
            $topConsultantsList[] = [
                'id' => $cStats['id'],
                'name' => $cStats['name'],
                'email' => $cStats['email'],
                'avatar' => $cStats['avatar'],
                'status' => $cStats['status'],
                'vacation_mode' => $cStats['vacation_mode'],
                'data' => $data_count
            ];
        }

        // Sort descending by data
        usort($topConsultantsList, function ($a, $b) {
            return $b['data'] <=> $a['data'];
        });

        $topConsultants = [];
        $totalAssignedForTop = max(1, (int) $statsRes['distributed']);
        $colors = ['#7c3aed', '#3b82f6', '#f59e0b', '#10b981'];
        $i = 0;
        foreach ($topConsultantsList as $row) {
            $percent = round(($row['data'] / $totalAssignedForTop) * 100, 1);
            $topConsultants[] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'email' => $row['email'],
                'avatar' => $row['avatar'],
                'status' => $row['status'],
                'vacation_mode' => $row['vacation_mode'],
                'data' => (int) $row['data'],
                'percent' => $percent,
                'color' => $colors[$i % 4]
            ];
            $i++;
        }

        // Query Round Ratio
        $roundRatioSql = "SELECT dr.id, dr.round_name, dl.status, COUNT(dl.id) as cnt 
                          FROM distribution_logs dl 
                          JOIN distribution_rounds dr ON dl.round_id = dr.id 
                          WHERE $dateCondition AND dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'error') 
                          GROUP BY dr.id, dl.status";
        $roundRatioRes = $conn->query($roundRatioSql);
        $roundStats = [];
        if ($roundRatioRes) {
            while ($row = $roundRatioRes->fetch_assoc()) {
                $rId = (int) $row['id'];
                if (!isset($roundStats[$rId])) {
                    $roundStats[$rId] = [
                        'round_name' => $row['round_name'],
                        'assigned' => 0,
                        'compensation' => 0,
                        'rule_6_month' => 0,
                        'pending_work_hours' => 0,
                        'error' => 0
                    ];
                }
                $status = $row['status'];
                if (isset($roundStats[$rId][$status])) {
                    $roundStats[$rId][$status] = (int) $row['cnt'];
                }
            }
        }

        $roundRatioList = [];
        foreach ($roundStats as $rId => $rStats) {
            $count = $rStats['assigned'] + $rStats['compensation'] + $rStats['rule_6_month'] + $rStats['pending_work_hours'] + max(0, $rStats['error'] - $rStats['compensation']);
            $roundRatioList[] = [
                'round' => $rStats['round_name'],
                'count' => $count
            ];
        }

        // Sort descending by count
        usort($roundRatioList, function ($a, $b) {
            return $b['count'] <=> $a['count'];
        });

        $roundRatio = [];
        $totalDistributed = max(1, (int) $statsRes['distributed']);
        $roundColors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
        $j = 0;
        foreach ($roundRatioList as $row) {
            $percent = round(($row['count'] / $totalDistributed) * 100, 1);
            $roundRatio[] = [
                'round' => $row['round'],
                'count' => (int) $row['count'],
                'percent' => $percent,
                'color' => $roundColors[$j % 5]
            ];
            $j++;
        }
        // Query Source Ratio (fallback to l.source if sc.sheet_name is null)
        $sourceSql = "SELECT 
                        CASE 
                            WHEN sc.id IS NOT NULL THEN sc.sheet_name
                            ELSE 'Nhập tay'
                        END as source, COUNT(dl.id) as count 
                      FROM distribution_logs dl 
                      JOIN leads l ON dl.lead_id = l.id
                      LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
                      WHERE $dateCondition AND dl.status != 'silent'
                      GROUP BY 
                        CASE 
                            WHEN sc.id IS NOT NULL THEN sc.sheet_name
                            ELSE 'Nhập tay'
                        END
                      ORDER BY count DESC";
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

        // Query true Lead Source Ratio (Optimized: No JOIN on sheet_connections needed)
        $leadSourceSql = "SELECT COALESCE(NULLIF(TRIM(l.source), ''), 'Không xác định') as source, COUNT(dl.id) as count 
                          FROM distribution_logs dl 
                          JOIN leads l ON dl.lead_id = l.id
                          WHERE $dateCondition AND dl.status != 'silent'
                          GROUP BY COALESCE(NULLIF(TRIM(l.source), ''), 'Không xác định') ORDER BY count DESC";
        $leadSourceResRaw = $conn->query($leadSourceSql);
        $leadSourceStats = [];
        if ($leadSourceResRaw) {
            $colors = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
            $i = 0;
            while ($row = $leadSourceResRaw->fetch_assoc()) {
                $leadSourceStats[] = [
                    'name' => $row['source'] ?: 'Không xác định',
                    'value' => (int) $row['count'],
                    'color' => $colors[$i % count($colors)]
                ];
                $i++;
            }
        }

        // Query Error Stats by Consultant (Approved tickets)
        $dateConditionCreated = str_replace('received_at', 'dr.created_at', $dateCondition);
        $errorSql = "SELECT c.name, COUNT(dr.id) as count 
                     FROM data_reports dr 
                     JOIN consultants c ON dr.consultant_id = c.id
                     WHERE dr.status IN ('approved', 'approved_no_comp') AND $dateConditionCreated
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

        // Query if AI Pre-screener is enabled
        $aiEnabled = 0;
        $aiEnabledRes = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'ai_screener_enabled'");
        if ($aiEnabledRes && $row = $aiEnabledRes->fetch_assoc()) {
            $aiEnabled = (int) $row['setting_value'];
        }

        // Query communication stats (Zalo/Email/Tokens) for dashboard modal
        $dateConditionSent = str_replace('received_at', 'sent_at', $dateCondition);
        
        $totalZaloSent = 0;
        $zaloSentRes = $conn->query("SELECT COUNT(*) as cnt FROM communication_logs WHERE type = 'zalo' AND status = 'sent' AND $dateConditionSent");
        if ($zaloSentRes && $row = $zaloSentRes->fetch_assoc()) {
            $totalZaloSent = (int)$row['cnt'];
        }

        $totalEmailsSent = 0;
        $emailsSentRes = $conn->query("SELECT COUNT(*) as cnt FROM communication_logs WHERE type = 'email' AND status = 'sent' AND $dateConditionSent");
        if ($emailsSentRes && $row = $emailsSentRes->fetch_assoc()) {
            $totalEmailsSent = (int)$row['cnt'];
        }

        $totalTokensUsed = 0;
        $totalPromptTokensUsed = 0;
        $totalCompletionTokensUsed = 0;
        if ($dbVer >= 140) {
            $cond1 = str_replace('received_at', 'ai_screening_started_at', $dateCondition);
            $cond2 = str_replace('received_at', 'created_at', $dateCondition);
            $dateConditionAI = "(($cond1) OR (ai_screening_started_at IS NULL AND $cond2))";
        } else {
            $dateConditionAI = str_replace('received_at', 'created_at', $dateCondition);
        }
        $tokensRes = $conn->query("SELECT SUM(ai_total_tokens) as cnt, SUM(ai_prompt_tokens) as prompt_cnt, SUM(ai_completion_tokens) as completion_cnt FROM leads WHERE $dateConditionAI");
        if ($tokensRes && $row = $tokensRes->fetch_assoc()) {
            $totalTokensUsed = (int)$row['cnt'];
            $totalPromptTokensUsed = (int)$row['prompt_cnt'];
            $totalCompletionTokensUsed = (int)$row['completion_cnt'];
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'db_needs_migration' => $GLOBALS['db_needs_migration'] ?? false,
                'total_zalo_sent' => $totalZaloSent,
                'total_emails_sent' => $totalEmailsSent,
                'total_tokens_used' => $totalTokensUsed,
                'total_prompt_tokens_used' => $totalPromptTokensUsed,
                'total_completion_tokens_used' => $totalCompletionTokensUsed,
                'total_today' => (int) $statsRes['total'],
                'distributed_today' => (int) $statsRes['distributed'],
                'distributed_assigned' => (int) $assigned_total,
                'distributed_compensation' => (int) $compensation_total,
                'duplicates' => (int) $statsRes['duplicates'],
                'errors' => (int) $statsRes['errors'],
                'ticket_errors' => (int) $ticketErrors,
                'ticket_count' => $todayTickets,
                'blacklists' => (int) $blacklistCnt,
                'under_standard' => (int) $underStandard,
                'ai_passed_count' => $aiPassedCount,
                'ai_failed_count' => $aiFailedCount,
                'ai_screener_enabled' => $aiEnabled,
                'accepted_today' => $acceptedCount,
                'out_of_hours_ratio' => $outOfHoursRatio,
                'out_of_hours_change' => $outOfHoursChange,
                'pending_work_hours_count' => $outOfHoursCount,
                'fair_share_equity' => $fairShareEquity,
                'fair_share_equity_change' => $fairShareEquityChange,
                'fair_share_sd' => $fairShareSD,
                'total_change' => $calcChange($statsRes['total'], $prevStatsRes['total']),
                'distributed_change' => $calcChange($statsRes['distributed'], $prevStatsRes['distributed']),
                'duplicates_change' => $calcChange($statsRes['duplicates'], $prevStatsRes['duplicates']),
                'errors_change' => $calcChange($statsRes['errors'], $prevStatsRes['errors']),
                'chartData' => $chartData,
                'topConsultants' => $topConsultants,
                'roundRatio' => $roundRatio,
                'sourceStats' => $sourceStats,
                'leadSourceStats' => $leadSourceStats,
                'errorStats' => $errorStats
            ]
        ]);
        break;

    case 'get_fair_share_stats':
        $date = $_GET['date'] ?? 'Tuần này';
        $roundId = isset($_GET['round_id']) && $_GET['round_id'] !== '' ? (int) $_GET['round_id'] : 0;

        // Date conditions
        $dateCondition = "received_at >= CURDATE() AND received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        if ($date === 'Hôm nay') {
            $dateCondition = "received_at >= CURDATE() AND received_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
        } else if ($date === 'Hôm qua') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND received_at < CURDATE()";
        } else if ($date === 'Tuần này') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND received_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === 'Tuần trước') {
            $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND received_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
        } else if ($date === 'Tuần trước nữa') {
            $dateCondition = "received_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 14 DAY) AND received_at < DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)";
        } else if ($date === '7 ngày qua') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } else if ($date === '30 ngày qua') {
            $dateCondition = "received_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        } else if ($date === 'Tháng này') {
            $dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
        } else if ($date === 'Tháng trước') {
            $dateCondition = "received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
            $start = $conn->real_escape_string($matches[1]);
            $end = $conn->real_escape_string($matches[2]);
            $dateCondition = "received_at >= '$start 00:00:00' AND received_at <= '$end 23:59:59'";
        }

        $roundCondition = "";
        if ($roundId > 0) {
            $roundCondition = " AND round_id = $roundId";
        }

        // Fetch consultants matching the round or all active
        $consultants = [];
        if ($roundId > 0) {
            $sql = "SELECT c.id, c.name, c.avatar, COALESCE(rc.receive_ratio, 1) as receive_ratio, rc.round_id, r.round_name,
                           COALESCE(rc.compensation_count, 0) as pending_compensation,
                           COALESCE(rc.skip_count, 0) as skip_count,
                           COALESCE(rc.current_turn_remaining, 0) as current_turn_remaining
                    FROM consultants c
                    JOIN round_consultants rc ON c.id = rc.consultant_id
                    JOIN distribution_rounds r ON rc.round_id = r.id
                    WHERE rc.round_id = $roundId AND c.status = 'active'
                    ORDER BY c.name ASC";
        } else {
            $sql = "SELECT c.id, c.name, c.avatar, 1 as receive_ratio, 0 as round_id, 'Tất cả các Vòng' as round_name,
                           (SELECT COALESCE(SUM(rc2.compensation_count), 0) FROM round_consultants rc2 WHERE rc2.consultant_id = c.id) as pending_compensation,
                           0 as skip_count,
                           0 as current_turn_remaining
                    FROM consultants c
                    WHERE c.status = 'active'
                    ORDER BY c.name ASC";
        }
        $res = $conn->query($sql);
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $consultants[(int) $row['id']] = [
                    'id' => (int) $row['id'],
                    'name' => $row['name'],
                    'avatar' => $row['avatar'],
                    'receive_ratio' => (int) $row['receive_ratio'],
                    'round_id' => (int) $row['round_id'],
                    'round_name' => $row['round_name'],
                    'assigned_count' => 0,
                    'ticket_count' => 0,
                    'total_ticket_count' => 0,
                    'duplicate_count' => 0,
                    'compensation_count' => 0,
                    'pending_compensation' => (int) ($row['pending_compensation'] ?? 0),
                    'skip_count' => (int) ($row['skip_count'] ?? 0),
                    'current_turn_remaining' => (int) ($row['current_turn_remaining'] ?? 0),
                    'sources' => []
                ];
            }
        }

        // Query distinct sources active in this period to build charts easily
        $sources = [];
        $sourcesSql = "SELECT DISTINCT COALESCE(NULLIF(TRIM(l.source), ''), 'Không xác định') as source 
                       FROM distribution_logs dl 
                       JOIN leads l ON dl.lead_id = l.id
                       WHERE $dateCondition $roundCondition AND dl.status != 'silent'";
        $sourcesRes = $conn->query($sourcesSql);
        if ($sourcesRes) {
            while ($row = $sourcesRes->fetch_assoc()) {
                if ($row['source']) {
                    $sources[] = $row['source'];
                }
            }
        }
        if (empty($sources)) {
            $sources = ['FB Ads', 'Google Ads', 'TikTok Ads', 'Google Sheet'];
        }

        // Query lead assignment counts grouped by status (adjust pending compensation to be counted as compensation)
        $leadCountsSql = "SELECT assigned_to, 
                                 CASE 
                                   WHEN status = 'pending_work_hours' AND (message LIKE '%đền bù%' OR message LIKE '%compensation%' OR message LIKE '%Bù lượt%') THEN 'compensation'
                                   ELSE status 
                                 END as adjusted_status, 
                                 COUNT(*) as cnt 
                          FROM distribution_logs 
                          WHERE $dateCondition $roundCondition 
                            AND status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours') 
                          GROUP BY assigned_to, adjusted_status";
        $countsRes = $conn->query($leadCountsSql);
        $consultantStatusCounts = [];
        if ($countsRes) {
            while ($row = $countsRes->fetch_assoc()) {
                $cId = (int) $row['assigned_to'];
                $status = $row['adjusted_status'];
                $cnt = (int) $row['cnt'];
                if (!isset($consultantStatusCounts[$cId])) {
                    $consultantStatusCounts[$cId] = [
                        'assigned' => 0,
                        'compensation' => 0,
                        'rule_6_month' => 0,
                        'pending_work_hours' => 0,
                        'error' => 0
                    ];
                }
                if (array_key_exists($status, $consultantStatusCounts[$cId])) {
                    $consultantStatusCounts[$cId][$status] = $cnt;
                }
            }
        }
        foreach ($consultants as $cId => &$c) {
            if (isset($consultantStatusCounts[$cId])) {
                $sc = $consultantStatusCounts[$cId];
                $c['assigned_count'] = $sc['assigned'] + $sc['compensation'] + $sc['rule_6_month'] + $sc['pending_work_hours'] + max(0, $sc['error'] - $sc['compensation']);
                $c['compensation_count'] = $sc['compensation'];
            }
        }
        unset($c);

        // Query source breakdown per consultant grouped by status (adjust pending compensation to be counted as compensation)
        $sourceCountsSql = "SELECT dl.assigned_to, COALESCE(NULLIF(TRIM(l.source), ''), 'Không xác định') as source, 
                                   CASE 
                                     WHEN dl.status = 'pending_work_hours' AND (dl.message LIKE '%đền bù%' OR dl.message LIKE '%compensation%' OR dl.message LIKE '%Bù lượt%') THEN 'compensation'
                                     ELSE dl.status 
                                   END as adjusted_status, 
                                   COUNT(*) as cnt 
                            FROM distribution_logs dl
                            JOIN leads l ON dl.lead_id = l.id
                            WHERE $dateCondition $roundCondition 
                              AND dl.status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours')
                            GROUP BY dl.assigned_to, COALESCE(NULLIF(TRIM(l.source), ''), 'Không xác định'), adjusted_status";
        $srcRes = $conn->query($sourceCountsSql);
        $consultantSourceStatusCounts = [];
        if ($srcRes) {
            while ($row = $srcRes->fetch_assoc()) {
                $cId = (int) $row['assigned_to'];
                $sourceName = $row['source'] ?: 'Không xác định';
                $status = $row['adjusted_status'];
                $cnt = (int) $row['cnt'];

                if (!isset($consultantSourceStatusCounts[$cId])) {
                    $consultantSourceStatusCounts[$cId] = [];
                }
                if (!isset($consultantSourceStatusCounts[$cId][$sourceName])) {
                    $consultantSourceStatusCounts[$cId][$sourceName] = [
                        'assigned' => 0,
                        'compensation' => 0,
                        'rule_6_month' => 0,
                        'pending_work_hours' => 0,
                        'error' => 0
                    ];
                }
                if (array_key_exists($status, $consultantSourceStatusCounts[$cId][$sourceName])) {
                    $consultantSourceStatusCounts[$cId][$sourceName][$status] = $cnt;
                }
            }
        }
        foreach ($consultants as $cId => &$c) {
            if (isset($consultantSourceStatusCounts[$cId])) {
                $sCounts = $consultantSourceStatusCounts[$cId];

                // Calculate total errors and compensations for this consultant across all sources
                $totalErrors = 0;
                $totalCompensations = 0;
                foreach ($sCounts as $src => $sc) {
                    $totalErrors += $sc['error'];
                    $totalCompensations += $sc['compensation'];
                }

                $deduction = min($totalErrors, $totalCompensations);

                // Distribute deduction across sources
                $adjustedErrors = [];
                foreach ($sCounts as $src => $sc) {
                    $adjustedErrors[$src] = $sc['error'];
                }

                if ($deduction > 0) {
                    foreach ($sCounts as $src => $sc) {
                        if ($adjustedErrors[$src] > 0) {
                            $d = min($deduction, $adjustedErrors[$src]);
                            $adjustedErrors[$src] -= $d;
                            $deduction -= $d;
                            if ($deduction <= 0)
                                break;
                        }
                    }
                }

                // Now calculate the adjusted counts for each source
                foreach ($sCounts as $src => $sc) {
                    $c['sources'][$src] = $sc['assigned'] + $sc['compensation'] + $sc['rule_6_month'] + $sc['pending_work_hours'] + $adjustedErrors[$src];
                }
            }
        }
        unset($c);

        // Query ticket error counts (data_reports approved)
        $dateConditionCreated = str_replace('received_at', 'created_at', $dateCondition);
        $ticketCountsSql = "SELECT consultant_id, COUNT(*) as cnt 
                            FROM data_reports 
                            WHERE status IN ('approved', 'approved_no_comp') AND $dateConditionCreated" . ($roundId > 0 ? " AND round_id = $roundId" : "") . "
                            GROUP BY consultant_id";
        $tktRes = $conn->query($ticketCountsSql);
        if ($tktRes) {
            while ($row = $tktRes->fetch_assoc()) {
                $cId = (int) $row['consultant_id'];
                if (isset($consultants[$cId])) {
                    $consultants[$cId]['ticket_count'] = (int) $row['cnt'];
                }
            }
        }

        // Query total ticket counts (all data_reports)
        $totalTicketCountsSql = "SELECT consultant_id, COUNT(*) as cnt 
                                 FROM data_reports 
                                 WHERE $dateConditionCreated" . ($roundId > 0 ? " AND round_id = $roundId" : "") . "
                                 GROUP BY consultant_id";
        $ttRes = $conn->query($totalTicketCountsSql);
        if ($ttRes) {
            while ($row = $ttRes->fetch_assoc()) {
                $cId = (int) $row['consultant_id'];
                if (isset($consultants[$cId])) {
                    $consultants[$cId]['total_ticket_count'] = (int) $row['cnt'];
                }
            }
        }

        // Query duplicate counts per consultant
        $duplicateCountsSql = "SELECT assigned_to, COUNT(*) as cnt 
                               FROM distribution_logs 
                               WHERE $dateCondition $roundCondition AND status = 'duplicate'
                               GROUP BY assigned_to";
        $dupRes = $conn->query($duplicateCountsSql);
        if ($dupRes) {
            while ($row = $dupRes->fetch_assoc()) {
                $cId = (int) $row['assigned_to'];
                if (isset($consultants[$cId])) {
                    $consultants[$cId]['duplicate_count'] = (int) $row['cnt'];
                }
            }
        }

        // Perform statistical calculations
        $rawCounts = [];
        $normalizedCounts = [];
        $totalLeads = 0;
        foreach ($consultants as $c) {
            $rawCounts[] = $c['assigned_count'];
            $ratio = max(1, $c['receive_ratio']);
            $normalizedCounts[] = $c['assigned_count'] * $ratio;
            $totalLeads += $c['assigned_count'];
        }

        $N = count($consultants);
        $mean = 0;
        $standardDeviation = 0;
        $giniRaw = 0;
        $giniNormalized = 0;

        if ($N > 0) {
            // Mean
            $mean = $totalLeads / $N;

            // Raw Standard Deviation
            $sumSqDiff = 0;
            foreach ($rawCounts as $x) {
                $sumSqDiff += pow($x - $mean, 2);
            }
            $standardDeviation = sqrt($sumSqDiff / $N);

            // Raw Gini Coefficient
            $sumRaw = array_sum($rawCounts);
            if ($sumRaw > 0) {
                $doubleSumDiffRaw = 0;
                for ($i = 0; $i < $N; $i++) {
                    for ($j = 0; $j < $N; $j++) {
                        $doubleSumDiffRaw += abs($rawCounts[$i] - $rawCounts[$j]);
                    }
                }
                $giniRaw = $doubleSumDiffRaw / (2 * $N * $sumRaw);
            }

            // Normalized Gini Coefficient (Fairness Index uses this to account for ratio settings)
            $sumNorm = array_sum($normalizedCounts);
            if ($sumNorm > 0) {
                $doubleSumDiffNorm = 0;
                for ($i = 0; $i < $N; $i++) {
                    for ($j = 0; $j < $N; $j++) {
                        $doubleSumDiffNorm += abs($normalizedCounts[$i] - $normalizedCounts[$j]);
                    }
                }
                $giniNormalized = $doubleSumDiffNorm / (2 * $N * $sumNorm);
            }
        }

        // Convert Gini to Fairness Index
        $fairnessIndex = (1 - $giniNormalized) * 100;

        // Filter sources to only include those that actually have a count > 0 for at least one consultant in the final counts
        $activeSources = [];
        foreach ($consultants as $c) {
            if (isset($c['sources'])) {
                foreach ($c['sources'] as $src => $val) {
                    if ($val > 0) {
                        $activeSources[$src] = true;
                    }
                }
            }
        }
        $sources = array_keys($activeSources);

        $lastAssignedId = 0;
        if ($roundId > 0) {
            $rRes = $conn->query("SELECT last_assigned_consultant_id FROM distribution_rounds WHERE id = $roundId");
            if ($rRes && $rRow = $rRes->fetch_assoc()) {
                $lastAssignedId = (int) $rRow['last_assigned_consultant_id'];
            }
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'totalLeads' => $totalLeads,
                'totalConsultants' => $N,
                'mean' => round($mean, 2),
                'standardDeviation' => round($standardDeviation, 2),
                'giniRaw' => round($giniRaw, 4),
                'giniNormalized' => round($giniNormalized, 4),
                'fairnessIndex' => round($fairnessIndex, 1),
                'sources' => $sources,
                'lastAssignedId' => $lastAssignedId,
                'consultants' => array_values($consultants)
            ]
        ]);
        break;

    case 'get_consultant_compensation_details':
        $consultantId = isset($_GET['consultant_id']) ? (int) $_GET['consultant_id'] : 0;
        if ($decodedUser['role'] === 'sale') {
            $consultantId = $currentSaleConsultantId;
        }
        $date = $_GET['date'] ?? 'Tuần này';
        $roundId = isset($_GET['round_id']) && $_GET['round_id'] !== '' ? (int) $_GET['round_id'] : 0;

        if (!$consultantId) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID Tư vấn viên']);
            break;
        }

        // Fetch consultant info
        $cName = '';
        $cAvatar = '';
        $stmtC = $conn->prepare("SELECT name, avatar FROM consultants WHERE id = ?");
        if ($stmtC) {
            $stmtC->bind_param("i", $consultantId);
            $stmtC->execute();
            $resC = $stmtC->get_result();
            if ($rowC = $resC->fetch_assoc()) {
                $cName = $rowC['name'];
                $cAvatar = $rowC['avatar'];
            }
            $stmtC->close();
        }

        // 1. Re-use date parsing logic
        $startDate = null;
        $endDate = null;
        if ($date === 'Hôm nay') {
            $startDate = date('Y-m-d 00:00:00');
            $endDate = date('Y-m-d 23:59:59');
        } else if ($date === 'Hôm qua') {
            $startDate = date('Y-m-d 00:00:00', strtotime('-1 day'));
            $endDate = date('Y-m-d 23:59:59', strtotime('-1 day'));
        } else if ($date === 'Tuần này') {
            $weekday = date('N') - 1; // 0 for Monday, 6 for Sunday
            $startDate = date('Y-m-d 00:00:00', strtotime("-$weekday days"));
            $endDate = date('Y-m-d 23:59:59', strtotime('+' . (6 - $weekday) . ' days'));
        } else if ($date === 'Tuần trước') {
            $weekday = date('N') - 1;
            $startDate = date('Y-m-d 00:00:00', strtotime("-" . ($weekday + 7) . " days"));
            $endDate = date('Y-m-d 23:59:59', strtotime("-" . ($weekday + 1) . " days"));
        } else if ($date === 'Tuần trước nữa') {
            $weekday = date('N') - 1;
            $startDate = date('Y-m-d 00:00:00', strtotime("-" . ($weekday + 14) . " days"));
            $endDate = date('Y-m-d 23:59:59', strtotime("-" . ($weekday + 8) . " days"));
        } else if ($date === '7 ngày qua') {
            $startDate = date('Y-m-d 00:00:00', strtotime('-7 days'));
            $endDate = date('Y-m-d 23:59:59');
        } else if ($date === '30 ngày qua') {
            $startDate = date('Y-m-d 00:00:00', strtotime('-30 days'));
            $endDate = date('Y-m-d 23:59:59');
        } else if ($date === 'Tháng này') {
            $startDate = date('Y-m-01 00:00:00');
            $endDate = date('Y-m-t 23:59:59');
        } else if ($date === 'Tháng trước') {
            $startDate = date('Y-m-01 00:00:00', strtotime('-1 month'));
            $endDate = date('Y-m-t 23:59:59', strtotime('-1 month'));
        } else if (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/ui', $date, $matches)) {
            $startDate = $matches[1] . ' 00:00:00';
            $endDate = $matches[2] . ' 23:59:59';
        } else {
            $startDate = date('Y-m-01 00:00:00'); // default fallback: tháng này
            $endDate = date('Y-m-t 23:59:59');
        }

        // 2. Query total leads divided (total_assigned) in timeframe & round
        $roundCondition = "";
        if ($roundId > 0) {
            $roundCondition = " AND round_id = $roundId";
        }
        // Adjust pending compensation to be counted as compensation
        $assignedSql = "SELECT 
                          CASE 
                            WHEN status = 'pending_work_hours' AND (message LIKE '%đền bù%' OR message LIKE '%compensation%' OR message LIKE '%Bù lượt%') THEN 'compensation'
                            ELSE status 
                          END as adjusted_status, 
                          COUNT(*) as cnt 
                        FROM distribution_logs 
                        WHERE assigned_to = ? 
                          AND received_at BETWEEN ? AND ? 
                          $roundCondition
                          AND status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours')
                        GROUP BY adjusted_status";

        $totalAssigned = 0;
        $totalCompensationReceived = 0;
        $statusCounts = [
            'assigned' => 0,
            'compensation' => 0,
            'rule_6_month' => 0,
            'pending_work_hours' => 0,
            'error' => 0
        ];

        $stmtA = $conn->prepare($assignedSql);
        if ($stmtA) {
            $stmtA->bind_param("iss", $consultantId, $startDate, $endDate);
            $stmtA->execute();
            $resA = $stmtA->get_result();
            while ($row = $resA->fetch_assoc()) {
                $statusCounts[$row['adjusted_status']] = (int) $row['cnt'];
            }
            $stmtA->close();
        }

        $totalAssigned = $statusCounts['assigned'] + $statusCounts['compensation'] + $statusCounts['rule_6_month'] + $statusCounts['pending_work_hours'] + max(0, $statusCounts['error'] - $statusCounts['compensation']);
        $totalCompensationReceived = $statusCounts['compensation'];

        // 3. Query Ticket Approved Compensations (Approved reports resolved in range)
        $ticketCompCount = 0;
        $ticketDetails = [];
        $ticketSql = "SELECT dr.resolved_at, dr.resolved_by, dr.approval_reason, 
                             (SELECT a.avatar FROM accounts a WHERE a.name = dr.resolved_by LIMIT 1) as resolved_by_avatar
                      FROM data_reports dr
                      WHERE dr.consultant_id = ? 
                        AND dr.status IN ('approved', 'approved_no_comp') 
                        " . ($roundId > 0 ? " AND dr.round_id = $roundId" : "") . "
                      ORDER BY dr.resolved_at DESC";
        $stmtT = $conn->prepare($ticketSql);
        if ($stmtT) {
            $stmtT->bind_param("i", $consultantId);
            $stmtT->execute();
            $resT = $stmtT->get_result();
            while ($rowT = $resT->fetch_assoc()) {
                $ticketCompCount++;
                $ticketDetails[] = [
                    'admin_name' => $rowT['resolved_by'] ?: 'Hệ thống',
                    'admin_avatar' => $rowT['resolved_by_avatar'],
                    'created_at' => $rowT['resolved_at'],
                    'reason' => trim($rowT['approval_reason']) !== '' ? trim($rowT['approval_reason']) : 'Duyệt ticket lỗi'
                ];
            }
            $stmtT->close();
        }

        // 4. Query Blacklist Compensations from admin_logs
        $blacklistCompCount = 0;
        $blacklistDetails = [];
        $blacklistSql = "SELECT al.created_at, al.details, a.name as admin_name, a.avatar as admin_avatar
                         FROM admin_logs al 
                         LEFT JOIN accounts a ON al.account_id = a.id
                         JOIN distribution_logs dl ON (
                             (JSON_VALID(al.details) AND JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.log_id')) = dl.id)
                             OR (NOT JSON_VALID(al.details) AND (al.details LIKE CONCAT('%\"log_id\":', dl.id, '%') OR al.details LIKE CONCAT('%\"log_id\":\"', dl.id, '\"%')))
                         )
                         WHERE al.action = 'BLOCK_LEAD_BLACKLIST' 
                           AND dl.assigned_to = ? 
                           " . ($roundId > 0 ? " AND dl.round_id = $roundId" : "") . "
                           AND (
                               (JSON_VALID(al.details) AND (JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.compensate_sale')) = 'true' OR JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.compensate_sale')) = '1'))
                               OR al.details LIKE '%\"compensate_sale\":true%' 
                               OR al.details LIKE '%\"compensate_sale\":1%'
                           )
                         ORDER BY al.created_at DESC";
        $stmtB = $conn->prepare($blacklistSql);
        if ($stmtB) {
            $stmtB->bind_param("i", $consultantId);
            $stmtB->execute();
            $resB = $stmtB->get_result();
            while ($rowB = $resB->fetch_assoc()) {
                $blacklistCompCount++;
                $det = json_decode($rowB['details'], true);
                $reason = isset($det['reason']) && trim($det['reason']) !== '' ? trim($det['reason']) : 'Chặn blacklist';
                $blacklistDetails[] = [
                    'admin_name' => $rowB['admin_name'] ?: 'Hệ thống',
                    'admin_avatar' => $rowB['admin_avatar'] ?: '',
                    'created_at' => $rowB['created_at'],
                    'reason' => $reason
                ];
            }
            $stmtB->close();
        }

        // 5. Query Reassignment Compensations from admin_logs (REASSIGN_LEAD where old sale compensated)
        $reassignCompCount = 0;
        $reassignDetails = [];
        $reassignSql = "SELECT al.created_at, al.details, a.name as admin_name, a.avatar as admin_avatar
                        FROM admin_logs al 
                        LEFT JOIN accounts a ON al.account_id = a.id
                        JOIN distribution_logs dl ON (
                            (JSON_VALID(al.details) AND JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.log_id')) = dl.id)
                            OR (NOT JSON_VALID(al.details) AND (al.details LIKE CONCAT('%\"log_id\":', dl.id, '%') OR al.details LIKE CONCAT('%\"log_id\":\"', dl.id, '\"%')))
                        )
                        WHERE al.action = 'REASSIGN_LEAD' 
                          AND dl.assigned_to = ? 
                          " . ($roundId > 0 ? " AND dl.round_id = $roundId" : "") . "
                          AND (
                              (JSON_VALID(al.details) AND (JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.compensate_old_sale')) = 'true' OR JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.compensate_old_sale')) = '1'))
                              OR al.details LIKE '%\"compensate_old_sale\":true%' 
                              OR al.details LIKE '%\"compensate_old_sale\":1%'
                          )
                        ORDER BY al.created_at DESC";
        $stmtR = $conn->prepare($reassignSql);
        if ($stmtR) {
            $stmtR->bind_param("i", $consultantId);
            $stmtR->execute();
            $resR = $stmtR->get_result();
            while ($rowR = $resR->fetch_assoc()) {
                $reassignCompCount++;
                $det = json_decode($rowR['details'], true);
                $reason = isset($det['reason']) && trim($det['reason']) !== '' ? trim($det['reason']) : 'Thu hồi chuyển lead';
                $reassignDetails[] = [
                    'admin_name' => $rowR['admin_name'] ?: 'Hệ thống',
                    'admin_avatar' => $rowR['admin_avatar'] ?: '',
                    'created_at' => $rowR['created_at'],
                    'reason' => $reason
                ];
            }
            $stmtR->close();
        }

        // 6. Query Active Compensations (Manual by admin with reasons and avatars)
        $activeCompBreakdown = [];
        $activeCompTotal = 0;
        $activeSql = "SELECT acl.reason, acl.amount, acl.created_at, a.name as admin_name, a.avatar as admin_avatar
                      FROM active_compensation_logs acl
                      LEFT JOIN accounts a ON acl.admin_id = a.id
                      WHERE acl.consultant_id = ? 
                        " . ($roundId > 0 ? " AND acl.round_id = $roundId" : "") . "
                      ORDER BY acl.created_at DESC";
        $stmtAc = $conn->prepare($activeSql);
        if ($stmtAc) {
            $stmtAc->bind_param("i", $consultantId);
            $stmtAc->execute();
            $resAc = $stmtAc->get_result();
            while ($row = $resAc->fetch_assoc()) {
                $reason = trim($row['reason']) !== '' ? trim($row['reason']) : 'Bù chủ động';
                $amt = (int) $row['amount'];
                $activeCompTotal += $amt;
                $activeCompBreakdown[] = [
                    'reason' => $reason,
                    'count' => $amt,
                    'admin_name' => $row['admin_name'] ?: 'Hệ thống',
                    'admin_avatar' => $row['admin_avatar'] ?: '',
                    'created_at' => $row['created_at']
                ];
            }
            $stmtAc->close();
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'consultant_id' => $consultantId,
                'name' => $cName,
                'avatar' => $cAvatar,
                'total_assigned' => $totalAssigned,
                'total_compensation_received' => $totalCompensationReceived,
                'breakdown' => [
                    'ticket' => $ticketCompCount,
                    'ticket_details' => $ticketDetails,
                    'blacklist' => $blacklistCompCount,
                    'blacklist_details' => $blacklistDetails,
                    'reassign' => $reassignCompCount,
                    'reassign_details' => $reassignDetails,
                    'active_total' => $activeCompTotal,
                    'active_details' => $activeCompBreakdown
                ]
            ]
        ]);
        break;

    case 'reassign_lead':
        require_once __DIR__ . '/webhook_logic.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $log_id = (int) ($input['log_id'] ?? 0);
        $new_consultant_id = (int) ($input['new_consultant_id'] ?? 0);
        $compensate_old_sale = isset($input['compensate_old_sale']) ? (bool) $input['compensate_old_sale'] : false;

        if (!$log_id || !$new_consultant_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID Log hoặc ID TVV mới']);
            break;
        }

        // 1. Fetch lead details, old consultant details, and new consultant details
        $stmt = $conn->prepare("
            SELECT dl.lead_id, dl.round_id, dl.assigned_to as old_consultant_id, c_old.name as old_consultant_name, dl.status as log_status, l.name as lead_name, l.phone, l.email as lead_email, l.note, l.source, l.type, r.cc_emails, r.round_name
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
        $old_consultant_id = $log_data['old_consultant_id'] ? (int) $log_data['old_consultant_id'] : null;
        $old_consultant_name = $log_data['old_consultant_name'] ?? '';
        $cc_emails = $log_data['cc_emails'] ?? '';
        $lead_phone = $log_data['phone'] ?? '';
        $lead_email = $log_data['lead_email'] ?? '';
        $log_status = $log_data['log_status'] ?? '';
        $roundNameStr = $log_data['round_name'] ?? '';

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

                // Ghi log vào active_compensation_logs để thống kê đầy đủ
                $reasonText = "Bù 1 lượt do chuyển giao Lead \"" . ($log_data['lead_name'] ?: 'Khách hàng ẩn danh') . "\" sang cho TVV " . $new_cons_name;
                $logStmt = $conn->prepare("INSERT INTO active_compensation_logs (round_id, consultant_id, admin_id, amount, reason) VALUES (?, ?, ?, 1, ?)");
                $adminIdInt = (int) $decodedUser['id'];
                $logStmt->bind_param("iiis", $log_data['round_id'], $old_consultant_id, $adminIdInt, $reasonText);
                $logStmt->execute();
                $logStmt->close();
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
            // Trigger Live Two-Way Sync to Google Sheets
            triggerTwoWaySync($conn, $lead_id);
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

            // Notify old consultant of reassignment/compensation
            if ($old_consultant_id) {
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
                                if ($compensate_old_sale) {
                                    $zaloMsg = "🎁 [ THÔNG BÁO BÙ DATA ] 🎁\n"
                                        . "━━━━━━━━━━━━━━━━━━━━━\n"
                                        . "Chào $oldCName,\n\n"
                                        . "Data \"$lName\" của bạn đã được giao lại cho TVV $new_cons_name.\n"
                                        . "Hệ thống đã bù lại 1 lượt nhận data cho bạn tại vòng: $roundNameStr.\n\n"
                                        . "Trân trọng,\nHệ thống Quản lý Rich Land DATA\n"
                                        . "━━━━━━━━━━━━━━━━━━━━━";
                                } else {
                                    $zaloMsg = "🔄 [ THÔNG BÁO CHUYỂN GIAO DATA ] 🔄\n"
                                        . "━━━━━━━━━━━━━━━━━━━━━\n"
                                        . "Chào $oldCName,\n\n"
                                        . "Data \"$lName\" của bạn đã được chuyển giao cho TVV $new_cons_name.\n\n"
                                        . "Trân trọng,\nHệ thống Quản lý Rich Land DATA\n"
                                        . "━━━━━━━━━━━━━━━━━━━━━";
                                }
                                sendZaloMessage($botToken, $oldCZalo, $zaloMsg, false);
                            } catch (Exception $zEx) {
                                error_log("Error sending Zalo reassign message to old sale: " . $zEx->getMessage());
                            }
                        }

                        if (!empty($oldCEmail)) {
                            try {
                                if ($compensate_old_sale) {
                                    $emailSubj = "[Rich Land DATA] Thông báo đền bù Data - $lName";
                                    $emailBody = "<h3>Đền bù Data do chuyển giao lại</h3>
                                                  <p>Chào $oldCName,</p>
                                                  <p>Lead <strong>$lName</strong> của bạn đã được giao lại cho TVV <strong>$new_cons_name</strong>.</p>
                                                  <p>Hệ thống đã tự động cộng thêm 1 lượt đền bù cho bạn trong vòng phân bổ <strong>$roundNameStr</strong>.</p>";
                                } else {
                                    $emailSubj = "[Rich Land DATA] Thông báo chuyển giao Data - $lName";
                                    $emailBody = "<h3>Chuyển giao Data</h3>
                                                  <p>Chào $oldCName,</p>
                                                  <p>Lead <strong>$lName</strong> của bạn đã được chuyển giao cho TVV <strong>$new_cons_name</strong>.</p>";
                                }
                                sendEmailNotification($oldCEmail, $emailSubj, 'Thông báo chuyển giao', $emailBody, '');
                            } catch (Exception $eEx) {
                                error_log("Error sending email reassign message to old sale: " . $eEx->getMessage());
                            }
                        }
                    }
                } catch (Exception $oldSaleEx) {
                    error_log("Error processing reassign notification for old sale: " . $oldSaleEx->getMessage());
                }
            }

            // Fetch round name (fallback if roundNameStr is empty for some reason)
            $roundId = (int) ($log_data['round_id'] ?? 0);
            if (empty($roundNameStr) && $roundId) {
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
                    $timeline = getLeadHistoryTimeline($conn, $lead_id, true);
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
                            $log_data['lead_name'] ?: 'Khách hàng ẩn danh',
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
                            $log_data['lead_name'] ?: 'Khách hàng ẩn danh',
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

    case 'update_lead_fields':
        $input = json_decode(file_get_contents('php://input'), true);
        $lead_id = isset($input['lead_id']) ? (int) $input['lead_id'] : 0;
        $name = isset($input['name']) ? trim($input['name']) : '';
        $phone = isset($input['phone']) ? trim($input['phone']) : '';
        $email = isset($input['email']) ? trim($input['email']) : '';
        $source = isset($input['source']) ? trim($input['source']) : '';
        $type = isset($input['type']) ? trim($input['type']) : '';
        $note = isset($input['note']) ? trim($input['note']) : '';

        if (!$lead_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID khách hàng']);
            break;
        }

        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tên khách hàng không được để trống']);
            break;
        }

        // Fetch current values for logging
        $stmt = $conn->prepare("SELECT name, phone, email, source, type, note FROM leads WHERE id = ? LIMIT 1");
        if (!$stmt) {
            echo json_encode(['success' => false, 'message' => 'Lỗi kết nối CSDL']);
            break;
        }
        $stmt->bind_param("i", $lead_id);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy khách hàng']);
            $stmt->close();
            break;
        }
        $lead = $res->fetch_assoc();
        $stmt->close();

        // Update lead fields
        $updStmt = $conn->prepare("UPDATE leads SET name = ?, phone = ?, email = ?, source = ?, type = ?, note = ? WHERE id = ?");
        if (!$updStmt) {
            echo json_encode(['success' => false, 'message' => 'Lỗi cập nhật CSDL']);
            break;
        }
        $updStmt->bind_param("ssssssi", $name, $phone, $email, $source, $type, $note, $lead_id);
        if ($updStmt->execute()) {
            // Log admin action
            $adminAccountId = isset($decodedUser['id']) ? (int) $decodedUser['id'] : 0;
            logAdminAction($conn, $adminAccountId, 'UPDATE_LEAD_FIELDS', [
                'lead_id' => $lead_id,
                'lead_name' => $lead['name'],
                'old_name' => $lead['name'],
                'new_name' => $name,
                'old_phone' => $lead['phone'],
                'new_phone' => $phone,
                'old_email' => $lead['email'],
                'new_email' => $email,
                'old_source' => $lead['source'],
                'new_source' => $source,
                'old_type' => $lead['type'],
                'new_type' => $type,
                'old_note' => $lead['note'],
                'new_note' => $note
            ]);
            echo json_encode(['success' => true, 'message' => 'Cập nhật thông tin khách hàng thành công']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Lỗi lưu thông tin']);
        }
        $updStmt->close();
        break;

    case 'send_lead_reminder':
        $input = json_decode(file_get_contents('php://input'), true);
        $lead_id = isset($input['lead_id']) ? (int) $input['lead_id'] : 0;
        $send_zalo = isset($input['send_zalo']) ? (bool) $input['send_zalo'] : false;
        $send_email = isset($input['send_email']) ? (bool) $input['send_email'] : false;

        if (!$lead_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID khách hàng']);
            break;
        }

        if (!$send_zalo && !$send_email) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng chọn ít nhất một kênh để gửi nhắc nhở (Zalo hoặc Email)']);
            break;
        }

        // Fetch lead and assignee details
        $stmt = $conn->prepare("
            SELECT l.id as lead_id, l.name as lead_name, l.phone, l.email as lead_email, l.note, l.source, l.type, l.assigned_to as consultant_id,
                   c.name as consultant_name, c.email as consultant_email,
                   dl.id as log_id, dl.round_id, r.round_name, r.cc_emails
            FROM leads l
            LEFT JOIN consultants c ON l.assigned_to = c.id
            LEFT JOIN distribution_logs dl ON l.id = dl.lead_id AND dl.status = 'assigned'
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            WHERE l.id = ?
            ORDER BY dl.id DESC LIMIT 1
        ");
        if (!$stmt) {
            echo json_encode(['success' => false, 'message' => 'Lỗi kết nối CSDL']);
            break;
        }
        $stmt->bind_param("i", $lead_id);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy thông tin khách hàng']);
            $stmt->close();
            break;
        }
        $row = $res->fetch_assoc();
        $stmt->close();

        $consultant_id = (int)$row['consultant_id'];
        $consultant_name = $row['consultant_name'];
        $consultant_email = $row['consultant_email'];

        if (!$consultant_id) {
            echo json_encode(['success' => false, 'message' => 'Khách hàng này hiện chưa được bàn giao cho Tư vấn viên nào']);
            break;
        }

        require_once __DIR__ . '/webhook_logic.php';
        require_once __DIR__ . '/zalo_bot.php';
        require_once __DIR__ . '/mailer.php';

        $timeline = getLeadHistoryTimeline($conn, $lead_id, true);
        $roundNameStr = $row['round_name'] ?? '';

        $zaloSuccess = true;
        $emailSuccess = true;
        $channelsTried = [];

        if ($send_zalo) {
            $channelsTried[] = 'Zalo';
            try {
                $zaloResult = sendLeadReminderZaloMessageToSale(
                    $consultant_id,
                    $consultant_name,
                    $row['lead_name'] ?: 'Khách hàng ẩn danh',
                    $row['phone'] ?: '',
                    $row['note'] ?: '',
                    $row['source'] ?: '',
                    $roundNameStr,
                    $timeline,
                    $lead_id,
                    $row['lead_email'] ?: '',
                    $row['type'] ?: '',
                    true // send synchronously to check if it succeeded
                );
                if (!$zaloResult) {
                    $zaloSuccess = false;
                }
            } catch (Exception $zEx) {
                error_log("Error sending manual reminder Zalo to sale: " . $zEx->getMessage());
                $zaloSuccess = false;
            }
        }

        if ($send_email) {
            $channelsTried[] = 'Email';
            if (empty($consultant_email)) {
                $emailSuccess = false;
            } else {
                try {
                    // sendLeadReminderEmailToSale pushes to queue by default
                    sendLeadReminderEmailToSale(
                        $consultant_email,
                        $consultant_name,
                        $row['lead_name'] ?: 'Khách hàng ẩn danh',
                        $row['phone'] ?: '',
                        $row['note'] ?: '',
                        $row['source'] ?: '',
                        $row['cc_emails'] ?: '',
                        $roundNameStr,
                        $timeline,
                        $lead_id
                    );
                } catch (Exception $eEx) {
                    error_log("Error sending manual reminder Email to sale: " . $eEx->getMessage());
                    $emailSuccess = false;
                }
            }
        }

        // Log admin action
        $adminAccountId = isset($decodedUser['id']) ? (int) $decodedUser['id'] : 0;
        logAdminAction($conn, $adminAccountId, 'SEND_LEAD_REMINDER', [
            'lead_id' => $lead_id,
            'lead_name' => $row['lead_name'],
            'consultant_id' => $consultant_id,
            'consultant_name' => $consultant_name,
            'channels' => implode(', ', $channelsTried),
            'zalo_success' => $zaloSuccess,
            'email_success' => $emailSuccess
        ]);

        if ($send_zalo && !$zaloSuccess && $send_email && !$emailSuccess) {
            echo json_encode(['success' => false, 'message' => 'Gửi nhắc nhở thất bại trên cả 2 kênh Zalo và Email. Vui lòng kiểm tra lại cấu hình Zalo Bot/SMTP.']);
        } else if ($send_zalo && !$zaloSuccess) {
            echo json_encode(['success' => true, 'message' => 'Đã gửi Email thành công nhưng gửi Zalo thất bại (có thể do TVV chưa liên kết Zalo hoặc lỗi Bot)']);
        } else if ($send_email && !$emailSuccess) {
            echo json_encode(['success' => true, 'message' => 'Đã gửi Zalo thành công nhưng gửi Email thất bại (có thể do TVV chưa cấu hình Email)']);
        } else {
            echo json_encode(['success' => true, 'message' => 'Đã gửi nhắc nhở thành công cho Tư vấn viên ' . $consultant_name]);
        }
        break;

    case 'block_lead':
        $input = json_decode(file_get_contents('php://input'), true);
        $log_id = (int) ($input['log_id'] ?? 0);
        $compensate_sale = isset($input['compensate_sale']) ? (bool) $input['compensate_sale'] : false;
        $reason = trim($input['reason'] ?? '');

        if (!$log_id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID Log phân bổ']);
            break;
        }

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

        // 1. Fetch details of lead, consultant, and round
        $stmt = $conn->prepare("
            SELECT dl.lead_id, dl.round_id, dl.assigned_to as old_consultant_id, c_old.name as old_consultant_name, 
                   c_old.email as old_consultant_email, c_old.zalo_chat_id as old_consultant_zalo,
                   l.name as lead_name, l.phone as lead_phone, l.email as lead_email, l.note as lead_note, 
                   r.round_name, dl.status as dl_status
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
        $round_id = $log_data['round_id'] ? (int) $log_data['round_id'] : null;
        $old_consultant_id = $log_data['old_consultant_id'] ? (int) $log_data['old_consultant_id'] : null;
        $old_consultant_name = $log_data['old_consultant_name'] ?? '';
        $old_consultant_email = $log_data['old_consultant_email'] ?? '';
        $old_consultant_zalo = $log_data['old_consultant_zalo'] ?? '';
        $lead_phone = trim($log_data['lead_phone'] ?? '');
        $lead_email = trim($log_data['lead_email'] ?? '');
        $lead_name = $log_data['lead_name'] ?: 'Khách hàng ẩn danh';
        $round_name = $log_data['round_name'] ?? 'Không rõ';
        $dl_status = $log_data['dl_status'] ?? '';

        if (empty($lead_phone) && empty($lead_email)) {
            echo json_encode(['success' => false, 'message' => 'Lead không có Số điện thoại hoặc Email để chặn']);
            break;
        }

        $conn->begin_transaction();
        try {
            // Check if lead already has a Ticket (data_reports record with approved or pending status, or distribution log status is error/Ticket)
            $ticketExists = false;
            if ($dl_status === 'error') {
                $ticketExists = true;
            } else {
                $tStmt = $conn->prepare("SELECT id FROM data_reports WHERE lead_id = ? AND status IN ('approved', 'pending') LIMIT 1");
                if ($tStmt) {
                    $tStmt->bind_param("i", $lead_id);
                    $tStmt->execute();
                    $tRes = $tStmt->get_result();
                    if ($tRes && $tRes->num_rows > 0) {
                        $ticketExists = true;
                    }
                    $tStmt->close();
                }
            }

            if ($ticketExists) {
                $compensate_sale = false; // Do not compensate again if lead already has a Ticket status
            }

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
            $noteSuffix = "\n[Bị chặn bởi Admin " . $adminName . " lúc " . date('Y-m-d H:i:s') . ". Lý do: " . $reason . "]";
            if ($ticketExists) {
                $noteSuffix .= "\n[Hệ thống: Không cộng bù do Lead đã có trạng thái Ticket]";
            }
            $newNote = trim(($log_data['lead_note'] ?? '') . $noteSuffix);
            $updLead = $conn->prepare("UPDATE leads SET note = ?, status = 'blacklisted', ai_screener_status = 'failed' WHERE id = ?");
            $updLead->bind_param("si", $newNote, $lead_id);
            $updLead->execute();
            $updLead->close();

            // Update distribution log status to 'blacklisted'
            $updLog = $conn->prepare("UPDATE distribution_logs SET status = 'blacklisted' WHERE id = ?");
            $updLog->bind_param("i", $log_id);
            $updLog->execute();
            $updLog->close();

            // 4. Increment compensation count for the consultant in that round if requested
            if ($compensate_sale && $old_consultant_id && $round_id) {
                $updComp = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count + 1 WHERE round_id = ? AND consultant_id = ?");
                $updComp->bind_param("ii", $round_id, $old_consultant_id);
                $updComp->execute();
                $updComp->close();
            }

            // Ghi log hành động admin chặn data (blacklist) để báo cáo ngày thống kê được
            logAdminAction($conn, $adminAccountId, 'BLOCK_LEAD_BLACKLIST', [
                'log_id' => $log_id,
                'lead_id' => $lead_id,
                'lead_name' => $lead_name,
                'phone' => $lead_phone,
                'email' => $lead_email,
                'reason' => $reason,
                'compensate_sale' => $compensate_sale,
                'old_consultant_id' => $old_consultant_id,
                'old_consultant_name' => $old_consultant_name,
                'round_name' => $round_name
            ]);

            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => getSafeErrorMsg($e)]);
            break;
        }

        // 4. Send Notifications out of transaction
        try {
            require_once __DIR__ . '/mailer.php';
            require_once __DIR__ . '/zalo_bot.php';

            $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
            $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

            // Lấy danh sách ticket admins
            $adminEmails = getTicketNotifyAdmins($conn);

            // Gửi Zalo cho các Ticket Admins
            if (!empty($botToken) && !empty($adminEmails)) {
                $adminChatIds = [];
                foreach ($adminEmails as $adm) {
                    if (!empty($adm['zalo_chat_id'])) {
                        $adminChatIds[] = $adm['zalo_chat_id'];
                    }
                }
                if (!empty($adminChatIds)) {
                    try {
                        $zaloAdminMsg = "[ THÔNG BÁO CHẶN DATA - BLACKLIST ]\n\n"
                            . "Admin $adminName đã chặn khách hàng: $lead_name\n"
                            . "  • SĐT: " . (!empty($lead_phone) ? $lead_phone : "Không có") . "\n"
                            . "  • Email: " . (!empty($lead_email) ? $lead_email : "Không có") . "\n\n"
                            . "❖ CHI TIẾT CHẶN:\n"
                            . "  • Lý do chặn: $reason\n"
                            . "  • Vòng phân bổ: $round_name\n"
                            . "  • Sale phụ trách cũ: $old_consultant_name\n"
                            . "  • Đền bù cho Sale: " . ($compensate_sale ? "Có (Đã cộng 1 lượt bù)" : "Không");
                        sendZaloMessageToMultiple($botToken, $adminChatIds, $zaloAdminMsg, false);
                    } catch (Exception $zAdminEx) {
                        error_log("Error sending block lead Zalo to admins: " . $zAdminEx->getMessage());
                    }
                }
            }

            // Gửi thông báo cho Sale (nếu có bù)
            if ($compensate_sale && $old_consultant_id) {
                // Tạo số điện thoại masked cho Sale
                $maskedPhone = '';
                if (!empty($lead_phone)) {
                    $trimmed = trim($lead_phone);
                    if (strlen($trimmed) <= 3) {
                        $maskedPhone = substr($trimmed, 0, 2) . str_repeat('*', strlen($trimmed) - 2);
                    } else {
                        $maskedPhone = substr($trimmed, 0, 3) . '****' . substr($trimmed, -3);
                    }
                }

                // Tạo email masked cho Sale
                $maskedEmail = '';
                if (!empty($lead_email)) {
                    $parts = explode('@', $lead_email);
                    if (count($parts) === 2) {
                        $namePart = $parts[0];
                        $domainPart = $parts[1];
                        if (strlen($namePart) <= 3) {
                            $maskedEmail = substr($namePart, 0, 1) . '***@' . $domainPart;
                        } else {
                            $maskedEmail = substr($namePart, 0, 3) . '***' . substr($namePart, -1) . '@' . $domainPart;
                        }
                    } else {
                        $maskedEmail = $lead_email;
                    }
                }

                if (!empty($botToken) && !empty($old_consultant_zalo)) {
                    try {
                        $zaloMsg = "[ ĐỀN BÙ DATA - BLACKLIST ]\n\n"
                            . "Chào $old_consultant_name, Lead của bạn đã bị Admin " . $adminName . " lúc " . date('H:i:s d/m/Y') . " đưa vào Danh sách đen (Blacklist).\n\n"
                            . "❖ CHI TIẾT KHÁCH HÀNG:\n"
                            . "  • Tên KH: $lead_name\n"
                            . "  • SĐT: " . (!empty($maskedPhone) ? $maskedPhone : "Không có") . "\n"
                            . "  • Email: " . (!empty($maskedEmail) ? $maskedEmail : "Không có") . "\n\n"
                            . "Hệ thống đã tự động cộng đền bù cho bạn 1 lượt data ở vòng \"$round_name\".";
                        sendZaloMessage($botToken, $old_consultant_zalo, $zaloMsg, false);
                    } catch (Exception $zEx) {
                        error_log("Error sending block lead Zalo to sale: " . $zEx->getMessage());
                    }
                }

                if (!empty($old_consultant_email)) {
                    try {
                        // Gom CC cho admin email
                        $ccEmailsArr = [];
                        foreach ($adminEmails as $adm) {
                            if (!empty($adm['email']) && filter_var($adm['email'], FILTER_VALIDATE_EMAIL)) {
                                $ccEmailsArr[] = strtolower(trim($adm['email']));
                            }
                        }
                        $ccEmailsArr = array_unique($ccEmailsArr);
                        $saleEmail = strtolower(trim($old_consultant_email));
                        $ccEmailsArr = array_filter($ccEmailsArr, fn($e) => $e !== $saleEmail);
                        $ccString = implode(',', $ccEmailsArr);

                        $emailSubj = "[Rich Land DATA] Thông báo đền bù do chặn Lead - $lead_name";
                        $emailBody = "<h3>Đền bù Data do chặn Blacklist</h3>
                                      <p>Chào $old_consultant_name,</p>
                                      <p>Khách hàng của bạn đã bị Admin <strong>$adminName</strong> đưa vào Danh sách đen (Blacklist).</p>
                                      <p><strong>Chi tiết khách hàng:</strong></p>
                                      <ul>
                                        <li>Tên khách hàng: $lead_name</li>
                                        <li>Số điện thoại: " . (!empty($maskedPhone) ? $maskedPhone : "Không có") . " (Chỉ Admin xem được số đầy đủ)</li>
                                        <li>Email: " . (!empty($maskedEmail) ? $maskedEmail : "Không có") . "</li>
                                      </ul>
                                      <p><strong>Lý do:</strong> " . htmlspecialchars($reason) . "</p>
                                      <p>Hệ thống đã tự động cộng thêm 1 lượt đền bù cho bạn trong vòng phân bổ <strong>$round_name</strong>.</p>";
                        sendEmailNotification($old_consultant_email, $emailSubj, 'Thông báo đền bù Blacklist', $emailBody, $ccString);
                    } catch (Exception $eEx) {
                        error_log("Error sending block lead email to sale: " . $eEx->getMessage());
                    }
                }
            } else {
                // Nếu không bù, chỉ gửi email cho Admin để nắm thông tin
                if (!empty($adminEmails)) {
                    try {
                        $adminEmailsCopy = $adminEmails;
                        $firstAdmin = array_shift($adminEmailsCopy);
                        $ccList = array_map(fn($a) => $a['email'], $adminEmailsCopy);
                        $ccString = implode(',', array_filter($ccList));

                        $emailSubj = "[Rich Land DATA] Thông báo Chặn Lead (Không Bù) - $lead_name";
                        $emailBody = "<h3>Thông báo Chặn Lead - Blacklist</h3>
                                      <p>Kính gửi Ban quản trị,</p>
                                      <p>Admin <strong>$adminName</strong> đã chặn khách hàng và đưa vào danh sách đen (không đền bù cho Sale).</p>
                                      <p><strong>Chi tiết khách hàng:</strong></p>
                                      <ul>
                                        <li>Tên khách hàng: $lead_name</li>
                                        <li>Số điện thoại: " . (!empty($lead_phone) ? $lead_phone : "Không có") . "</li>
                                        <li>Email: " . (!empty($lead_email) ? $lead_email : "Không có") . "</li>
                                      </ul>
                                      <p><strong>Lý do chặn:</strong> " . htmlspecialchars($reason) . "</p>
                                      <p><strong>Vòng phân bổ:</strong> $round_name</p>
                                      <p><strong>Sale phụ trách cũ:</strong> $old_consultant_name</p>";
                        sendEmailNotification($firstAdmin['email'], $emailSubj, 'Thông báo Chặn Blacklist', $emailBody, $ccString);
                    } catch (Exception $eEx) {
                        error_log("Error sending block lead email to admins: " . $eEx->getMessage());
                    }
                }
            }
        } catch (Exception $notifyEx) {
            error_log("General notification error in block_lead: " . $notifyEx->getMessage());
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
        $connectionId = isset($input['connection_id']) ? ($input['connection_id'] === 'all' || $input['connection_id'] === '' ? null : (int) $input['connection_id']) : null;
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
                    $isSilent = (int) $cRow['is_silent'];
                    $syncSaleperson = (int) $cRow['sync_saleperson'];
                }
                $cStmt->close();
            }
        }

        // Check CRM duplicate
        $crmCheckResult = checkCRMInteraction($conn, $phone, $email);
        $dupCheckMonths = (int) get_system_setting($conn, 'duplicate_check_months');
        if ($dupCheckMonths <= 0) {
            $dupCheckMonths = 6;
        }

        if ($isSilent === 1) {
            if ($crmCheckResult['isDuplicate'] && !empty($crmCheckResult['assignedTo'])) {
                $assignedTo = $crmCheckResult['assignedTo'];
                $stmtC = $conn->prepare("SELECT name, email, avatar FROM consultants WHERE id = ?");
                $stmtC->bind_param("i", $assignedTo);
                $stmtC->execute();
                $cRow = $stmtC->get_result()->fetch_assoc();
                $stmtC->close();
                $consultantName = $cRow ? $cRow['name'] : 'Không rõ';
                $consultantEmail = $cRow ? $cRow['email'] : '';
                $consultantAvatar = $cRow ? $cRow['avatar'] : null;

                echo json_encode([
                    'success' => true,
                    'is_duplicate' => true,
                    'is_silent' => true,
                    'consultant' => [
                        'consultant_id' => $assignedTo,
                        'name' => $consultantName,
                        'email' => $consultantEmail,
                        'avatar' => $consultantAvatar,
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
            $stmtC = $conn->prepare("SELECT name, email, avatar FROM consultants WHERE id = ?");
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
                        'avatar' => $cRow['avatar'] ?? null,
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
                $ruleConnIds = array_map('trim', explode(',', (string) $rule['connection_id']));
                $isMatched = false;
                foreach ($ruleConnIds as $ruleConnIdStr) {
                    $ruleConnId = (int) $ruleConnIdStr;
                    if ($ruleConnId === -1 && $connectionType === 'sheets') {
                        $isMatched = true;
                        break;
                    }
                    if ($ruleConnId === -2 && $connectionType === 'landing_page') {
                        $isMatched = true;
                        break;
                    }
                    if ($ruleConnId === -3 && $connectionType === 'manual') {
                        $isMatched = true;
                        break;
                    }
                    if ($ruleConnId > 0 && $ruleConnId == $connectionId) {
                        $isMatched = true;
                        break;
                    }
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

                    foreach ($branches as $bIdx => $branchObj) {
                        $conds = $branchObj['conditions'] ?? [];
                        $branchMatch = true; // ALWAYS AND logic within a single branch

                        $branchCondsDetail = [];
                        foreach ($conds as $cond) {
                            $resVal = evaluateSingleCondition($data, $source, $type, $cond['col'], $cond['op'], $cond['val'], $connectionId);
                            $branchCondsDetail[] = [
                                'col' => $cond['col'],
                                'op' => $cond['op'],
                                'val' => $cond['val'],
                                'matched' => $resVal
                            ];
                            if (!$resVal) {
                                $branchMatch = false;
                            }
                        }

                        if ($branchMatch) {
                            $isMatch = true;
                            if (isset($branchObj['inject'])) {
                                $injectObj = $branchObj['inject'];
                                if (isset($injectObj['enabled']) && $injectObj['enabled'] && !empty($injectObj['fields']) && is_array($injectObj['fields'])) {
                                    foreach ($injectObj['fields'] as $f) {
                                        if (!empty($f['col'])) {
                                            $injectedFields[$f['col']] = $f['val'];
                                        }
                                    }
                                } else if (is_array($injectObj)) {
                                    foreach ($injectObj as $f) {
                                        if (is_array($f) && !empty($f['col'])) {
                                            $injectedFields[$f['col']] = $f['val'];
                                        }
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
                $assignedRoundId = (int) $rule['target_round_id'];
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
                    $admStmt = $conn->prepare("SELECT name FROM accounts WHERE id = ? AND (role = 'admin' OR role = 'superadmin') LIMIT 1");
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
                    'avatar' => $simulated['avatar'] ?? null,
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
        @set_time_limit(0); // Prevent PHP execution timeout during bulk Excel imports
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
                $source = 'Excel Import';
                $type = 'Excel';
                $note = 'Nhap du lieu cu';

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
                            // If current database lead has no owner (assignedTo is empty), write the owner. Otherwise, only update interaction date.
                            $onlyUpdateDate = !empty($crmCheck['assignedTo']);
                            $leadId = updateLead($conn, $phone, $email, $ownerId, 'Excel Import', 'Excel', 'Nhap du lieu cu', null, $customDate, $name, $onlyUpdateDate, true);
                            $duplicateCount++;
                            logDistribution($conn, $leadId, $ownerId, null, 'silent', 'Chi dong bo check trung, khong dinh tuyen (Trung so).', false, $customDate);
                        } else {
                            $ownerId = $fileConsultantId;
                            $leadId = insertLead($conn, [], $ownerId, $phone, $email, $name, 'Excel Import', 'Excel', 'Nhap du lieu cu', null, $customDate, true);
                            $newCount++;
                            logDistribution($conn, $leadId, $ownerId, null, 'silent', 'Chi dong bo check trung, khong dinh tuyen (Moi).', false, $customDate);
                        }
                    } else {
                        if ($crmCheck['isDuplicate']) {
                            $assignedTo = !empty($crmCheck['assignedTo']) ? $crmCheck['assignedTo'] : $fileConsultantId;
                            // If current database lead has no owner (assignedTo is empty), write the owner. Otherwise, only update interaction date.
                            $onlyUpdateDate = !empty($crmCheck['assignedTo']);
                            $leadId = updateLead($conn, $phone, $email, $assignedTo, 'Excel Import', 'Excel', 'Nhap du lieu cu', null, $customDate, $name, $onlyUpdateDate);
                            logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Trung so tu file Excel nhap vao.', false);
                            $duplicateCount++;

                            if ($syncSaleperson == 1 && !empty($assignedTo)) {
                                $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
                                $stmtC->bind_param("i", $assignedTo);
                                $stmtC->execute();
                                $cRow = $stmtC->get_result()->fetch_assoc();
                                $stmtC->close();
                                if ($cRow && ($cRow['status'] === 'active' || $cRow['status'] === 'leave')) {
                                    require_once __DIR__ . '/mailer.php';
                                    require_once __DIR__ . '/zalo_bot.php';
                                    sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, 'Trung so tu file Excel nhap vao', 'Excel Import', '', '', [], $leadId);
                                    sendLeadReminderZaloMessageToSale($assignedTo, $cRow['name'], $name, $phone, 'Trung so tu file Excel nhap vao', 'Excel Import', '', [], $leadId, $email, 'Excel');
                                }
                            }
                        } else {
                            $assignedToId = $fileConsultantId;
                            $isFromRules = false;
                            $roundId = null;
                            if (empty($assignedToId)) {
                                $rowData = $lead;
                                $rowData['phone'] = $phone;
                                $rowData['email'] = $email;
                                $rowData['name'] = $name;
                                $rulesResult = evaluateRules($conn, $rowData, $source, $type, null, 'sheets');
                                if (is_array($rulesResult)) {
                                    $roundId = $rulesResult['target_round_id'] ?? null;
                                    $inject = $rulesResult['inject'] ?? [];

                                    // Apply inject fields for Excel Import
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
                                            $note = trim($note) === '' ? "[$k]: $v" : $note . "\n[$k]: $v";
                                        }
                                    }

                                    if ($roundId) {
                                        $assignResult = getNextConsultantInRound($conn, $roundId);
                                        if ($assignResult) {
                                            $assignedToId = $assignResult['id'];
                                        }
                                    }
                                    $isFromRules = true;
                                }
                            }

                            $leadId = insertLead($conn, [], $assignedToId, $phone, $email, $name, $source, $type, $note, null, $customDate);
                            $newCount++;

                            if ($assignedToId) {
                                $logMsg = $isFromRules ? 'Phan chia tu dong tu file Excel.' : 'Phan chia cho Sale tu file Excel.';
                                logDistribution($conn, $leadId, $assignedToId, $roundId, 'success', $logMsg, false);

                                $stmtC = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
                                $stmtC->bind_param("i", $assignedToId);
                                $stmtC->execute();
                                $cRow = $stmtC->get_result()->fetch_assoc();
                                $stmtC->close();
                                if ($cRow) {
                                    require_once __DIR__ . '/mailer.php';
                                    require_once __DIR__ . '/zalo_bot.php';
                                    sendLeadAssignedEmailToSale($cRow['email'], $cRow['name'], $name, $phone, 'Lead moi tu file Excel', $source, '', '', $leadId, $assignedToId, $roundId ?? 0);
                                    sendLeadAssignedZaloMessageToSale($assignedToId, $cRow['name'], $name, $phone, 'Lead moi tu file Excel', $source, '', $leadId, $roundId ?? 0, $email, $type);
                                }
                            } else {
                                logDistribution($conn, $leadId, null, null, 'no_consultant', 'Khong co Sale nhan tu file Excel.', false);
                            }
                        }
                    }
                    $conn->commit();
                    $importedCount++;
                    if (!empty($leadId)) {
                        triggerTwoWaySync($conn, $leadId);
                    }
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
        $connectionId = isset($input['connection_id']) ? (int) $input['connection_id'] : 0;

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

        $extractMappedValuesLocal = function ($mappingsArray, $systemField, $data) {
            if (!isset($mappingsArray[$systemField]))
                return '';
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
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        // Force IPv4 to prevent misconfigured IPv6 gateway from causing connection timeout
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($csvData) || stripos($csvData, '<html') !== false || stripos($csvData, '<!DOCTYPE') !== false) {
            echo json_encode(['success' => false, 'message' => "Không thể tải file từ Google Sheet. Bảng tính có thể đang ở chế độ Riêng tư (Private) hoặc không hợp lệ. Vui lòng cấu hình chia sẻ link."]);
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
            $row = array_map(function ($val) {
                return trim($val ?? '', "\" ");
            }, $row);
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
        $distribution_mode = $input['distribution_mode'] ?? 'auto_round';

        // Check if bulk insert
        if (isset($data[0]) && is_array($data[0])) {
            // Bulk insert
            $successCount = 0;
            $failedCount = 0;
            $messages = [];
            foreach ($data as $leadData) {
                $res = processManualLead(
                    $conn,
                    $leadData,
                    $override_round_id,
                    $override_consultant_id,
                    $compensate_skipped,
                    $skipped_consultant_id,
                    $distribution_mode,
                    $decodedUser
                );
                if ($res['success']) {
                    $successCount++;
                } else {
                    $failedCount++;
                    $messages[] = ($leadData['phone'] ?? $leadData['email'] ?? 'Không rõ SĐT/Email') . ': ' . $res['message'];
                }
            }
            echo json_encode([
                'success' => true,
                'message' => "Đã xử lý xong: Thành công $successCount, Thất bại $failedCount." . (empty($messages) ? '' : "\nChi tiết lỗi:\n" . implode("\n", $messages))
            ]);
        } else {
            // Single insert
            $res = processManualLead(
                $conn,
                $data,
                $override_round_id,
                $override_consultant_id,
                $compensate_skipped,
                $skipped_consultant_id,
                $distribution_mode,
                $decodedUser
            );
            echo json_encode($res);
        }
        break;

    case 'claim_public_lead':
        if (!$decodedUser) {
            respond(401, null, 'Unauthorized: Chưa đăng nhập', false);
        }
        
        $limitDay = (int) get_system_setting($conn, 'databank_limit_per_day');
        $limitHour = (int) get_system_setting($conn, 'databank_limit_per_hour');
        $limitMonth = (int) get_system_setting($conn, 'databank_limit_per_month');
        if ($limitDay <= 0) $limitDay = 2;
        if ($limitHour <= 0) $limitHour = 3;
        if ($limitMonth <= 0) $limitMonth = 300;

        $input = json_decode(file_get_contents('php://input'), true);
        $personId = (int) ($input['person_id'] ?? 0);
        
        if ($personId <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID khách hàng không hợp lệ']);
            break;
        }

        $saleId = (int) $decodedUser['id'];

        $conn->begin_transaction();
        try {
            // 1. Check if Person is indeed public
            $stmtP = $conn->prepare("SELECT id, phone, email, full_name, is_public FROM persons WHERE id = ? FOR UPDATE");
            $stmtP->bind_param("i", $personId);
            $stmtP->execute();
            $person = $stmtP->get_result()->fetch_assoc();
            $stmtP->close();

            if (!$person || (int)$person['is_public'] !== 1) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => 'Khách hàng này hiện không có sẵn trong Kho chung.']);
                break;
            }

            // 2. Check if Sale already has a contact for this Person
            $stmtCheck = $conn->prepare("SELECT id FROM contacts WHERE person_id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1");
            $stmtCheck->bind_param("ii", $personId, $saleId);
            $stmtCheck->execute();
            $hasContact = $stmtCheck->get_result()->num_rows > 0;
            $stmtCheck->close();

            if ($hasContact) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => 'Bạn đã sở hữu liên hệ này rồi.']);
                break;
            }

            // 3. Check Quota - Sale's hourly claim limit
            $stmtQ1 = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ? AND status = 'databank_claim' AND received_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)");
            $stmtQ1->bind_param("i", $saleId);
            $stmtQ1->execute();
            $claimsHour = $stmtQ1->get_result()->fetch_assoc()['cnt'] ?? 0;
            $stmtQ1->close();

            if ($claimsHour >= $limitHour) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => "Bạn đã đạt hạn mức nhận khách hàng tối đa trong 1 giờ ($limitHour khách hàng)."]);
                break;
            }

            // 4. Check Quota - Sale's daily claim limit
            $stmtQ2 = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ? AND status = 'databank_claim' AND received_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)");
            $stmtQ2->bind_param("i", $saleId);
            $stmtQ2->execute();
            $claimsDay = $stmtQ2->get_result()->fetch_assoc()['cnt'] ?? 0;
            $stmtQ2->close();

            if ($claimsDay >= $limitDay) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => "Bạn đã đạt hạn mức nhận khách hàng tối đa trong ngày ($limitDay khách hàng)."]);
                break;
            }

            // 5. Check Quota - Sale's monthly claim limit
            $stmtQ3 = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ? AND status = 'databank_claim' AND received_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
            $stmtQ3->bind_param("i", $saleId);
            $stmtQ3->execute();
            $claimsMonth = $stmtQ3->get_result()->fetch_assoc()['cnt'] ?? 0;
            $stmtQ3->close();

            if ($claimsMonth >= $limitMonth) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => "Bạn đã đạt hạn mức nhận khách hàng tối đa trong tháng ($limitMonth khách hàng)."]);
                break;
            }

            // 6. Check Person Quota - Max 2 Sales can claim this Person per day
            $stmtQPerson = $conn->prepare("SELECT COUNT(DISTINCT assigned_to) as cnt FROM distribution_logs WHERE lead_id IN (SELECT id FROM leads WHERE person_id = ?) AND status = 'databank_claim' AND received_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)");
            $stmtQPerson->bind_param("i", $personId);
            $stmtQPerson->execute();
            $personClaimsToday = $stmtQPerson->get_result()->fetch_assoc()['cnt'] ?? 0;
            $stmtQPerson->close();

            if ($personClaimsToday >= 2) {
                $conn->rollback();
                echo json_encode(['success' => false, 'message' => 'Khách hàng này đã đạt giới hạn nhận tối đa của ngày hôm nay (tối đa 2 Sale nhận/ngày).']);
                break;
            }

            // 7. Create CRM Contact for the claiming Sale
            $fullName = $person['full_name'] ?: 'Khách hàng Databank';
            $parts = explode(' ', trim($fullName));
            $lastName = array_shift($parts) ?? '';
            $firstName = implode(' ', $parts);
            if (empty($firstName)) {
                $firstName = $lastName;
                $lastName = '';
            }

            $stmtProj = $conn->prepare("SELECT project_id FROM contacts WHERE person_id = ? AND project_id IS NOT NULL LIMIT 1");
            $stmtProj->bind_param("i", $personId);
            $stmtProj->execute();
            $projRes = $stmtProj->get_result()->fetch_assoc();
            $projectId = $projRes ? $projRes['project_id'] : NULL;
            $stmtProj->close();

            $createdBy = $saleId;
            $stmtIns = $conn->prepare("
                INSERT INTO contacts (person_id, project_id, owner_id, created_by, first_name, last_name, email, phone, source, status, pipeline_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'databank', 'lead', 'chua_xac_dinh')
            ");
            $stmtIns->bind_param("iiiissss", $personId, $projectId, $saleId, $createdBy, $firstName, $lastName, $person['email'], $person['phone']);
            $stmtIns->execute();
            $stmtIns->close();

            $stmtLead = $conn->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
            $stmtLead->bind_param("i", $personId);
            $stmtLead->execute();
            $lRow = $stmtLead->get_result()->fetch_assoc();
            $stmtLead->close();
            $leadId = $lRow ? $lRow['id'] : 0;

            logDistribution($conn, $leadId, $saleId, null, 'databank_claim', 'Sale tự nhận từ Kho chung (Databank)', false);

            $conn->commit();

            if (!empty($leadId)) {
                triggerTwoWaySync($conn, $leadId);
            }

            echo json_encode(['success' => true, 'message' => 'Nhận khách hàng thành công!']);
        } catch (Exception $ex) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $ex->getMessage()]);
        }
        break;

    case 'get_public_leads':
        if (!$decodedUser) {
            respond(401, null, 'Unauthorized: Chưa đăng nhập', false);
        }

        $isStaffAdmin = ($decodedUser['role'] === 'admin' || $decodedUser['role'] === 'superadmin');

        $sql = "SELECT p.id, p.full_name, p.phone, p.email, p.released_to_kho_at,
                       (SELECT project_id FROM contacts WHERE person_id = p.id ORDER BY id ASC LIMIT 1) as project_id,
                       (SELECT name FROM projects WHERE id = (SELECT project_id FROM contacts WHERE person_id = p.id ORDER BY id ASC LIMIT 1)) as project_name,
                       (SELECT source FROM contacts WHERE person_id = p.id ORDER BY id ASC LIMIT 1) as original_source
                FROM persons p
                WHERE p.is_public = 1
                ORDER BY p.released_to_kho_at DESC";

        $res = $conn->query($sql);
        $publicLeads = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                if (!$isStaffAdmin) {
                    $row['phone'] = maskPhone($row['phone']);
                    $row['email'] = maskEmail($row['email']);
                }
                $publicLeads[] = $row;
            }
        }

        // Quota calculations for non-admin roles
        $quota = null;
        if (!$isStaffAdmin) {
            $saleId = (int) $decodedUser['id'];
            $limitDay = (int) get_system_setting($conn, 'databank_limit_per_day');
            $limitHour = (int) get_system_setting($conn, 'databank_limit_per_hour');
            $limitMonth = (int) get_system_setting($conn, 'databank_limit_per_month');
            if ($limitDay <= 0) $limitDay = 3;
            if ($limitHour <= 0) $limitHour = 3;
            if ($limitMonth <= 0) $limitMonth = 10;

            // Hour claims count
            $stmtQ1 = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ? AND status = 'databank_claim' AND received_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)");
            $stmtQ1->bind_param("i", $saleId);
            $stmtQ1->execute();
            $claimsHour = (int)($stmtQ1->get_result()->fetch_assoc()['cnt'] ?? 0);
            $stmtQ1->close();

            // Day claims count
            $stmtQ2 = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ? AND status = 'databank_claim' AND received_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)");
            $stmtQ2->bind_param("i", $saleId);
            $stmtQ2->execute();
            $claimsDay = (int)($stmtQ2->get_result()->fetch_assoc()['cnt'] ?? 0);
            $stmtQ2->close();

            // Month claims count
            $stmtQ3 = $conn->prepare("SELECT COUNT(*) as cnt FROM distribution_logs WHERE assigned_to = ? AND status = 'databank_claim' AND received_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
            $stmtQ3->bind_param("i", $saleId);
            $stmtQ3->execute();
            $claimsMonth = (int)($stmtQ3->get_result()->fetch_assoc()['cnt'] ?? 0);
            $stmtQ3->close();

            $quota = [
                'claims_hour' => $claimsHour,
                'limit_hour' => $limitHour,
                'claims_day' => $claimsDay,
                'limit_day' => $limitDay,
                'claims_month' => $claimsMonth,
                'limit_month' => $limitMonth
            ];
        }

        echo json_encode(['success' => true, 'data' => $publicLeads, 'quota' => $quota]);
        break;

    case 'release_to_databank':
        if (!$decodedUser || !in_array($decodedUser['role'], ['admin', 'superadmin', 'manager', 'assistant'])) {
            respond(403, null, 'Unauthorized: Quyền truy cập bị từ chối', false);
        }

        $leadId = isset($input['lead_id']) ? (int)$input['lead_id'] : 0;
        if ($leadId <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID khách hàng không hợp lệ.']);
            break;
        }

        $conn->begin_transaction();
        try {
            // Find person_id of this lead
            $stmtL = $conn->prepare("SELECT person_id FROM leads WHERE id = ?");
            $stmtL->bind_param("i", $leadId);
            $stmtL->execute();
            $lRow = $stmtL->get_result()->fetch_assoc();
            $stmtL->close();

            if (!$lRow) {
                // If not found in leads, check contacts directly
                $stmtC = $conn->prepare("SELECT person_id FROM contacts WHERE id = ?");
                $stmtC->bind_param("i", $leadId);
                $stmtC->execute();
                $cRow = $stmtC->get_result()->fetch_assoc();
                $stmtC->close();
                $personId = $cRow ? (int)$cRow['person_id'] : 0;
            } else {
                $personId = (int)$lRow['person_id'];
            }

            if ($personId <= 0) {
                throw new Exception("Không tìm thấy thông tin định danh Person tương ứng.");
            }

            // Update person is_public = 1
            $stmtU = $conn->prepare("UPDATE persons SET is_public = 1, released_to_kho_at = NOW() WHERE id = ?");
            $stmtU->bind_param("i", $personId);
            $stmtU->execute();
            $stmtU->close();

            // Soft delete all active contacts for this person
            $stmtDel = $conn->prepare("UPDATE contacts SET deleted_at = NOW() WHERE person_id = ? AND deleted_at IS NULL");
            $stmtDel->bind_param("i", $personId);
            $stmtDel->execute();
            $stmtDel->close();
            
            // Log
            logDistribution($conn, $leadId, null, null, 'released_to_kho', 'Admin chủ động nhả về Kho chung (Databank)', false);

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Đã nhả khách hàng về Kho chung (Databank) thành công!']);
        } catch (Exception $ex) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $ex->getMessage()]);
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
