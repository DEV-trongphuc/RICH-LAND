<?php
require_once __DIR__ . '/config.php';          // DB constants + CORS origins

if (defined('APP_ENV') && APP_ENV === 'production') {
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    error_reporting(0);
} else {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
}

// require_once __DIR__ . '/config/Config.php';   // Removed to prevent 'already defined' warnings
require_once __DIR__ . '/config/Database.php';
require_once __DIR__ . '/config/JWT.php';

// ── CORS ──────────────────────────────────────────────────────
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = array_map('trim', explode(',', ALLOWED_ORIGINS));

// Dynamically fetch and allow frontend_url from system_settings
try {
    $db = Database::getInstance();
    


    $stmtSetting = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
    if ($stmtSetting) {
        $feUrl = $stmtSetting->fetchColumn();
        if (!empty($feUrl)) {
            $parsed = parse_url($feUrl);
            if (isset($parsed['scheme']) && isset($parsed['host'])) {
                $allowed[] = $parsed['scheme'] . '://' . $parsed['host'] . (isset($parsed['port']) ? ':' . $parsed['port'] : '');
            }
        }
    }
} catch (Throwable $e) {
    // Avoid crashing on DB issues during CORS phase
}


// Also allow any localhost origin (any port) for local dev
$isLocalhost = (bool) preg_match('#^https?://localhost(:\d+)?$#', $origin);
if ($isLocalhost || in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
} else {
    header("Access-Control-Allow-Origin: " . ($allowed[0] ?? ''));
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-HTTP-Method-Override');
header('Vary: Origin');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }


// ── Helper functions ──────────────────────────────────────────
function respond(int $code, $data = null, string $message = '', bool $success = true): void {
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=UTF-8');
    }
    echo json_encode(['success' => $success, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Global Exception Handler ──────────────────────────────────
set_exception_handler(function (Throwable $e) {
    $msg = (defined('APP_ENV') && APP_ENV === 'production') 
           ? 'Đã có lỗi hệ thống xảy ra. Vui lòng thử lại sau.' 
           : $e->getMessage() . " in " . $e->getFile() . " line " . $e->getLine();
    respond(500, null, $msg, false);
});

function getBody(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

if (!function_exists('getBearerToken')) {
    function getBearerToken(): ?string {
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.+)/i', $h, $m)) return $m[1];
        if (isset($_GET['token']) && !empty($_GET['token'])) return $_GET['token'];
        return null;
    }
}

function requireAuth(): array {
    $token = getBearerToken();
    if (!$token) respond(401, null, 'Token không hợp lệ', false);
    $payload = JWT::decode($token);
    if (!$payload) respond(401, null, 'Token hết hạn hoặc không hợp lệ', false);
    
    // Normalize role: convert 'sale' to 'sales' to ensure compatibility with all controllers
    if (isset($payload['role']) && $payload['role'] === 'sale') {
        $payload['role'] = 'sales';
    }
    // Ensure user_id key exists
    if (!isset($payload['user_id']) && isset($payload['id'])) {
        $payload['user_id'] = $payload['id'];
    }
    // Ensure tenant_id key exists
    if (!isset($payload['tenant_id']) || empty($payload['tenant_id'])) {
        $payload['tenant_id'] = 1;
    }
    return $payload;
}

function requireRole(array $payload, array $roles): void {
    if (!in_array($payload['role'], $roles, true)) {
        respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
    }
}

function logActivity(PDO $db, $tid, $uid, string $action, ?string $resource = null, $resourceId = null, ?string $data = null): void {
    try {
        $stmt = $db->prepare("
            INSERT INTO audit_logs (tenant_id, user_id, action, resource, resource_id, new_data, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tid, $uid, $action, $resource ?? 'system', $resourceId, $data, 
            $_SERVER['REMOTE_ADDR'] ?? null, $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
    } catch (Throwable $e) {
        // Fallback to error_log in production, don't crash the app
        error_log("Audit Log Failure: " . $e->getMessage());
    }
}

function logInteraction(PDO $db, $tid, $uid, string $type, string $subject, ?string $body = null, ?string $relType = null, $relId = null): void {
    // Timeline logging (Visible to users in Interaction History)
    $cid = ($relType === 'contact') ? $relId : null;
    
    // If it's a deal/invoice/etc, try to find the contact_id if cid is not set
    if (!$cid && $relType && $relId) {
        $table = '';
        if ($relType === 'deal') $table = 'deals';
        elseif ($relType === 'invoice') $table = 'invoices';
        elseif ($relType === 'quote') $table = 'quotes';
        elseif ($relType === 'ticket') $table = 'tickets';
        
        if ($table) {
            $s = $db->prepare("SELECT contact_id FROM $table WHERE id = ?");
            $s->execute([$relId]);
            $cid = $s->fetchColumn() ?: null;
        }
    }

    $stmt = $db->prepare("
        INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, due_date, done_at, related_type, related_id)
        VALUES (?, ?, ?, ?, ?, 'done', 'medium', NOW(), NOW(), ?, ?)
    ");
    $stmt->execute([$tid, $uid, $type, $subject, $body, $relType, $relId]);
}

function getCustomFields(PDO $db, int $tenant_id, int $entity_id, string $entity_type): array {
    $stmt = $db->prepare("
        SELECT cf.id, cf.field_key, cf.label, cf.field_type, cf.options, cf.is_required, 
               cfv.value_text, cfv.value_number, cfv.value_date, cfv.value_json 
        FROM custom_fields cf
        LEFT JOIN custom_field_values cfv ON cf.id = cfv.custom_field_id AND cfv.entity_id = ?
        WHERE cf.tenant_id = ? AND cf.entity_type = ?
        ORDER BY cf.order_index ASC, cf.id ASC
    ");
    $stmt->execute([$entity_id, $tenant_id, $entity_type]);
    $cfs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $custom_fields = [];
    foreach ($cfs as $cf) {
        $val = null;
        if ($cf['field_type'] === 'number') $val = $cf['value_number'] !== null ? $cf['value_number'] + 0 : null;
        elseif ($cf['field_type'] === 'date') $val = $cf['value_date'];
        elseif (in_array($cf['field_type'], ['multiselect', 'checkbox'])) {
            if ($cf['field_type'] === 'checkbox' && empty($cf['value_json'])) {
                $val = ($cf['value_text'] === 'true' || $cf['value_text'] === '1') ? true : false;
            } else {
                $val = json_decode($cf['value_json'] ?? '[]', true);
            }
        }
        else $val = $cf['value_text'];
        
        $custom_fields[] = [
            'id' => (int)$cf['id'],
            'field_key' => $cf['field_key'],
            'label' => $cf['label'],
            'field_type' => $cf['field_type'],
            'options' => $cf['options'] ? json_decode($cf['options'], true) : [],
            'is_required' => (bool)$cf['is_required'],
            'value' => $val
        ];
    }
    return $custom_fields;
}

function saveCustomFields(PDO $db, int $tenant_id, int $entity_id, string $entity_type, array $custom_fields): void {
    foreach ($custom_fields as $key => $item) {
        $value = null;
        
        if (is_array($item) && isset($item['field_id'])) {
            $cf_id = (int)$item['field_id'];
            $value = $item['value'] ?? null;
            $stmt = $db->prepare("SELECT id, field_type FROM custom_fields WHERE tenant_id = ? AND id = ?");
            $stmt->execute([$tenant_id, $cf_id]);
        } else {
            $value = $item;
            $stmt = $db->prepare("SELECT id, field_type FROM custom_fields WHERE tenant_id = ? AND entity_type = ? AND field_key = ?");
            $stmt->execute([$tenant_id, $entity_type, $key]);
        }
        
        $cfDef = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$cfDef) continue;
        
        $cf_id = $cfDef['id'];
        $type = $cfDef['field_type'];
        
        $v_text = null; $v_num = null; $v_date = null; $v_json = null;
        if ($type === 'number') {
            $v_num = ($value !== '' && $value !== null) ? (float)$value : null;
        } elseif ($type === 'date') {
            $v_date = $value ?: null;
        } elseif (in_array($type, ['multiselect', 'checkbox'])) {
            $v_json = json_encode($value);
            if ($type === 'checkbox') $v_text = $value ? 'true' : 'false';
        } else {
            $v_text = $value;
        }
        
        $upsert = $db->prepare("
            INSERT INTO custom_field_values (custom_field_id, entity_id, value_text, value_number, value_date, value_json)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE value_text=VALUES(value_text), value_number=VALUES(value_number), value_date=VALUES(value_date), value_json=VALUES(value_json), updated_at=NOW()
        ");
        $upsert->execute([$cf_id, $entity_id, $v_text, $v_num, $v_date, $v_json]);
    }
}


/**
 * Shared Inventory Deduction Logic (FIFO)
 */
function deductStockFIFO(PDO $db, $tid, $uid, $productId, $qty, string $invNum): void {
    // 1. Get batches sorted by import date (FIFO)
    $stmtBatches = $db->prepare("
        SELECT id, current_qty 
        FROM batches 
        WHERE product_id = ? AND tenant_id = ? AND current_qty > 0 AND status = 'active'
        ORDER BY import_date ASC, id ASC 
        FOR UPDATE
    ");
    $stmtBatches->execute([$productId, $tid]);
    $batches = $stmtBatches->fetchAll();

    $remainingToDeduct = $qty;

    foreach ($batches as $batch) {
        if ($remainingToDeduct <= 0) break;

        $deductFromThisBatch = min($batch['current_qty'], $remainingToDeduct);
        
        // Update batch quantity
        $db->prepare("UPDATE batches SET current_qty = current_qty - ? WHERE id = ?")
             ->execute([$deductFromThisBatch, $batch['id']]);
        
        // Create inventory log
        $db->prepare("
            INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
            VALUES (?, ?, 'SALE', ?, ?, ?)
        ")->execute([
            $tid, $batch['id'], -$deductFromThisBatch, "Bán hàng - Hóa đơn #$invNum", $uid
        ]);

        $remainingToDeduct -= $deductFromThisBatch;
    }
    
    if ($remainingToDeduct > 0) {
        throw new Exception("Không đủ hàng trong kho để thực hiện giao dịch (Thiếu $remainingToDeduct đơn vị)");
    }

    // Update overall product stock
    $db->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id=? AND tenant_id=?")
         ->execute([$qty, $productId, $tid]);
}

/**
 * Reverses stock deduction for a specific invoice number
 */
function returnStock(PDO $db, int $tid, int $uid, string $invNum): void {
    // 1. Find logs related to this invoice
    $stmt = $db->prepare("SELECT batch_id, ABS(qty_change) as qty FROM inventory_logs WHERE tenant_id=? AND reason LIKE ? AND action_type='SALE'");
    $stmt->execute([$tid, "%Hóa đơn #$invNum"]);
    $logs = $stmt->fetchAll();

    foreach ($logs as $log) {
        $bid = (int)$log['batch_id'];
        $qty = (float)$log['qty'];

        // 2. Put stock back into batch
        $db->prepare("UPDATE batches SET current_qty = current_qty + ? WHERE id=?")->execute([$qty, $bid]);

        // 3. Update overall product stock
        $db->prepare("UPDATE products p JOIN batches b ON p.id = b.product_id SET p.stock_quantity = p.stock_quantity + ? WHERE b.id = ?")
             ->execute([$qty, $bid]);

        // 4. Create reversal log
        $db->prepare("INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by) VALUES (?, ?, 'ADJUST', ?, ?, ?)")
             ->execute([$tid, $bid, $qty, "Hoàn kho từ hóa đơn bị xóa #$invNum", $uid]);
    }
}

// ── Load controllers ──────────────────────────────────────────
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/ContactController.php';
require_once __DIR__ . '/controllers/CompanyController.php';
require_once __DIR__ . '/controllers/DealController.php';
require_once __DIR__ . '/controllers/ActivityController.php';
require_once __DIR__ . '/controllers/ProductController.php';
require_once __DIR__ . '/controllers/QuoteController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/NotificationController.php';
require_once __DIR__ . '/controllers/ReportController.php';
require_once __DIR__ . '/controllers/NoteController.php';
require_once __DIR__ . '/controllers/SearchController.php';
require_once __DIR__ . '/controllers/ImportController.php';
require_once __DIR__ . '/controllers/FinanceController.php';
require_once __DIR__ . '/controllers/POSController.php';
require_once __DIR__ . '/controllers/TicketController.php';
require_once __DIR__ . '/controllers/TagController.php';
require_once __DIR__ . '/controllers/SupplierController.php';
require_once __DIR__ . '/controllers/InventoryController.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';
require_once __DIR__ . '/controllers/CloudFileController.php';
require_once __DIR__ . '/controllers/CustomFieldController.php';
require_once __DIR__ . '/controllers/ExportController.php';
require_once __DIR__ . '/controllers/ProjectController.php';
require_once __DIR__ . '/controllers/CampaignController.php';
require_once __DIR__ . '/controllers/DepositController.php';
require_once __DIR__ . '/controllers/CooperationController.php';
require_once __DIR__ . '/controllers/CapiController.php';
require_once __DIR__ . '/controllers/CheckInController.php';
require_once __DIR__ . '/controllers/TeamController.php';

// ── Parse route ───────────────────────────────────────────────
$requestUri = strtok($_SERVER['REQUEST_URI'], '?');
// Auto-detect base path: works for /crm/backend (prod) and /CRM/backend (local dev)
$requestUri = preg_replace('#^.*/backend#i', '', $requestUri);
$path       = trim($requestUri, '/');
$segments   = array_values(array_filter(explode('/', $path)));

$method        = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    if (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
        $method = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
    } elseif (isset($_GET['_method'])) {
        $method = strtoupper($_GET['_method']);
    }
}
$resource      = $segments[0] ?? '';
$resourceId    = $segments[1] ?? null;
$subResource   = $segments[2] ?? null;

$db = Database::getInstance();

// ── Auto-Migrate Database schema ───────────────────────────────
try {
    $db->exec("CREATE TABLE IF NOT EXISTS schema_migrations (
        migration VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $applied = $db->query("SELECT migration FROM schema_migrations")->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $sqlFiles = ['migrate_2026_05_06_v3_files.sql', 'migrate_activity_comments.sql', 'migrate_fractional_quantities.sql'];
    
    foreach ($sqlFiles as $file) {
        if (!in_array($file, $applied, true)) {
            $path = __DIR__ . '/' . $file;
            if (file_exists($path)) {
                $sql = file_get_contents($path);
                $stmts = array_filter(array_map('trim', explode(';', $sql)));
                foreach ($stmts as $s) {
                    if ($s !== '') {
                        $db->exec($s);
                    }
                }
                $stmtInsert = $db->prepare("INSERT INTO schema_migrations (migration) VALUES (?)");
                $stmtInsert->execute([$file]);
            }
        }
    }
} catch (Exception $e) {
    error_log("Auto Migration Error: " . $e->getMessage());
}

if ($resource === 'check') {
    require_once __DIR__ . '/check_data.php';
    exit;
}

// ── Route dispatch ────────────────────────────────────────────
switch ($resource) {
    // CUSTOM FIELDS
    case 'custom-fields':
        $auth = requireAuth();
        $ctrl = new CustomFieldController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // EXPORT
    case 'export':
        $auth = requireAuth();
        $ctrl = new ExportController($db);
        if ($method === 'GET') $ctrl->export($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // IMPORT
    case 'import':
        $auth = requireAuth();
        $ctrl = new ImportController($db);
        if ($resourceId === 'template' && $method === 'GET') $ctrl->template($auth);
        elseif ($resourceId === 'process' && $method === 'POST') $ctrl->process($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // AUTH
    case 'auth':
        $ctrl = new AuthController($db);
        if ($resourceId === 'login'   && $method === 'POST') $ctrl->login();
        elseif ($resourceId === 'refresh' && $method === 'POST') $ctrl->refresh();
        elseif ($resourceId === 'logout'  && $method === 'POST') $ctrl->logout();
        elseif ($resourceId === 'me'      && $method === 'GET')  $ctrl->me(requireAuth());
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // DASHBOARD
    case 'dashboard':
        $auth = requireAuth();
        $ctrl = new DashboardController($db);
        if     ($resourceId === 'stats')              $ctrl->stats($auth);
        elseif ($resourceId === 'chart-revenue')      $ctrl->chartRevenue($auth);
        elseif ($resourceId === 'top-deals')          $ctrl->topDeals($auth);
        elseif ($resourceId === 'recent-activities')  $ctrl->recentActivities($auth);
        elseif ($resourceId === 'pipeline-funnel')    $ctrl->pipelineFunnel($auth);
        elseif ($resourceId === 'lead-sources')       $ctrl->leadSources($auth);
        elseif ($resourceId === 'sales-leaderboard')  $ctrl->salesLeaderboard($auth);
        elseif ($resourceId === 'my-stats')           $ctrl->myStats($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // CONTACTS
    case 'contacts':
        $auth = requireAuth();
        $ctrl = new ContactController($db);
        if ($resourceId === 'bulk-delete' && $method === 'POST') $ctrl->bulkDelete($auth);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $subResource === 'stage' && $method === 'PATCH') $ctrl->moveStage($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // COMPANIES
    case 'companies':
        $auth = requireAuth();
        $ctrl = new CompanyController($db);
        if ($resourceId === 'bulk-delete' && $method === 'POST') $ctrl->bulkDelete($auth);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $subResource === 'stage' && $method === 'PATCH') $ctrl->moveStage($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // DEALS
    case 'deals':
        $auth = requireAuth();
        $ctrl = new DealController($db);
        if ($resourceId === 'bulk-delete' && $method === 'POST') $ctrl->bulkDelete($auth);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $subResource === 'stage' && $method === 'PATCH') $ctrl->moveStage($auth, (int)$resourceId);
        elseif ($resourceId  && $subResource === 'move' && $method === 'POST') $ctrl->moveStage($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // PIPELINE STAGES
    case 'pipeline-stages':
        $auth = requireAuth();
        $ctrl = new DealController($db);
        if ($method === 'GET') $ctrl->stages($auth);
        elseif (!$resourceId && $method === 'POST') { requireRole($auth, ['admin','manager']); $ctrl->storeStage($auth); }
        elseif ($resourceId  && $method === 'PUT')  { requireRole($auth, ['admin','manager']); $ctrl->updateStage($auth, (int)$resourceId); }
        elseif ($resourceId  && $method === 'DELETE') { requireRole($auth, ['admin']); $ctrl->destroyStage($auth, (int)$resourceId); }
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // ACTIVITIES
    case 'activities':
        $auth = requireAuth();
        $ctrl = new ActivityController($db);
        if     ($resourceId && $subResource === 'comments' && $method === 'GET')  $ctrl->getComments($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'comments' && $method === 'POST') $ctrl->addComment($auth, (int)$resourceId);
        elseif ($resourceId === 'comments' && $subResource && $method === 'DELETE') $ctrl->deleteComment($auth, (int)$subResource);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // UPLOAD
    case 'upload':
        $auth = requireAuth();
        require_once __DIR__ . '/controllers/UploadController.php';
        $ctrl = new UploadController($db);
        if ($method === 'POST') $ctrl->handle($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // PRODUCTS
    case 'products':
        $auth = requireAuth();
        $ctrl = new ProductController($db);
        if ($resourceId === 'bulk-delete' && $method === 'POST') $ctrl->bulkDelete($auth);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   { requireRole($auth, ['admin','manager']); $ctrl->store($auth); }
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    { requireRole($auth, ['admin','manager']); $ctrl->update($auth, (int)$resourceId); }
        elseif ($resourceId  && $method === 'DELETE') { requireRole($auth, ['admin']); $ctrl->destroy($auth, (int)$resourceId); }
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // QUOTES
    case 'quotes':
        $auth = requireAuth();
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        $ctrl = new QuoteController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $subResource === 'convert' && $method === 'POST') $ctrl->convert($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // USERS
    case 'users':
        $auth = requireAuth();
        $ctrl = new UserController($db);
        if     (!$resourceId && $method === 'GET')    { requireRole($auth, ['admin', 'super_admin']); $ctrl->index($auth); }
        elseif (!$resourceId && $method === 'POST')   { requireRole($auth, ['admin', 'super_admin']); $ctrl->store($auth); }
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') { requireRole($auth, ['admin', 'super_admin']); $ctrl->destroy($auth, (int)$resourceId); }
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // TEAMS
    case 'teams':
        $auth = requireAuth();
        $ctrl = new TeamController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // NOTIFICATIONS
    case 'notifications':
        $auth = requireAuth();
        $ctrl = new NotificationController($db);
        if ($method === 'GET') $ctrl->index($auth);
        elseif ($resourceId && $method === 'PATCH') $ctrl->markRead($auth, (int)$resourceId);
        elseif ($method === 'DELETE') $ctrl->clearAll($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // REPORTS
    case 'reports':
        $auth = requireAuth();
        $ctrl = new ReportController($db);
        if     ($resourceId === 'sales')      $ctrl->sales($auth);
        elseif ($resourceId === 'pipeline')   $ctrl->pipeline($auth);
        elseif ($resourceId === 'activities') $ctrl->activities($auth);
        elseif ($resourceId === 'customers')  $ctrl->customers($auth);
        elseif ($resourceId === 'companies')  $ctrl->companies($auth);
        elseif ($resourceId === 'expenses')   $ctrl->expenses($auth);
        elseif ($resourceId === 'inventory')  $ctrl->inventory($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // NOTES (threaded, per entity)
    case 'notes':
        $auth = requireAuth();
        $ctrl = new NoteController($db);
        $entityType = $_GET['entity_type'] ?? $segments[1] ?? '';
        $entityId   = (int)($_GET['entity_id'] ?? $segments[2] ?? 0);
        if ($method === 'GET' && $entityType && $entityId) $ctrl->index($auth, $entityType, $entityId);
        elseif ($method === 'POST' && $entityType && $entityId) $ctrl->store($auth, $entityType, $entityId);
        elseif ($resourceId && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // SEARCH (global + smart filter)
    case 'search':
        $auth = requireAuth();
        $ctrl = new SearchController($db);
        if ($resourceId === 'smart') $ctrl->smartFilter($auth);
        else $ctrl->global($auth);
        break;

    // FINANCE (Invoices & Expenses)
    case 'invoices':
        $auth = requireAuth();
        $ctrl = new FinanceController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->listInvoices($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->createInvoice($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->showInvoice($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->updateInvoice($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->deleteInvoice($auth, (int)$resourceId);
        elseif ($subResource === 'pay' && $method === 'POST') $ctrl->markPaid($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    case 'expenses':
        $auth = requireAuth();
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        $ctrl = new FinanceController($db);
        if ($resourceId === 'entity' && $subResource && $method === 'GET') {
            $ctrl->listEntityExpenses($auth, $subResource, (int)($segments[3] ?? 0));
        }
        elseif ($resourceId === 'summary' && $method === 'GET') $ctrl->summary($auth);
        elseif (!$resourceId && $method === 'GET')    $ctrl->listExpenses($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->createExpense($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->showExpense($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->updateExpense($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->deleteExpense($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PATCH')  $ctrl->approveExpense($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // TICKETS (Helpdesk)
    case 'tickets':
        $auth = requireAuth();
        $ctrl = new TicketController($db);
        if ($subResource === 'comments' && $method === 'GET') $ctrl->getComments($auth, (int)$resourceId);
        elseif ($subResource === 'comments' && $method === 'POST') $ctrl->addComment($auth, (int)$resourceId);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    case 'pos':
        $auth = requireAuth();
        $ctrl = new POSController($db);
        if ($method === 'POST') $ctrl->createOrder($auth);
        break;

    case 'tags':
        $auth = requireAuth();
        $ctrl = new TagController($db);
        if     ($resourceId === 'stats' && $method === 'GET') $ctrl->tagStats($auth);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    case 'inventory':
        $auth = requireAuth();
        $ctrl = new InventoryController($db);
        if     ($resourceId === 'export' && $method === 'POST') $ctrl->internalExport($auth);
        elseif ($resourceId === 'logs' && $method === 'GET') $ctrl->getLogs($auth, (int)($segments[2] ?? 0));
        elseif ($resourceId === 'global-logs' && $method === 'GET') $ctrl->globalLogs($auth);
        elseif ($resourceId === 'adjust' && $method === 'POST') $ctrl->adjust($auth);
        elseif ($resourceId === 'archive' && $method === 'POST') $ctrl->archive($auth, (int)($segments[2] ?? 0));
        elseif (!$resourceId && $method === 'GET') $ctrl->index($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    case 'suppliers':
        $auth = requireAuth();
        $ctrl = new SupplierController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    case 'purchase-orders':
        $auth = requireAuth();
        $ctrl = new PurchaseOrderController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'GET')    $ctrl->show($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        elseif ($subResource === 'receive' && $method === 'POST') $ctrl->receive($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // FILE CATEGORIES
    case 'file-categories':
        $auth = requireAuth();
        require_once __DIR__ . '/controllers/FileCategoryController.php';
        $ctrl = new FileCategoryController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, $resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, $resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    case 'cloud-files':
        $auth = requireAuth();
        $ctrl = new CloudFileController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    case 'system':
        $auth = requireAuth();
        requireRole($auth, ['admin', 'super_admin']);
        if ($resourceId === 'patch' && $method === 'POST') {
            $sqlFiles = ['migrate_2026_05_06_v3_files.sql', 'migrate_activity_comments.sql', 'migrate_fractional_quantities.sql'];
            $results = [];
            foreach ($sqlFiles as $file) {
                $path = __DIR__ . '/' . $file;
                if (file_exists($path)) {
                    $sql = file_get_contents($path);
                    $stmts = array_filter(array_map('trim', explode(';', $sql)));
                    foreach ($stmts as $s) {
                        try {
                            $db->exec($s);
                            $results[] = "SUCCESS: " . substr($s, 0, 50);
                        } catch (Exception $e) {
                            $results[] = "INFO/ERROR: " . $e->getMessage();
                        }
                    }
                }
            }
            respond(200, $results, 'Migration check completed');
        }
        break;

    // PROJECTS (Module 6)
    case 'projects':
        $auth = requireAuth();
        $ctrl = new ProjectController($db);
        if ($resourceId && $subResource === 'roster' && $method === 'GET') $ctrl->getRoster($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'roster' && $method === 'POST') $ctrl->updateRoster($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'documents' && $method === 'GET') $ctrl->getDocuments($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'documents' && $method === 'POST') $ctrl->uploadDocument($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'documents' && $segments[3] && $method === 'DELETE') $ctrl->deleteDocument($auth, (int)$resourceId, (int)$segments[3]);
        elseif ($resourceId && $subResource === 'documents' && $segments[3] && ($segments[4] ?? '') === 'download') $ctrl->downloadDocument($auth, (int)$resourceId, (int)$segments[3]);
        elseif ($resourceId && $subResource === 'documents' && $segments[3] && $method === 'GET') $ctrl->downloadDocument($auth, (int)$resourceId, (int)$segments[3]); // fallback direct link download
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // CAMPAIGNS (Marketing campaigns)
    case 'campaigns':
        $auth = requireAuth();
        $ctrl = new CampaignController($db);
        if (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // DEPOSITS (Module 8)
    case 'deposits':
        $auth = requireAuth();
        $ctrl = new DepositController($db);
        if ($resourceId && $subResource === 'milestones' && $segments[3] && $subResource === 'unc' && $method === 'POST') $ctrl->uploadUnc($auth, (int)$resourceId, (int)$segments[3]);
        elseif ($resourceId && $subResource === 'milestones' && $segments[3] && $method === 'POST') {
            // Upload UNC standard POST
            $ctrl->uploadUnc($auth, (int)$resourceId, (int)$segments[3]);
        }
        elseif ($resourceId && $subResource === 'milestones' && $segments[3] && $segments[4] === 'approve' && $method === 'POST') $ctrl->approveMilestone($auth, (int)$resourceId, (int)$segments[3]);
        elseif ($resourceId && $subResource === 'milestones' && $segments[3] && $segments[4] === 'reject' && $method === 'POST') $ctrl->rejectMilestone($auth, (int)$resourceId, (int)$segments[3]);
        elseif ($resourceId && $subResource === 'cancel' && $method === 'POST') $ctrl->cancelDeposit($auth, (int)$resourceId);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // COOPERATION SLIPS (Module 4)
    case 'cooperation-slips':
        $auth = requireAuth();
        $ctrl = new CooperationController($db);
        if ($resourceId && $subResource === 'shares' && $method === 'PUT') $ctrl->updateShares($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'sign' && $method === 'POST') $ctrl->signSlip($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'approve' && $method === 'POST') $ctrl->approveSlip($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'reject' && $method === 'POST') $ctrl->rejectSlip($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'upload-attachment' && $method === 'POST') $ctrl->uploadAttachment($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'delete-attachment' && $method === 'POST') $ctrl->deleteAttachment($auth, (int)$resourceId);
        elseif ($resourceId && $subResource === 'rename-attachment' && $method === 'POST') $ctrl->renameAttachment($auth, (int)$resourceId);
        elseif (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->createSlip($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // META CAPI (Module 9)
    case 'capi':
        $auth = requireAuth();
        $ctrl = new CapiController($db);
        if ($resourceId === 'settings' && $method === 'GET') $ctrl->getSettings($auth);
        elseif ($resourceId === 'settings' && $method === 'POST') $ctrl->saveSettings($auth);
        elseif ($resourceId === 'logs' && $method === 'GET') $ctrl->getLogs($auth);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    // CHECK-INS
    case 'check-ins':
        $auth = requireAuth();
        $ctrl = new CheckInController($db);
        if     (!$resourceId && $method === 'GET')    $ctrl->index($auth);
        elseif (!$resourceId && $method === 'POST')   $ctrl->store($auth);
        elseif ($resourceId  && $method === 'PUT')    $ctrl->update($auth, (int)$resourceId);
        elseif ($resourceId  && $method === 'DELETE') $ctrl->destroy($auth, (int)$resourceId);
        else respond(404, null, 'Route không tồn tại', false);
        break;

    default:
        respond(404, null, 'Route không tồn tại', false);
}
