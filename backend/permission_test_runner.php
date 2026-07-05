<?php
// backend/permission_test_runner.php
// Detailed access control and permission validation suite for RICH LAND CRM

if (!defined('DIAG_TOKEN')) {
    http_response_code(403);
    die(json_encode(['success' => false, 'message' => 'Direct access forbidden']));
}

require_once __DIR__ . '/config/JWT.php';

$results = [];

function assertPermTest(string $name, bool $assertion, ?string $detail = null) {
    global $results;
    $results[] = [
        'test' => $name,
        'passed' => $assertion,
        'detail' => $detail
    ];
}

try {
    $db = Database::getInstance();
    $tenantId = 1;
    $suffix = uniqid();

    // 1. Create temporary mock user IDs for roles
    $salesEmail = "perm_sale_$suffix@richland.net";
    $viewerEmail = "perm_viewer_$suffix@richland.net";
    $adminEmail = "perm_admin_$suffix@richland.net";

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, 'hash', 'sales', 'Sale E2E Perm', 'active')")
       ->execute([$tenantId, $salesEmail]);
    $salesUserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, 'hash', 'viewer', 'Viewer E2E Perm', 'active')")
       ->execute([$tenantId, $viewerEmail]);
    $viewerUserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, 'hash', 'admin', 'Admin E2E Perm', 'active')")
       ->execute([$tenantId, $adminEmail]);
    $adminUserId = (int)$db->lastInsertId();

    // 2. Generate auth tokens
    $salesToken = JWT::encode([
        'username' => 'perm_sale_' . $suffix,
        'email' => $salesEmail,
        'role' => 'sales',
        'user_id' => $salesUserId,
        'id' => $salesUserId,
        'tenant_id' => $tenantId
    ]);

    $viewerToken = JWT::encode([
        'username' => 'perm_viewer_' . $suffix,
        'email' => $viewerEmail,
        'role' => 'viewer',
        'user_id' => $viewerUserId,
        'id' => $viewerUserId,
        'tenant_id' => $tenantId
    ]);

    $adminToken = JWT::encode([
        'username' => 'perm_admin_' . $suffix,
        'email' => $adminEmail,
        'role' => 'admin',
        'user_id' => $adminUserId,
        'id' => $adminUserId,
        'tenant_id' => $tenantId
    ]);

    // 3. Define `$callApi` loopback helper
    $callApi = function(string $resource, string $method, array $body = [], string $token = '') {
        $host = $_SERVER['HTTP_HOST'] ?? 'open.domation.net';
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        $subDir = (strpos($uri, '/richland/') !== false) ? '/richland' : '';
        
        $urls = [
            "http://127.0.0.1" . $subDir . "/api.php?action=" . urlencode($resource),
            "http://localhost" . $subDir . "/api.php?action=" . urlencode($resource),
            "https://open.domation.net/richland/api.php?action=" . urlencode($resource)
        ];
        
        $lastResponse = null;
        $httpCode = 0;
        foreach ($urls as $url) {
            $ch = curl_init($url);
            $headers = [
                'Content-Type: application/json',
                'Host: ' . $host,
                'Authorization: Bearer ' . $token
            ];
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 6);
            if ($method === 'POST') {
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            } elseif ($method === 'PUT' || $method === 'PATCH' || $method === 'DELETE') {
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            }
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($response !== false) {
                $decoded = json_decode($response, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $decoded['http_status_code'] = $httpCode;
                    return $decoded;
                }
                $lastResponse = $response;
            }
        }
        return ['success' => false, 'message' => 'Curl call failed', 'raw' => $lastResponse, 'http_status_code' => $httpCode];
    };

    // ─────────────────────────────────────────────────────────────────
    // Test Case Group 1: Suppliers Permissions
    // ─────────────────────────────────────────────────────────────────
    
    // Create Supplier
    $supplierPayload = [
        'name' => 'Supplier E2E Perm ' . $suffix,
        'prestige_tier' => 'A',
        'cooperation_status' => 'active'
    ];
    $resSaleCreate = $callApi('suppliers', 'POST', $supplierPayload, $salesToken);
    $resViewerCreate = $callApi('suppliers', 'POST', $supplierPayload, $viewerToken);
    $resAdminCreate = $callApi('suppliers', 'POST', $supplierPayload, $adminToken);

    $supplierId = isset($resAdminCreate['data']['id']) ? (int)$resAdminCreate['data']['id'] : 0;
    if ($supplierId === 0) {
        $supplierId = (int)$db->query("SELECT id FROM suppliers ORDER BY id DESC LIMIT 1")->fetchColumn();
    }

    assertPermTest(
        "Suppliers: Create permission constraint",
        $resSaleCreate['http_status_code'] === 403 && $resViewerCreate['http_status_code'] === 403 && $resAdminCreate['http_status_code'] !== 403,
        "Sales Code: {$resSaleCreate['http_status_code']}, Viewer Code: {$resViewerCreate['http_status_code']}, Admin Code: {$resAdminCreate['http_status_code']}"
    );

    // Update Supplier
    $resSaleUpdate = $callApi("suppliers/$supplierId", 'PUT', ['name' => 'Updated Supplier Sales'], $salesToken);
    $resViewerUpdate = $callApi("suppliers/$supplierId", 'PUT', ['name' => 'Updated Supplier Viewer'], $viewerToken);
    $resAdminUpdate = $callApi("suppliers/$supplierId", 'PUT', ['name' => 'Updated Supplier Admin'], $adminToken);

    assertPermTest(
        "Suppliers: Update permission constraint",
        $resSaleUpdate['http_status_code'] === 403 && $resViewerUpdate['http_status_code'] === 403 && $resAdminUpdate['http_status_code'] !== 403,
        "Sales Code: {$resSaleUpdate['http_status_code']}, Viewer Code: {$resViewerUpdate['http_status_code']}, Admin Code: {$resAdminUpdate['http_status_code']}"
    );

    // Delete Supplier
    $resSaleDelete = $callApi("suppliers/$supplierId", 'DELETE', [], $salesToken);
    $resViewerDelete = $callApi("suppliers/$supplierId", 'DELETE', [], $viewerToken);
    $resAdminDelete = $callApi("suppliers/$supplierId", 'DELETE', [], $adminToken);

    assertPermTest(
        "Suppliers: Delete permission constraint",
        $resSaleDelete['http_status_code'] === 403 && $resViewerDelete['http_status_code'] === 403 && $resAdminDelete['http_status_code'] !== 403,
        "Sales Code: {$resSaleDelete['http_status_code']}, Viewer Code: {$resViewerDelete['http_status_code']}, Admin Code: {$resAdminDelete['http_status_code']}"
    );

    // ─────────────────────────────────────────────────────────────────
    // Test Case Group 2: Companies Permissions
    // ─────────────────────────────────────────────────────────────────
    
    // Create Company
    $companyPayload = [
        'name' => 'Company E2E Perm ' . $suffix,
        'tax_code' => '1234567890'
    ];
    $resSaleCoCreate = $callApi('companies', 'POST', $companyPayload, $salesToken);
    $resViewerCoCreate = $callApi('companies', 'POST', $companyPayload, $viewerToken);
    $resAdminCoCreate = $callApi('companies', 'POST', $companyPayload, $adminToken);

    $companyId = isset($resAdminCoCreate['data']['id']) ? (int)$resAdminCoCreate['data']['id'] : 0;
    if ($companyId === 0) {
        $companyId = (int)$db->query("SELECT id FROM companies ORDER BY id DESC LIMIT 1")->fetchColumn();
    }

    assertPermTest(
        "Companies: Create permission constraint",
        $resSaleCoCreate['http_status_code'] === 403 && $resViewerCoCreate['http_status_code'] === 403 && $resAdminCoCreate['http_status_code'] !== 403,
        "Sales Code: {$resSaleCoCreate['http_status_code']}, Viewer Code: {$resViewerCoCreate['http_status_code']}, Admin Code: {$resAdminCoCreate['http_status_code']}"
    );

    // Update Company
    $resSaleCoUpdate = $callApi("companies/$companyId", 'PUT', ['name' => 'Updated Company Sales'], $salesToken);
    $resViewerCoUpdate = $callApi("companies/$companyId", 'PUT', ['name' => 'Updated Company Viewer'], $viewerToken);
    $resAdminCoUpdate = $callApi("companies/$companyId", 'PUT', ['name' => 'Updated Company Admin'], $adminToken);

    assertPermTest(
        "Companies: Update permission constraint",
        $resSaleCoUpdate['http_status_code'] === 403 && $resViewerCoUpdate['http_status_code'] === 403 && $resAdminCoUpdate['http_status_code'] !== 403,
        "Sales Code: {$resSaleCoUpdate['http_status_code']}, Viewer Code: {$resViewerCoUpdate['http_status_code']}, Admin Code: {$resAdminCoUpdate['http_status_code']}"
    );

    // Delete Company
    $resSaleCoDelete = $callApi("companies/$companyId", 'DELETE', [], $salesToken);
    $resViewerCoDelete = $callApi("companies/$companyId", 'DELETE', [], $viewerToken);
    $resAdminCoDelete = $callApi("companies/$companyId", 'DELETE', [], $adminToken);

    assertPermTest(
        "Companies: Delete permission constraint",
        $resSaleCoDelete['http_status_code'] === 403 && $resViewerCoDelete['http_status_code'] === 403 && $resAdminCoDelete['http_status_code'] !== 403,
        "Sales Code: {$resSaleCoDelete['http_status_code']}, Viewer Code: {$resViewerCoDelete['http_status_code']}, Admin Code: {$resAdminCoDelete['http_status_code']}"
    );

    // ─────────────────────────────────────────────────────────────────
    // Test Case Group 3: Projects Permissions
    // ─────────────────────────────────────────────────────────────────
    
    // Create Project
    $projectPayload = [
        'name' => 'Project E2E Perm ' . $suffix,
        'code' => 'PROJ_PERM_' . $suffix,
        'status' => 'active'
    ];
    $resSaleProjCreate = $callApi('projects', 'POST', $projectPayload, $salesToken);
    $resViewerProjCreate = $callApi('projects', 'POST', $projectPayload, $viewerToken);
    $resAdminProjCreate = $callApi('projects', 'POST', $projectPayload, $adminToken);

    $projectId = isset($resAdminProjCreate['data']['id']) ? (int)$resAdminProjCreate['data']['id'] : 0;
    if ($projectId === 0) {
        $projectId = (int)$db->query("SELECT id FROM projects ORDER BY id DESC LIMIT 1")->fetchColumn();
    }

    assertPermTest(
        "Projects: Create permission constraint",
        $resSaleProjCreate['http_status_code'] === 403 && $resViewerProjCreate['http_status_code'] === 403 && $resAdminProjCreate['http_status_code'] !== 403,
        "Sales Code: {$resSaleProjCreate['http_status_code']}, Viewer Code: {$resViewerProjCreate['http_status_code']}, Admin Code: {$resAdminProjCreate['http_status_code']}"
    );

    // Update Project
    $resSaleProjUpdate = $callApi("projects/$projectId", 'PUT', ['name' => 'Updated Project Sales'], $salesToken);
    $resViewerProjUpdate = $callApi("projects/$projectId", 'PUT', ['name' => 'Updated Project Viewer'], $viewerToken);
    $resAdminProjUpdate = $callApi("projects/$projectId", 'PUT', ['name' => 'Updated Project Admin'], $adminToken);

    assertPermTest(
        "Projects: Update permission constraint",
        $resSaleProjUpdate['http_status_code'] === 403 && $resViewerProjUpdate['http_status_code'] === 403 && $resAdminProjUpdate['http_status_code'] !== 403,
        "Sales Code: {$resSaleProjUpdate['http_status_code']}, Viewer Code: {$resViewerProjUpdate['http_status_code']}, Admin Code: {$resAdminProjUpdate['http_status_code']}"
    );

    // Delete Project
    $resSaleProjDelete = $callApi("projects/$projectId", 'DELETE', [], $salesToken);
    $resViewerProjDelete = $callApi("projects/$projectId", 'DELETE', [], $viewerToken);
    $resAdminProjDelete = $callApi("projects/$projectId", 'DELETE', [], $adminToken);

    assertPermTest(
        "Projects: Delete permission constraint",
        $resSaleProjDelete['http_status_code'] === 403 && $resViewerProjDelete['http_status_code'] === 403 && $resAdminProjDelete['http_status_code'] !== 403,
        "Sales Code: {$resSaleProjDelete['http_status_code']}, Viewer Code: {$resViewerProjDelete['http_status_code']}, Admin Code: {$resAdminProjDelete['http_status_code']}"
    );

    // ─────────────────────────────────────────────────────────────────
    // Test Case Group 4: Products Permissions
    // ─────────────────────────────────────────────────────────────────
    
    // Create Product
    $productPayload = [
        'name' => 'Product E2E Perm ' . $suffix,
        'price' => 15000000.00,
        'cost' => 12000000.00,
        'category_id' => 3
    ];
    $resSaleProdCreate = $callApi('products', 'POST', $productPayload, $salesToken);
    $resViewerProdCreate = $callApi('products', 'POST', $productPayload, $viewerToken);
    $resAdminProdCreate = $callApi('products', 'POST', $productPayload, $adminToken);

    $productId = isset($resAdminProdCreate['data']['id']) ? (int)$resAdminProdCreate['data']['id'] : 0;
    if ($productId === 0) {
        $productId = (int)$db->query("SELECT id FROM products ORDER BY id DESC LIMIT 1")->fetchColumn();
    }

    assertPermTest(
        "Products: Create permission constraint",
        $resSaleProdCreate['http_status_code'] === 403 && $resViewerProdCreate['http_status_code'] === 403 && $resAdminProdCreate['http_status_code'] !== 403,
        "Sales Code: {$resSaleProdCreate['http_status_code']}, Viewer Code: {$resViewerProdCreate['http_status_code']}, Admin Code: {$resAdminProdCreate['http_status_code']}"
    );

    // Update Product
    $resSaleProdUpdate = $callApi("products/$productId", 'PUT', ['name' => 'Updated Product Sales'], $salesToken);
    $resViewerProdUpdate = $callApi("products/$productId", 'PUT', ['name' => 'Updated Product Viewer'], $viewerToken);
    $resAdminProdUpdate = $callApi("products/$productId", 'PUT', ['name' => 'Updated Product Admin'], $adminToken);

    assertPermTest(
        "Products: Update permission constraint",
        $resSaleProdUpdate['http_status_code'] === 403 && $resViewerProdUpdate['http_status_code'] === 403 && $resAdminProdUpdate['http_status_code'] !== 403,
        "Sales Code: {$resSaleProdUpdate['http_status_code']}, Viewer Code: {$resViewerProdUpdate['http_status_code']}, Admin Code: {$resAdminProdUpdate['http_status_code']}"
    );

    // Delete Product
    $resSaleProdDelete = $callApi("products/$productId", 'DELETE', [], $salesToken);
    $resViewerProdDelete = $callApi("products/$productId", 'DELETE', [], $viewerToken);
    $resAdminProdDelete = $callApi("products/$productId", 'DELETE', [], $adminToken);

    assertPermTest(
        "Products: Delete permission constraint",
        $resSaleProdDelete['http_status_code'] === 403 && $resViewerProdDelete['http_status_code'] === 403 && $resAdminProdDelete['http_status_code'] !== 403,
        "Sales Code: {$resSaleProdDelete['http_status_code']}, Viewer Code: {$resViewerProdDelete['http_status_code']}, Admin Code: {$resAdminProdDelete['http_status_code']}"
    );

    // Clean up temporary DB records
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");
    $db->prepare("DELETE FROM users WHERE id IN (?, ?, ?)")->execute([$salesUserId, $viewerUserId, $adminUserId]);
    if ($supplierId) $db->prepare("DELETE FROM suppliers WHERE id = ?")->execute([$supplierId]);
    if ($companyId) $db->prepare("DELETE FROM companies WHERE id = ?")->execute([$companyId]);
    if ($projectId) $db->prepare("DELETE FROM projects WHERE id = ?")->execute([$projectId]);
    if ($productId) $db->prepare("DELETE FROM products WHERE id = ?")->execute([$productId]);
    $db->exec("SET FOREIGN_KEY_CHECKS = 1");

} catch (Throwable $t) {
    assertPermTest("System test exception", false, $t->getMessage() . " in " . $t->getFile() . " line " . $t->getLine());
}

echo json_encode([
    'success' => true,
    'results' => $results
], JSON_UNESCAPED_UNICODE);
