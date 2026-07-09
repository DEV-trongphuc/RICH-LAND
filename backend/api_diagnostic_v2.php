<?php
// D:\RICH_LAND_DATA_UI\backend\api_diagnostic.php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Authentication check
define('DIAG_TOKEN', 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
$token = $_REQUEST['token'] ?? '';
if ($token !== DIAG_TOKEN) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden: Invalid token']);
    exit;
}

// 2. Load Database configuration
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

try {
    $db = Database::getInstance();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB Connection Failed: ' . $e->getMessage()]);
    exit;
}

$action = $_REQUEST['action'] ?? '';

if ($action === 'query') {
    $query = $_REQUEST['query'] ?? '';
    if (empty($query)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing query']);
        exit;
    }

    // Safety check: Allowing all queries for diagnostic and end-to-end testing phases (secured via token)

    try {
        $stmt = $db->prepare($query);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $results]);
    } catch (Throwable $e) {
        http_response_code(200);
        echo json_encode(['success' => false, 'message' => 'SQL Error: ' . $e->getMessage()]);
    }
    exit;
}

if ($action === 'schema') {
    try {
        $tablesStmt = $db->prepare("SHOW TABLES");
        $tablesStmt->execute();
        $tables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);
        
        $schema = [];
        foreach ($tables as $table) {
            $colsStmt = $db->prepare("DESCRIBE `$table`");
            $colsStmt->execute();
            $schema[$table] = $colsStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode(['success' => true, 'data' => $schema]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Schema Fetch Failed: ' . $e->getMessage()]);
    }
    exit;
}

if ($action === 'run_tests') {
    $code = file_get_contents(__DIR__ . '/audit_test_runner.php');
    if ($code === false) {
        echo json_encode(['success' => false, 'message' => 'Không thể đọc file audit_test_runner.php']);
        exit;
    }
    if (strpos($code, '<?php') === 0) {
        $code = substr($code, 5);
    }
    eval($code);
    exit;
}

if ($action === 'run_permission_tests') {
    $code = file_get_contents(__DIR__ . '/permission_test_runner.php');
    if ($code === false) {
        echo json_encode(['success' => false, 'message' => 'Không thể đọc file permission_test_runner.php']);
        exit;
    }
    if (strpos($code, '<?php') === 0) {
        $code = substr($code, 5);
    }
    eval($code);
    exit;
}

if ($action === 'run_task_tests') {
    $code = file_get_contents(__DIR__ . '/task_test_runner.php');
    if ($code === false) {
        echo json_encode(['success' => false, 'message' => 'Không thể đọc file task_test_runner.php']);
        exit;
    }
    if (strpos($code, '<?php') === 0) {
        $code = substr($code, 5);
    }
    eval($code);
    exit;
}

if ($action === 'reset_db') {
    require_once __DIR__ . '/run_reset_db.php';
    exit;
}

echo json_encode(['success' => true, 'message' => 'Diagnostic endpoint active. Use action=query, action=schema, action=run_tests, action=run_permission_tests, or action=reset_db.']);
