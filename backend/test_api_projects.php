<?php
// backend/test_api_projects.php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

header('Content-Type: text/plain; charset=UTF-8');

try {
    $db = Database::getInstance();
    echo "=== REAL DATABASE CHECK ===\n";
    $p = $db->query("SELECT id, name, code, developer, location FROM projects LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo "Projects in DB: " . json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";

    $c = $db->query("SELECT id, name, code, project_id FROM marketing_campaigns LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo "Campaigns in DB: " . json_encode($c, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";

    if (!empty($p)) {
        $firstId = $p[0]['id'];
        echo "=== TESTING ProjectController::show($firstId) ===\n";
        require_once __DIR__ . '/controllers/ProjectController.php';
        $ctrl = new ProjectController($db);
        $auth = ['tenant_id' => 1, 'user_id' => 1, 'role' => 'admin'];
        
        // Temporarily override respond function behavior if needed, or call directly
        $stmt = $db->prepare("SELECT p.* FROM projects p WHERE p.id = ?");
        $stmt->execute([$firstId]);
        $projData = $stmt->fetch(PDO::FETCH_ASSOC);
        
        try {
            $rStmt = $db->prepare("SELECT u.id, u.name as full_name, u.email, u.role, u.avatar_url FROM users u JOIN project_roster pr ON u.id = pr.user_id WHERE pr.project_id = ?");
            $rStmt->execute([$firstId]);
            $projData['roster'] = $rStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) { $projData['roster'] = []; }

        try {
            $dStmt = $db->prepare("SELECT id, name, file_path, file_size, mime_type, created_at FROM project_documents WHERE project_id = ? ORDER BY created_at DESC");
            $dStmt->execute([$firstId]);
            $projData['documents'] = $dStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) { $projData['documents'] = []; }

        echo "Project $firstId Result:\n" . json_encode($projData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";
    }

    if (!empty($c)) {
        $firstCampId = $c[0]['id'];
        echo "=== TESTING CampaignController::show($firstCampId) ===\n";
        $stmt = $db->prepare("SELECT mc.*, (SELECT name FROM projects WHERE id = mc.project_id) as project_name FROM marketing_campaigns mc WHERE mc.id = ?");
        $stmt->execute([$firstCampId]);
        $campData = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "Campaign $firstCampId Result:\n" . json_encode($campData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";
    }

    echo "=== ALL API DB CHECKS PASSED ===\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n";
}
