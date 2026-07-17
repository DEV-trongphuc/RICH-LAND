<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'config.php';
require_once 'config/Database.php';
require_once 'controllers/ActivityController.php';

try {
    $db = Database::getInstance();
    $ctrl = new ActivityController($db);
    
    // Find a valid activity id to test
    $stmt = $db->query("SELECT id FROM activities WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1");
    $id = $stmt->fetchColumn();
    
    if (!$id) {
        echo json_encode(['error' => 'No activities found']);
        exit;
    }
    
    // Mock user session
    $auth = [
        'user_id' => 1007,
        'tenant_id' => 1,
        'role' => 'admin',
        'full_name' => 'Manager',
        'email' => 'manager@richland.net'
    ];
    
    // Capture stdout
    ob_start();
    $ctrl->show($auth, (int)$id);
    $output = ob_get_clean();
    
    echo json_encode([
        'activity_id' => $id,
        'output' => json_decode($output, true) ?: $output
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
