<?php
// backend/test_api_projects.php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

header('Content-Type: text/plain; charset=UTF-8');

if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        echo json_encode(['code' => $code, 'success' => $success, 'message' => $message, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
}

try {
    $db = Database::getInstance();
    echo "=== REAL DATABASE CHECK ===\n";

    $p = $db->query("SELECT id, name, code, developer, location FROM projects LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo "Projects count in DB: " . count($p) . "\n";

    if (!empty($p)) {
        $firstId = $p[0]['id'];
        echo "\n=== TESTING ProjectController::show($firstId) ===\n";
        require_once __DIR__ . '/controllers/ProjectController.php';
        $ctrl = new ProjectController($db);
        $auth = ['tenant_id' => 1, 'user_id' => 1, 'role' => 'admin'];
        $ctrl->show($auth, (int)$firstId);
        echo "\n";
    }

    $c = $db->query("SELECT id, name, status, project_id FROM marketing_campaigns LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo "\nCampaigns count in DB: " . count($c) . "\n";
    if (!empty($c)) {
        $firstCampId = $c[0]['id'];
        echo "\n=== TESTING CampaignController::show($firstCampId) ===\n";
        require_once __DIR__ . '/controllers/CampaignController.php';
        $campCtrl = new CampaignController($db);
        $auth = ['tenant_id' => 1, 'user_id' => 1, 'role' => 'admin'];
        $campCtrl->show($auth, (int)$firstCampId);
        echo "\n";
    }

    echo "\n=== ALL TESTS SUCCESSFUL ===\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n";
}
