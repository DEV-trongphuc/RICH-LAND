<?php
require_once __DIR__ . '/../test_bootstrap.php';

// Enable error reporting to catch any database exceptions
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    $schema = [];
    
    // Get all tables
    $tablesRes = $conn->query("SHOW TABLES");
    if (!$tablesRes) {
        throw new Exception("Failed to list tables: " . $conn->error);
    }
    
    while ($tRow = $tablesRes->fetch_row()) {
        $tableName = $tRow[0];
        
        // Get columns for this table
        $columnsRes = $conn->query("SHOW COLUMNS FROM `$tableName`");
        if (!$columnsRes) {
            continue;
        }
        
        $schema[$tableName] = [];
        while ($cRow = $columnsRes->fetch_assoc()) {
            $schema[$tableName][] = [
                'field' => $cRow['Field'],
                'type' => $cRow['Type'],
                'null' => $cRow['Null'],
                'key' => $cRow['Key'],
                'default' => $cRow['Default'],
                'extra' => $cRow['Extra']
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'schema' => $schema
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
