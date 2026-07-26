<?php
// backend/test_activities.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ActivityController.php';

if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        echo json_encode(['success' => $success, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
}

$auth = [
    'user_id' => 1,
    'role' => 'super_admin',
    'tenant_id' => 1
];

$_GET['limit'] = 5;
$_GET['page'] = 1;

$controller = new ActivityController($pdo);
try {
    echo "=== RUNNING ACTIVITIES INDEX TEST ===\n";
    $controller->index($auth);
    echo "\n=== TEST PASSED SUCCESSFULLY ===\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
