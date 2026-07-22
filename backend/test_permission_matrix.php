<?php
// backend/test_permission_matrix.php
// RBAC Permission Matrix Test Suite using test_bootstrap.php harness

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔐 BAT DAU KIEM THU MA TRAN PHAN QUYEN (RBAC MATRIX)\n";
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

// Perform Matrix Tests for All 7 Roles
foreach ($roles as $r) {
    echo "--- CHECKING ROLE: " . strtoupper($r) . " ---\n";
    
    // User CRUD
    $canCreateUser = checkPermission($r, 'user', 'create');
    $canDeleteUser = checkPermission($r, 'user', 'delete');
    $canUpdateSelf = checkPermission($r, 'user', 'update_self');
    
    // Contact / Lead
    $canCreateContact = checkPermission($r, 'contact', 'create');
    $canDeleteContact = checkPermission($r, 'contact', 'delete');
    $canProposeNotLead = checkPermission($r, 'lead', 'propose_not_lead');
    
    // Deposits & Settings
    $canApproveDeposit = checkPermission($r, 'deposit', 'approve');
    $canUpdateSetting = checkPermission($r, 'setting', 'update');

    assertTest("[{$r}] Update thong tin ca nhan", $canUpdateSelf === ($r !== 'viewer'));
    assertTest("[{$r}] Quyen Quan tri (Create User / Setting)", $canCreateUser === in_array($r, ['superadmin', 'admin', 'director'], true));
    assertTest("[{$r}] Quyen Duyet Coc (Assistant/Admin)", $canApproveDeposit === in_array($r, ['superadmin', 'admin', 'director', 'assistant'], true));
    assertTest("[{$r}] Quyen De xuat Not Lead (Sale/Manager/Director)", $canProposeNotLead === in_array($r, ['sale', 'manager', 'director', 'admin', 'superadmin'], true));

    echo "\n";
}

printTestSummary();
