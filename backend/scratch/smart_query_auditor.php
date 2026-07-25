<?php
// backend/scratch/smart_query_auditor.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain; charset=utf-8');

echo "=== SMART STATIC SQL AUDITOR: FULL CODEBASE AUDIT ===\n\n";

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

// Helper to recursively get files
function getPhpFiles($dir) {
    $files = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $path = $file->getRealPath();
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
    
    // Step 1: Tokenize PHP file to find string literals
    $tokens = token_get_all($content);
    $queries = [];
    
    foreach ($tokens as $token) {
        if (is_array($token)) {
            $tokenId = $token[0];
            $tokenContent = $token[1];
            $lineNo = $token[2];
            
            if ($tokenId === T_CONSTANT_ENCAPSED_STRING) {
                // Strip starting/ending quotes
                $str = substr($tokenContent, 1, -1);
                // Check if it looks like an SQL query
                $trimmed = trim($str);
                if (preg_match('/^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i', $trimmed)) {
                    $queries[] = [
                        'sql' => $trimmed,
                        'line' => $lineNo
                    ];
                }
            }
        }
    }
    
    // Step 2: Parse and validate SQL strings
    foreach ($queries as $qInfo) {
        $sql = $qInfo['sql'];
        $lineNo = $qInfo['line'];
        
        // Remove backticks, newlines, tabs, and duplicate spaces
        $sqlClean = str_replace(['`', "\r", "\n", "\t"], [' ', ' ', ' ', ' '], $sql);
        $sqlClean = preg_replace('/\s+/', ' ', $sqlClean);
        
        // --- 1. PARSE INSERT INTO queries ---
        if (preg_match('/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i', $sqlClean, $matches)) {
            $tableName = strtolower($matches[1]);
            $colsStr = $matches[2];
            
            if (isset($dbSchema[$tableName])) {
                $columns = array_map(function($c) {
                    return strtolower(trim($c));
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
        
        // --- 2. PARSE UPDATE queries ---
        elseif (preg_match('/^UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+)$/i', $sqlClean, $matches)) {
            $tableName = strtolower($matches[1]);
            $setBlock = $matches[2];
            
            // Strip WHERE clause if present
            if (preg_match('/^(.*?)\s+WHERE\s+/i', $setBlock, $wMatch)) {
                $setBlock = $wMatch[1];
            }
            
            if (isset($dbSchema[$tableName])) {
                // Find all LHS column assignments (e.g. col_name = ...)
                preg_match_all('/([a-zA-Z0-9_]+)\s*=/i', $setBlock, $matchesCols);
                if (!empty($matchesCols[1])) {
                    foreach ($matchesCols[1] as $col) {
                        $col = strtolower(trim($col));
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
        
        // --- 3. PARSE SELECT queries ---
        elseif (preg_match('/^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)/i', $sqlClean, $matches)) {
            $colsStr = $matches[1];
            $tableName = strtolower($matches[2]);
            
            if (preg_match('/\b(count|sum|max|min|avg|coalesce|concat|now|date_sub|as|distinct)\b/i', $colsStr)) continue;
            
            if (isset($dbSchema[$tableName])) {
                $columns = array_map(function($c) {
                    return strtolower(trim($c));
                }, explode(',', $colsStr));
                
                foreach ($columns as $col) {
                    if (empty($col) || $col === '*' || is_numeric($col) || strpos($col, '$') !== false || strpos($col, '.') !== false) continue;
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
}

// Print results
if ($totalIssues === 0) {
    echo "🎉 Excellent! No SQL schema conflicts found in any string literals!\n";
} else {
    foreach ($issues as $iss) {
        echo "❌ [{$iss['type']}] {$iss['file']}:L{$iss['line']} - {$iss['message']}\n";
    }
    echo "---------------------------------------------------------\n";
    echo "Smart scan complete. Real schema issues found: $totalIssues\n";
}
