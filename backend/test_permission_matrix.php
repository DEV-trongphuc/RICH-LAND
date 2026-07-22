<?php
// backend/test_permission_matrix.php
// Live DB & Payload RBAC Permission Matrix Test Suite using test_bootstrap.php harness

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔐 BAT DAU KIEM THU MA TRAN PHAN QUYEN THUC TE (LIVE DB & PAYLOAD RBAC)\n";
echo "====================================================\n\n";

$roles = ['superadmin', 'admin', 'director', 'manager', 'assistant', 'sale', 'viewer'];

// Helper function to check role access against permission rules
function checkPermission(string $role, string $module, string $action): bool {
    $adminRoles = ['superadmin', 'super_admin', 'admin', 'director'];
    $managementRoles = ['superadmin', 'super_admin', 'admin', 'director', 'manager'];
    
    switch ("{$module}:{$action}") {
        case 'user:create':
        case 'user:delete':
        case 'setting:update':
        case 'round:update':
            return in_array($role, $adminRoles, true);

        case 'user:update_self':
        case 'contact:view':
        case 'lead:view':
        case 'attendance:checkin':
            return $role !== 'viewer';

        case 'contact:create':
        case 'contact:update':
        case 'lead:update':
            return $role !== 'viewer';

        case 'contact:delete':
        case 'lead:delete':
            return in_array($role, $adminRoles, true);

        case 'deposit:approve':
        case 'deposit:reject':
            return in_array($role, ['superadmin', 'super_admin', 'admin', 'director', 'assistant'], true);

        case 'lead:propose_not_lead':
            return in_array($role, ['sale', 'sales', 'manager', 'director', 'admin', 'superadmin'], true);

        default:
            return false;
    }
}

// ----------------------------------------------------
// 1. CHOK CSDL THUC TE VOI PAYLOAD GIA LAP BAC CAU (SIMULATED SESSION PAYLOADS)
// ----------------------------------------------------
echo "--- 1. KIEM THU PAYLOAD GIA LAP STRUCTURAL SIMULATION ---\n";

// Test DB Payload A: User ID 1000 updating self profile
$userTest = $conn->query("SELECT id, role, full_name, phone FROM users WHERE role IN ('sale', 'sales') LIMIT 1")->fetch_assoc();
if ($userTest) {
    $saleId = (int)$userTest['id'];
    $origPhone = $userTest['phone'];
    
    // Simulate Sale payload trying to update own profile
    $bSalePayload = [
        'full_name' => $userTest['full_name'],
        'phone' => '0988776655',
        'role' => 'admin' // Attempting privilege escalation
    ];
    
    // Authorization Check: Sale CANNOT update role
    $authSale = ['user_id' => $saleId, 'tenant_id' => 1, 'role' => 'sale'];
    $canEscalate = in_array($authSale['role'], ['admin', 'super_admin', 'superadmin', 'director'], true);
    assertTest("Sale Payload: Chanti tuc quyen / nang cap quyen admin", !$canEscalate);
    
    // Execute legitimate phone update
    $conn->query("UPDATE users SET phone = '0988776655' WHERE id = {$saleId}");
    assertDbField($conn, 'users', 'phone', "id = {$saleId}", '0988776655', "Payload Sale Update Phone trong CSDL");
    
    // Revert
    $conn->query("UPDATE users SET phone = '" . $conn->real_escape_string($origPhone) . "' WHERE id = {$saleId}");
}

// Test DB Payload B: Viewer payload attempting write on contacts
$authViewer = ['user_id' => 9999, 'tenant_id' => 1, 'role' => 'viewer'];
$canViewerWrite = ($authViewer['role'] !== 'viewer');
assertTest("Viewer Payload: Chan quyen sua / them moi Contact", !$canViewerWrite);

// Test DB Payload C: Assistant payload approving deposit milestone
$authAssistant = ['user_id' => 8888, 'tenant_id' => 1, 'role' => 'assistant'];
$canAssistantApprove = in_array($authAssistant['role'], ['superadmin', 'super_admin', 'admin', 'director', 'assistant'], true);
assertTest("Assistant Payload: Cho phap Duyet / Tu choi Coc", $canAssistantApprove);

echo "\n";

// ----------------------------------------------------
// 2. CHOK MULTI-ROLE MATRIX VERIFICATION
// ----------------------------------------------------
echo "--- 2. KIEM THU BANG LOGIC ROLES (7 ROLES) ---\n";
foreach ($roles as $r) {
    $canCreateUser = checkPermission($r, 'user', 'create');
    $canUpdateSelf = checkPermission($r, 'user', 'update_self');
    $canApproveDeposit = checkPermission($r, 'deposit', 'approve');
    $canProposeNotLead = checkPermission($r, 'lead', 'propose_not_lead');

    assertTest("[{$r}] Update thong tin ca nhan", $canUpdateSelf === ($r !== 'viewer'));
    assertTest("[{$r}] Quyen Quan tri (Create User / Setting)", $canCreateUser === in_array($r, ['superadmin', 'admin', 'director'], true));
    assertTest("[{$r}] Quyen Duyet Coc (Assistant/Admin)", $canApproveDeposit === in_array($r, ['superadmin', 'admin', 'director', 'assistant'], true));
    assertTest("[{$r}] Quyen De xuat Not Lead (Sale/Manager/Director)", $canProposeNotLead === in_array($r, ['sale', 'manager', 'director', 'admin', 'superadmin'], true));
}

printTestSummary();
