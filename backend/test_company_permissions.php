<?php
// backend/test_company_permissions.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/CompanyController.php';

echo "====================================================\n";
echo "🔐 RUNNING COMPANY PERMISSIONS AUDIT & TEST SUITE\n";
echo "====================================================\n\n";

// Helper subclass of CompanyController to test private/protected methods and override respond to not exit
class TestCompanyController extends CompanyController {
    public array $lastResponse = [];

    // Override respond simulation or use reflection to test getScope
    public function testGetScope(array $auth, string $action): string {
        $reflector = new ReflectionClass('CompanyController');
        $method = $reflector->getMethod('getScope');
        $method->setAccessible(true);
        return $method->invoke($this, $auth, $action);
    }
}

// Instantiate test controller
$testController = new TestCompanyController($pdo);

// Create a test user with custom permissions_json
$tenantId = 1;
$testUserId = 99999;

// Mock database connection update to create a dummy user or run mock tests
echo "--- 1. Testing Default Fallbacks (when permissions_json is empty) ---\n";

$authAdmin = ['user_id' => $testUserId, 'tenant_id' => $tenantId, 'role' => 'admin'];
$authDirector = ['user_id' => $testUserId, 'tenant_id' => $tenantId, 'role' => 'director'];
$authManager = ['user_id' => $testUserId, 'tenant_id' => $tenantId, 'role' => 'manager'];
$authSale = ['user_id' => $testUserId, 'tenant_id' => $tenantId, 'role' => 'sale'];
$authViewer = ['user_id' => $testUserId, 'tenant_id' => $tenantId, 'role' => 'viewer'];

// Delete any existing mock user first
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);

// Test 1.1: Admin default scope is 'all'
assertTest("Admin Read Scope is 'all'", $testController->testGetScope($authAdmin, 'read') === 'all');
assertTest("Admin Write Scope is 'all'", $testController->testGetScope($authAdmin, 'write') === 'all');
assertTest("Admin Delete Scope is 'all'", $testController->testGetScope($authAdmin, 'delete') === 'all');

// Test 1.2: Director default fallbacks
assertTest("Director Read Scope is 'all'", $testController->testGetScope($authDirector, 'read') === 'all');
assertTest("Director Write Scope is 'all'", $testController->testGetScope($authDirector, 'write') === 'all');
assertTest("Director Delete Scope is 'none'", $testController->testGetScope($authDirector, 'delete') === 'none');

// Test 1.3: Sale default fallbacks
assertTest("Sale Read Scope is 'all' (sales can view all partners)", $testController->testGetScope($authSale, 'read') === 'all');
assertTest("Sale Write Scope is 'none'", $testController->testGetScope($authSale, 'write') === 'none');
assertTest("Sale Delete Scope is 'none'", $testController->testGetScope($authSale, 'delete') === 'none');

echo "\n--- 2. Testing Custom Configuration (via permissions_json) ---\n";

// Insert dummy user with custom permissions JSON
$customPermissions = [
    'companies' => [
        'read' => 'own',
        'write' => 'team',
        'delete' => 'none'
    ]
];

$stmtInsert = $pdo->prepare("
    INSERT INTO users (id, tenant_id, role, email, full_name, is_active, permissions_json)
    VALUES (?, ?, 'sale', 'mock_permission_test@test.com', 'Mock Sales User', 1, ?)
");
$stmtInsert->execute([$testUserId, $tenantId, json_encode($customPermissions)]);

// Auth payload with mock user
$authMockUser = [
    'user_id' => $testUserId,
    'tenant_id' => $tenantId,
    'role' => 'sale'
];

assertTest("Custom User Read Scope resolves to 'own'", $testController->testGetScope($authMockUser, 'read') === 'own');
assertTest("Custom User Write Scope resolves to 'team'", $testController->testGetScope($authMockUser, 'write') === 'team');
assertTest("Custom User Delete Scope resolves to 'none'", $testController->testGetScope($authMockUser, 'delete') === 'none');

// Clean up mock user
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);

printTestSummary();
