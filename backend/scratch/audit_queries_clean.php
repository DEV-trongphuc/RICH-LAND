<?php
// backend/scratch/audit_queries_clean.php

// Enable all error reporting
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain; charset=utf-8');

echo "=== STATIC ANALYSIS: CLEAN DATABASE SCHEMA AUDIT VS CODEBASE ===\n\n";

$schemaFile = __DIR__ . '/../db_schema.json';
if (!file_exists($schemaFile)) {
    echo "❌ Error: db_schema.json not found.\n";
    exit(1);
}

$schemaData = json_decode(file_get_contents($schemaFile), true);
if (!$schemaData || !isset($schemaData['schema'])) {
    echo "❌ Error: Failed to parse db_schema.json.\n";
    exit(1);
}

$dbSchema = []; // table_name => [col1, col2, ...]
foreach ($schemaData['schema'] as $tableName => $cols) {
    $dbSchema[strtolower($tableName)] = array_map(function($c) {
        return strtolower(trim($c['field']));
    }, $cols);
}

// Scan directory recursively
function getPhpFiles($dir) {
    $files = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $path = $file->getRealPath();
            // Skip scratch, vendor, PHPMailer
            if (strpos($path, 'scratch') !== false || strpos($path, 'PHPMailer') !== false || strpos($path, 'vendor') !== false) {
                continue;
            }
            $files[] = $path;
        }
    }
    return $files;
}

$backendDir = __DIR__ . '/../';
$phpFiles = getPhpFiles($backendDir);

$totalIssues = 0;
$issues = [];

foreach ($phpFiles as $file) {
    $content = file_get_contents($file);
    $relPath = str_replace(realpath($backendDir) . DIRECTORY_SEPARATOR, '', $file);
    
    // Pattern 1: INSERT INTO table (col1, col2)
    preg_match_all('/INSERT\s+INTO\s+([a-zA-Z0-9_`]+)\s*\(([^)]+)\)/i', $content, $matchesInsert, PREG_OFFSET_CAPTURE);
    if (!empty($matchesInsert[0])) {
        foreach ($matchesInsert[0] as $matchIdx => $match) {
            $tableName = strtolower(trim($matchesInsert[1][$matchIdx][0], '` '));
            $colsStr = $matchesInsert[2][$matchIdx][0];
            $offset = $match[1];
            $lineNo = substr_count(substr($content, 0, $offset), "\n") + 1;
            
            if (!isset($dbSchema[$tableName])) {
                continue; // Skip dynamic tables or variables
            }
            
            // Clean columns list
            $columns = array_map(function($c) {
                return strtolower(trim($c, "` \t\r\n"));
            }, explode(',', $colsStr));
            
            foreach ($columns as $col) {
                if (empty($col) || strpos($col, '$') !== false || strpos($col, '?') !== false) continue;
                if (!in_array($col, $dbSchema[$tableName])) {
                    $issues[] = [
                        'file' => $relPath,
                        'line' => $lineNo,
                        'type' => 'INSERT',
                        'table' => $tableName,
                        'column' => $col,
                        'message' => "INSERT refers to non-existent column '$col' in table '$tableName'"
                    ];
                    $totalIssues++;
                }
            }
        }
    }

    // Pattern 2: UPDATE table SET col1 = ..., col2 = ...
    preg_match_all('/UPDATE\s+([a-zA-Z0-9_`]+)\s+SET\s+([^;\n\r"]+)/i', $content, $matchesUpdate, PREG_OFFSET_CAPTURE);
    if (!empty($matchesUpdate[0])) {
        foreach ($matchesUpdate[0] as $matchIdx => $match) {
            $tableName = strtolower(trim($matchesUpdate[1][$matchIdx][0], '` '));
            $setBlock = $matchesUpdate[2][$matchIdx][0];
            $offset = $match[1];
            $lineNo = substr_count(substr($content, 0, $offset), "\n") + 1;
            
            if (!isset($dbSchema[$tableName])) {
                continue;
            }
            
            preg_match_all('/([a-zA-Z0-9_`]+)\s*=/i', $setBlock, $matchesCols);
            if (!empty($matchesCols[1])) {
                foreach ($matchesCols[1] as $col) {
                    $col = strtolower(trim($col, "` \t\r\n"));
                    if (empty($col) || is_numeric($col) || strpos($col, '$') !== false) continue;
                    if (in_array(strtoupper($col), ['AND', 'OR', 'NOT', 'IN', 'SET', 'WHERE', 'CASE', 'WHEN'])) continue;
                    
                    if (!in_array($col, $dbSchema[$tableName])) {
                        $issues[] = [
                            'file' => $relPath,
                            'line' => $lineNo,
                            'type' => 'UPDATE',
                            'table' => $tableName,
                            'column' => $col,
                            'message' => "UPDATE refers to non-existent column '$col' in table '$tableName'"
                        ];
                        $totalIssues++;
                    }
                }
            }
        }
    }

    // Pattern 3: SELECT col1, col2 FROM table (simple queries)
    preg_match_all('/SELECT\s+([a-zA-Z0-9_`,\s]+)\s+FROM\s+([a-zA-Z0-9_`]+)/i', $content, $matchesSelect, PREG_OFFSET_CAPTURE);
    if (!empty($matchesSelect[0])) {
        foreach ($matchesSelect[0] as $matchIdx => $match) {
            $colsStr = $matchesSelect[1][$matchIdx][0];
            $tableName = strtolower(trim($matchesSelect[2][$matchIdx][0], '` '));
            $offset = $match[1];
            $lineNo = substr_count(substr($content, 0, $offset), "\n") + 1;
            
            if (preg_match('/\b(count|sum|max|min|avg|coalesce|concat|now|date_sub|as|distinct)\b/i', $colsStr)) continue;
            if (!isset($dbSchema[$tableName])) continue;
            
            $columns = array_map(function($c) {
                return strtolower(trim($c, "` \t\r\n"));
            }, explode(',', $colsStr));
            
            foreach ($columns as $col) {
                if (empty($col) || $col === '*' || is_numeric($col) || strpos($col, '$') !== false) continue;
                if (!in_array($col, $dbSchema[$tableName])) {
                    $issues[] = [
                        'file' => $relPath,
                        'line' => $lineNo,
                        'type' => 'SELECT',
                        'table' => $tableName,
                        'column' => $col,
                        'message' => "SELECT refers to non-existent column '$col' in table '$tableName'"
                    ];
                    $totalIssues++;
                }
            }
        }
    }
}

foreach ($issues as $iss) {
    echo "❌ [{$iss['type']}] {$iss['file']}:L{$iss['line']} - {$iss['message']}\n";
}

echo "---------------------------------------------------------\n";
echo "Scan complete. Real schema issues found: $totalIssues\n";
