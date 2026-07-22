<?php
// backend/test_api_projects.php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

header('Content-Type: text/plain; charset=UTF-8');

try {
    $db = Database::getInstance();
    echo "=== REAL DATABASE SCHEMA CHECK ===\n";
    $projCols = $db->query("DESCRIBE projects")->fetchAll(PDO::FETCH_COLUMN);
    echo "Projects columns: " . implode(', ', $projCols) . "\n\n";

    $campCols = $db->query("DESCRIBE marketing_campaigns")->fetchAll(PDO::FETCH_COLUMN);
    echo "Marketing Campaigns columns: " . implode(', ', $campCols) . "\n\n";

    $p = $db->query("SELECT id, name, code, developer, location FROM projects LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo "Projects in DB: " . json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";

    if (!empty($p)) {
        $firstId = $p[0]['id'];
        echo "=== TESTING ProjectController::show($firstId) ===\n";
        require_once __DIR__ . '/controllers/ProjectController.php';
        $ctrl = new ProjectController($db);
        $auth = ['tenant_id' => 1, 'user_id' => 1, 'role' => 'admin'];
        
        ob_start();
        $ctrl->show($auth, (int)$firstId);
        $output = ob_get_clean();
        echo "ProjectController::show output:\n" . $output . "\n\n";
    }

    $c = $db->query("SELECT * FROM marketing_campaigns LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($c)) {
        $firstCampId = $c[0]['id'];
        echo "=== TESTING CampaignController::show($firstCampId) ===\n";
        require_once __DIR__ . '/controllers/CampaignController.php';
        $campCtrl = new CampaignController($db);
        $auth = ['tenant_id' => 1, 'user_id' => 1, 'role' => 'admin'];
        
        ob_start();
        $campCtrl->show($auth, (int)$firstCampId);
        $output2 = ob_get_clean();
        echo "CampaignController::show output:\n" . $output2 . "\n\n";
    }

    echo "=== ALL CHECKS COMPLETED SUCCESSFULLY ===\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n";
}
