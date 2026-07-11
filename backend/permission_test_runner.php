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
        
        $parts = explode('&', $resource);
        $actionName = array_shift($parts);
        $queryString = '';
        if (count($parts) > 0) {
            $queryString = '&' . implode('&', $parts);
        }

        $urls = [
            "http://127.0.0.1" . $subDir . "/api.php?action=" . urlencode($actionName) . $queryString,
            "http://localhost" . $subDir . "/api.php?action=" . urlencode($actionName) . $queryString,
            "https://open.domation.net/richland/api.php?action=" . urlencode($actionName) . $queryString
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

    // ─────────────────────────────────────────────────────────────────
    // Test Case Group 5: Team and Manager Permissions
    // ─────────────────────────────────────────────────────────────────
    $mgrEmail = "perm_mgr_$suffix@richland.net";
    $sales1Email = "perm_s1_$suffix@richland.net"; // In team
    $sales2Email = "perm_s2_$suffix@richland.net"; // Outside team

    // Create users
    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, 'hash', 'manager', 'Manager E2E Perm', 'active')")
       ->execute([$tenantId, $mgrEmail]);
    $mgrUserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, 'hash', 'sales', 'Sale 1 In Team', 'active')")
       ->execute([$tenantId, $sales1Email]);
    $sales1UserId = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO users (tenant_id, email, password_hash, role, full_name, status) VALUES (?, ?, 'hash', 'sales', 'Sale 2 Out Team', 'active')")
       ->execute([$tenantId, $sales2Email]);
    $sales2UserId = (int)$db->lastInsertId();

    // Create a team led by the manager
    $db->prepare("INSERT INTO teams (tenant_id, name, leader_id) VALUES (?, ?, ?)")
       ->execute([$tenantId, "Team Perm E2E $suffix", $mgrUserId]);
    $teamId = (int)$db->lastInsertId();

    // Assign Sales 1 to the team
    $db->prepare("UPDATE users SET team_id = ? WHERE id = ?")
       ->execute([$teamId, $sales1UserId]);

    // Generate tokens
    $mgrToken = JWT::encode([
        'username' => 'perm_mgr_' . $suffix,
        'email' => $mgrEmail,
        'role' => 'manager',
        'user_id' => $mgrUserId,
        'id' => $mgrUserId,
        'tenant_id' => $tenantId
    ]);

    $sales1Token = JWT::encode([
        'username' => 'perm_s1_' . $suffix,
        'email' => $sales1Email,
        'role' => 'sales',
        'user_id' => $sales1UserId,
        'id' => $sales1UserId,
        'tenant_id' => $tenantId
    ]);

    $sales2Token = JWT::encode([
        'username' => 'perm_s2_' . $suffix,
        'email' => $sales2Email,
        'role' => 'sales',
        'user_id' => $sales2UserId,
        'id' => $sales2UserId,
        'tenant_id' => $tenantId
    ]);

    // Test 1: get_consultants
    $resConsultants = $callApi('get_consultants', 'GET', [], $mgrToken);
    $consultantsData = $resConsultants['data'] ?? [];
    $hasS1 = false; $hasS2 = false;
    foreach ($consultantsData as $c) {
        if ((int)$c['id'] === $sales1UserId) $hasS1 = true;
        if ((int)$c['id'] === $sales2UserId) $hasS2 = true;
    }
    assertPermTest(
        "Manager: get_consultants should only return team members",
        $hasS1 && !$hasS2,
        "Has S1: " . ($hasS1 ? 'Yes' : 'No') . ", Has S2: " . ($hasS2 ? 'Yes' : 'No') . ", Response: " . json_encode($resConsultants, JSON_UNESCAPED_UNICODE)
    );

    // Create data reports (tickets)
    // S1 report
    $db->prepare("INSERT INTO leads (name, phone, email, assigned_to) VALUES ('Lead S1', '0912345678', 's1@lead.net', ?)")
       ->execute([$sales1UserId]);
    $leadS1Id = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, status) VALUES (?, ?, 1, 'Fake phone number', 'pending')")
       ->execute([$leadS1Id, $sales1UserId]);
    $repS1Id = (int)$db->lastInsertId();

    // S2 report
    $db->prepare("INSERT INTO leads (name, phone, email, assigned_to) VALUES ('Lead S2', '0987654321', 's2@lead.net', ?)")
       ->execute([$sales2UserId]);
    $leadS2Id = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, status) VALUES (?, ?, 1, 'Spam mail', 'pending')")
       ->execute([$leadS2Id, $sales2UserId]);
    $repS2Id = (int)$db->lastInsertId();

    // Test 2: get_reports
    $resReports = $callApi('get_reports', 'GET', ['status' => 'pending', 'date' => 'all'], $mgrToken);
    $reportsData = $resReports['data'] ?? [];
    $hasRepS1 = false; $hasRepS2 = false;
    foreach ($reportsData as $r) {
        if ((int)$r['id'] === $repS1Id) $hasRepS1 = true;
        if ((int)$r['id'] === $repS2Id) $hasRepS2 = true;
    }
    assertPermTest(
        "Manager: get_reports should only return team members reports",
        $hasRepS1 && !$hasRepS2,
        "Has S1 Report: " . ($hasRepS1 ? 'Yes' : 'No') . ", Has S2 Report: " . ($hasRepS2 ? 'Yes' : 'No')
    );

    // Test 3: approve_report
    $resApproveS1 = $callApi('approve_report', 'POST', ['id' => $repS1Id, 'approval_reason' => 'Valid team check', 'no_compensation' => true], $mgrToken);
    $resApproveS2 = $callApi('approve_report', 'POST', ['id' => $repS2Id, 'approval_reason' => 'Invalid check', 'no_compensation' => true], $mgrToken);
    assertPermTest(
        "Manager: approve_report should only allow team members reports",
        isset($resApproveS1['success']) && $resApproveS1['success'] === true && isset($resApproveS2['success']) && $resApproveS2['success'] === false,
        "S1 Approve: " . json_encode($resApproveS1, JSON_UNESCAPED_UNICODE) . ", S2 Approve: " . json_encode($resApproveS2, JSON_UNESCAPED_UNICODE)
    );

    // Reset status of S2 report back to pending to test reject
    $db->prepare("UPDATE data_reports SET status = 'pending' WHERE id = ?")->execute([$repS2Id]);

    // Test 4: reject_report
    // We create another pending S1 report to test valid reject
    $db->prepare("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, status) VALUES (?, ?, 1, 'Fake phone number 2', 'pending')")
       ->execute([$leadS1Id, $sales1UserId]);
    $repS1Id_2 = (int)$db->lastInsertId();
    $resRejectS1_2 = $callApi('reject_report', 'POST', ['id' => $repS1Id_2, 'reject_reason' => 'Valid reject reason'], $mgrToken);
    $resRejectS2 = $callApi('reject_report', 'POST', ['id' => $repS2Id, 'reject_reason' => 'Invalid team reject'], $mgrToken); // not in team, should fail manager check

    assertPermTest(
        "Manager: reject_report should only allow team members reports",
        isset($resRejectS1_2['success']) && $resRejectS1_2['success'] === true && isset($resRejectS2['success']) && $resRejectS2['success'] === false,
        "S1 Reject: " . json_encode($resRejectS1_2, JSON_UNESCAPED_UNICODE) . ", S2 Reject: " . json_encode($resRejectS2, JSON_UNESCAPED_UNICODE)
    );

    // Create distribution logs for reassign / block tests
    $db->prepare("INSERT INTO distribution_logs (lead_id, round_id, assigned_to, status) VALUES (?, 1, ?, 'assigned')")
       ->execute([$leadS1Id, $sales1UserId]);
    $logS1Id = (int)$db->lastInsertId();

    $db->prepare("INSERT INTO distribution_logs (lead_id, round_id, assigned_to, status) VALUES (?, 1, ?, 'assigned')")
       ->execute([$leadS2Id, $sales2UserId]);
    $logS2Id = (int)$db->lastInsertId();

    // Test 5: reassign_lead
    $resReassignS1 = $callApi('reassign_lead', 'POST', ['log_id' => $logS1Id, 'new_consultant_id' => $sales1UserId], $mgrToken);
    $resReassignS2 = $callApi('reassign_lead', 'POST', ['log_id' => $logS2Id, 'new_consultant_id' => $sales1UserId], $mgrToken);
    assertPermTest(
        "Manager: reassign_lead should only allow team members leads",
        isset($resReassignS1['success']) && $resReassignS1['success'] === true && isset($resReassignS2['success']) && $resReassignS2['success'] === false,
        "S1 Reassign: " . json_encode($resReassignS1, JSON_UNESCAPED_UNICODE) . ", S2 Reassign: " . json_encode($resReassignS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 6: block_lead
    $resBlockS1 = $callApi('block_lead', 'POST', ['log_id' => $logS1Id, 'reason' => 'Team lead blacklist'], $mgrToken);
    $resBlockS2 = $callApi('block_lead', 'POST', ['log_id' => $logS2Id, 'reason' => 'Out team blacklist'], $mgrToken);
    assertPermTest(
        "Manager: block_lead should only allow team members leads",
        isset($resBlockS1['success']) && $resBlockS1['success'] === true && isset($resBlockS2['success']) && $resBlockS2['success'] === false,
        "S1 Block: " . json_encode($resBlockS1, JSON_UNESCAPED_UNICODE) . ", S2 Block: " . json_encode($resBlockS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 7: update_lead_fields
    $resUpdateS1 = $callApi('update_lead_fields', 'POST', ['lead_id' => $leadS1Id, 'name' => 'Updated Lead S1'], $mgrToken);
    $resUpdateS2 = $callApi('update_lead_fields', 'POST', ['lead_id' => $leadS2Id, 'name' => 'Updated Lead S2'], $mgrToken);
    assertPermTest(
        "Manager: update_lead_fields should only allow team members leads",
        isset($resUpdateS1['success']) && $resUpdateS1['success'] === true && isset($resUpdateS2['success']) && $resUpdateS2['success'] === false,
        "S1 Update: " . json_encode($resUpdateS1, JSON_UNESCAPED_UNICODE) . ", S2 Update: " . json_encode($resUpdateS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 8: send_lead_reminder
    $resReminderS1 = $callApi('send_lead_reminder', 'POST', ['lead_id' => $leadS1Id, 'send_email' => true], $mgrToken);
    $resReminderS2 = $callApi('send_lead_reminder', 'POST', ['lead_id' => $leadS2Id, 'send_email' => true], $mgrToken);
    assertPermTest(
        "Manager: send_lead_reminder should only allow team members leads",
        isset($resReminderS1['success']) && $resReminderS1['success'] === true && isset($resReminderS2['success']) && $resReminderS2['success'] === false,
        "S1 Reminder: " . json_encode($resReminderS1, JSON_UNESCAPED_UNICODE) . ", S2 Reminder: " . json_encode($resReminderS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 9: get_consultant_stats
    $resStatsS1 = $callApi('get_consultant_stats&consultant_id=' . $sales1UserId . '&date_mode=all', 'GET', [], $mgrToken);
    $resStatsS2 = $callApi('get_consultant_stats&consultant_id=' . $sales2UserId . '&date_mode=all', 'GET', [], $mgrToken);
    assertPermTest(
        "Manager: get_consultant_stats should only allow team members",
        isset($resStatsS1['success']) && $resStatsS1['success'] === true && isset($resStatsS2['success']) && $resStatsS2['success'] === false,
        "S1 Stats: " . json_encode($resStatsS1, JSON_UNESCAPED_UNICODE) . ", S2 Stats: " . json_encode($resStatsS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 10: get_consultant_leaves
    $resLeavesS1 = $callApi('get_consultant_leaves&consultant_id=' . $sales1UserId, 'GET', [], $mgrToken);
    $resLeavesS2 = $callApi('get_consultant_leaves&consultant_id=' . $sales2UserId, 'GET', [], $mgrToken);
    assertPermTest(
        "Manager: get_consultant_leaves should only allow team members",
        isset($resLeavesS1['success']) && $resLeavesS1['success'] === true && isset($resLeavesS2['success']) && $resLeavesS2['success'] === false,
        "S1 Leaves: " . json_encode($resLeavesS1, JSON_UNESCAPED_UNICODE) . ", S2 Leaves: " . json_encode($resLeavesS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 11: add_consultant_leave
    $resAddLeaveS1 = $callApi('add_consultant_leave', 'POST', ['consultant_id' => $sales1UserId, 'start_date' => '2026-12-01', 'end_date' => '2026-12-05'], $mgrToken);
    $resAddLeaveS2 = $callApi('add_consultant_leave', 'POST', ['consultant_id' => $sales2UserId, 'start_date' => '2026-12-01', 'end_date' => '2026-12-05'], $mgrToken);
    assertPermTest(
        "Manager: add_consultant_leave should only allow team members",
        isset($resAddLeaveS1['success']) && $resAddLeaveS1['success'] === true && isset($resAddLeaveS2['success']) && $resAddLeaveS2['success'] === false,
        "S1 Add Leave: " . json_encode($resAddLeaveS1, JSON_UNESCAPED_UNICODE) . ", S2 Add Leave: " . json_encode($resAddLeaveS2, JSON_UNESCAPED_UNICODE)
    );

    // Fetch the leave ID of S1 to test delete
    $leaveRow = $db->query("SELECT id FROM consultant_leaves WHERE consultant_id = $sales1UserId LIMIT 1")->fetch();
    $leaveS1Id = $leaveRow ? (int)$leaveRow['id'] : 0;

    // We also temporarily insert a leave for S2 using direct DB to test unauthorized delete
    $db->prepare("INSERT INTO consultant_leaves (consultant_id, start_date, end_date) VALUES (?, '2026-12-01', '2026-12-05')")
       ->execute([$sales2UserId]);
    $leaveS2Id = (int)$db->lastInsertId();

    // Test 12: delete_consultant_leave
    $resDelLeaveS1 = $callApi('delete_consultant_leave', 'POST', ['id' => $leaveS1Id], $mgrToken);
    $resDelLeaveS2 = $callApi('delete_consultant_leave', 'POST', ['id' => $leaveS2Id], $mgrToken);
    assertPermTest(
        "Manager: delete_consultant_leave should only allow team members",
        isset($resDelLeaveS1['success']) && $resDelLeaveS1['success'] === true && isset($resDelLeaveS2['success']) && $resDelLeaveS2['success'] === false,
        "S1 Del Leave: " . json_encode($resDelLeaveS1, JSON_UNESCAPED_UNICODE) . ", S2 Del Leave: " . json_encode($resDelLeaveS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 13: toggle_consultant_vacation
    $resToggleS1 = $callApi('toggle_consultant_vacation', 'POST', ['id' => $sales1UserId], $mgrToken);
    $resToggleS2 = $callApi('toggle_consultant_vacation', 'POST', ['id' => $sales2UserId], $mgrToken);
    assertPermTest(
        "Manager: toggle_consultant_vacation should only allow team members",
        isset($resToggleS1['success']) && $resToggleS1['success'] === true && isset($resToggleS2['success']) && $resToggleS2['success'] === false,
        "S1 Toggle: " . json_encode($resToggleS1, JSON_UNESCAPED_UNICODE) . ", S2 Toggle: " . json_encode($resToggleS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 14: get_consultant_compensation_details
    $resCompS1 = $callApi('get_consultant_compensation_details&consultant_id=' . $sales1UserId, 'GET', [], $mgrToken);
    $resCompS2 = $callApi('get_consultant_compensation_details&consultant_id=' . $sales2UserId, 'GET', [], $mgrToken);
    assertPermTest(
        "Manager: get_consultant_compensation_details should only allow team members",
        isset($resCompS1['success']) && $resCompS1['success'] === true && isset($resCompS2['success']) && $resCompS2['success'] === false,
        "S1 Comp: " . json_encode($resCompS1, JSON_UNESCAPED_UNICODE) . ", S2 Comp: " . json_encode($resCompS2, JSON_UNESCAPED_UNICODE)
    );

    // Test 15: Unauthorized check - get_consultants without token
    $resUnauthConsultants = $callApi('get_consultants', 'GET', [], '');
    assertPermTest(
        "Unauthorized: get_consultants without token should fail",
        isset($resUnauthConsultants['success']) && $resUnauthConsultants['success'] === false,
        "Response: " . json_encode($resUnauthConsultants, JSON_UNESCAPED_UNICODE)
    );

    // Test 16: Unauthorized check - dashboard/stats without token
    $resUnauthStats = $callApi('dashboard/stats', 'GET', [], '');
    assertPermTest(
        "Unauthorized: dashboard/stats without token should fail",
        isset($resUnauthStats['success']) && $resUnauthStats['success'] === false,
        "Response: " . json_encode($resUnauthStats, JSON_UNESCAPED_UNICODE)
    );

    // Test 17: Unauthorized check - contacts list without token
    $resUnauthContacts = $callApi('contacts', 'GET', [], '');
    assertPermTest(
        "Unauthorized: contacts without token should fail",
        isset($resUnauthContacts['success']) && $resUnauthContacts['success'] === false,
        "Response: " . json_encode($resUnauthContacts, JSON_UNESCAPED_UNICODE)
    );

    // Test 18: Unauthorized check - projects list without token
    $resUnauthProjects = $callApi('projects', 'GET', [], '');
    assertPermTest(
        "Unauthorized: projects without token should fail",
        isset($resUnauthProjects['success']) && $resUnauthProjects['success'] === false,
        "Response: " . json_encode($resUnauthProjects, JSON_UNESCAPED_UNICODE)
    );

    // Test 19: Unauthorized check - products list without token
    $resUnauthProducts = $callApi('products', 'GET', [], '');
    assertPermTest(
        "Unauthorized: products without token should fail",
        isset($resUnauthProducts['success']) && $resUnauthProducts['success'] === false,
        "Response: " . json_encode($resUnauthProducts, JSON_UNESCAPED_UNICODE)
    );

    // Test 20: Invalid Token check - calling with invalid bearer token signature
    $resInvalidToken = $callApi('contacts', 'GET', [], 'invalid_token_signature_123');
    assertPermTest(
        "Unauthorized: Invalid Token signature should fail",
        isset($resInvalidToken['success']) && $resInvalidToken['success'] === false,
        "Response: " . json_encode($resInvalidToken, JSON_UNESCAPED_UNICODE)
    );

    // Test 21: Undefined Action check - calling non-existent endpoint
    $resUndefinedAction = $callApi('non_existent_action_xyz', 'GET', [], $salesToken);
    assertPermTest(
        "API: Non-existent action should fail gracefully",
        isset($resUndefinedAction['success']) && $resUndefinedAction['success'] === false,
        "Response: " . json_encode($resUndefinedAction, JSON_UNESCAPED_UNICODE)
    );

    // Test 22: HR Documents (consultant_*) category isolation for Sales
    // We insert a mock file belonging to Sales 1 with category 'consultant_([sales1UserId])'
    $db->prepare("INSERT INTO cloud_files (tenant_id, uploaded_by, name, file_path, mime_type, file_size, category, visibility) VALUES (?, ?, 'HR Doc S1', 'uploads/cloud/1/test_s1.pdf', 'application/pdf', 1024, ?, 'shared')")
       ->execute([$tenantId, $adminUserId, 'consultant_' . $sales1UserId]);
    $fileS1Id = (int)$db->lastInsertId();

    // S1 requests files: should see their own HR Doc
    $resS1List = $callApi('cloud-files', 'GET', [], $sales1Token);
    $s1Files = $resS1List['data']['items'] ?? [];
    $hasSelfFile = false;
    foreach ($s1Files as $f) {
        if ((int)$f['id'] === $fileS1Id) $hasSelfFile = true;
    }

    // S2 requests files: should NOT see Sales 1's HR Doc
    $resS2List = $callApi('cloud-files', 'GET', [], $sales2Token);
    $s2Files = $resS2List['data']['items'] ?? [];
    $hasOtherFile = false;
    foreach ($s2Files as $f) {
        if ((int)$f['id'] === $fileS1Id) $hasOtherFile = true;
    }

    assertPermTest(
        "HR Documents: Sales can only view their own consultant_* documents",
        $hasSelfFile && !$hasOtherFile,
        "S1 Has Self: " . ($hasSelfFile ? 'Yes' : 'No') . ", S2 Has Other: " . ($hasOtherFile ? 'Yes' : 'No') . ", S1 Resp: " . json_encode($resS1List, JSON_UNESCAPED_UNICODE)
    );

    // Test 23: HR Documents: Sales cannot upload, edit, or delete consultant_* files
    // S1 tries to upload a file with category consultant_s2
    $resS1UploadOther = $callApi('cloud-files', 'POST', ['category' => 'consultant_' . $sales2UserId, 'name' => 'Hack.pdf'], $sales1Token);
    // S1 tries to delete the file
    $resS1Delete = $callApi("cloud-files/$fileS1Id", 'DELETE', [], $sales1Token);

    assertPermTest(
        "HR Documents: Sales cannot upload or delete consultant_* documents",
        $resS1UploadOther['http_status_code'] === 403 && $resS1Delete['http_status_code'] === 403,
        "S1 Upload Code: {$resS1UploadOther['http_status_code']}, S1 Delete Code: {$resS1Delete['http_status_code']}"
    );

    // Test 24: Quotes Access Isolation for Sales
    $quotePayload = [
        'title' => 'E2E Quote S1 ' . $suffix,
        'total' => 15000000.00,
        'status' => 'draft'
    ];
    $resS1QuoteCreate = $callApi('quotes', 'POST', $quotePayload, $sales1Token);
    $quoteId = isset($resS1QuoteCreate['data']['id']) ? (int)$resS1QuoteCreate['data']['id'] : 0;
    if ($quoteId === 0) {
        $quoteId = (int)$db->query("SELECT id FROM quotes ORDER BY id DESC LIMIT 1")->fetchColumn();
    }

    $resS1QuoteShow = $callApi("quotes/$quoteId", 'GET', [], $sales1Token);
    $resS2QuoteShow = $callApi("quotes/$quoteId", 'GET', [], $sales2Token);

    assertPermTest(
        "Quotes: Access isolation for Sales",
        isset($resS1QuoteShow['success']) && $resS1QuoteShow['success'] === true && isset($resS2QuoteShow['success']) && $resS2QuoteShow['success'] === false,
        "S1 Show Code: " . ($resS1QuoteShow['http_status_code'] ?? 'null') . ", S2 Show Code: " . ($resS2QuoteShow['http_status_code'] ?? 'null')
    );

    // Test 25: Quotes Update/Delete constraints for Sales
    $resS1QuoteDelete = $callApi("quotes/$quoteId", 'DELETE', [], $sales1Token);
    $resS2QuoteUpdate = $callApi("quotes/$quoteId", 'PUT', ['title' => 'Hack Quote'], $sales2Token);

    assertPermTest(
        "Quotes: Sales cannot delete owned quotes or edit other's quotes",
        $resS1QuoteDelete['http_status_code'] === 403 && $resS2QuoteUpdate['http_status_code'] === 404,
        "S1 Delete Code: {$resS1QuoteDelete['http_status_code']}, S2 Update Code: {$resS2QuoteUpdate['http_status_code']}"
    );

    // Test 26: Quotes Role restrictions
    $resViewerQuoteCreate = $callApi('quotes', 'POST', $quotePayload, $viewerToken);
    assertPermTest(
        "Quotes: Viewer role cannot create quotes",
        $resViewerQuoteCreate['http_status_code'] === 403,
        "Viewer Create Code: {$resViewerQuoteCreate['http_status_code']}"
    );

    // Clean up temporary DB records
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");
    $db->prepare("DELETE FROM users WHERE id IN (?, ?, ?, ?, ?, ?)")->execute([$salesUserId, $viewerUserId, $adminUserId, $mgrUserId, $sales1UserId, $sales2UserId]);
    $db->prepare("DELETE FROM teams WHERE id = ?")->execute([$teamId]);
    $db->prepare("DELETE FROM leads WHERE id IN (?, ?)")->execute([$leadS1Id, $leadS2Id]);
    $db->prepare("DELETE FROM consultant_leaves WHERE consultant_id IN (?, ?)")->execute([$sales1UserId, $sales2UserId]);
    $db->prepare("DELETE FROM data_reports WHERE id IN (?, ?, ?)")->execute([$repS1Id, $repS2Id, $repS1Id_2]);
    $db->prepare("DELETE FROM distribution_logs WHERE id IN (?, ?)")->execute([$logS1Id, $logS2Id]);
    $db->prepare("DELETE FROM cloud_files WHERE id = ?")->execute([$fileS1Id]);
    $db->prepare("DELETE FROM quotes WHERE id = ?")->execute([$quoteId]);
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
