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

    // Safety check: Read-only queries only
    if (!preg_match('/^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)/i', trim($query))) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Only read-only queries (SELECT, SHOW, DESCRIBE, EXPLAIN) are allowed.']);
        exit;
    }

    try {
        $stmt = $db->prepare($query);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $results]);
    } catch (Throwable $e) {
        http_response_code(500);
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

echo json_encode(['success' => true, 'message' => 'Diagnostic endpoint active. Use action=query or action=schema.']);
