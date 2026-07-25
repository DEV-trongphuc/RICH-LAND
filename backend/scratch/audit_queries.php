<?php
// backend/scratch/audit_queries.php

// Enable all error reporting
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "=== STATIC ANALYSIS: DATABASE SCHEMA AUDIT VS CODEBASE ===\n\n";

$schemaFile = __DIR__ . '/../db_schema.json';
if (!file_exists($schemaFile)) {
    echo "❌ Error: db_schema.json not found. Please run dump_schema.php first.\n";
    exit(1);
}

$schemaData = json_decode(file_get_contents($schemaFile), true);
if (!$schemaData || !isset($schemaData['schema'])) {
    echo "❌ Error: Failed to parse db_schema.json.\n";
    exit(1);
}

$dbSchema = []; // table_name => [col1, col2, ...]
foreach ($schemaData['schema'] as $tableName => $cols) {
    $dbSchema[$tableName] = array_map(function($c) {
        return strtolower($c['field']);
    }, $cols);
}

echo "Loaded " . count($dbSchema) . " tables from schema dump.\n\n";

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

echo "Scanning " . count($phpFiles) . " PHP files for SQL query mismatches...\n";
echo "---------------------------------------------------------\n";

$totalIssues = 0;

foreach ($phpFiles as $file) {
    $content = file_get_contents($file);
    $lines = explode("\n", $content);
    $relPath = str_replace(realpath($backendDir) . DIRECTORY_SEPARATOR, '', $file);
    
    // Pattern 1: INSERT INTO table (col1, col2)
    preg_match_all('/INSERT\s+INTO\s+([a-zA-Z0-9_`]+)\s*\(([^)]+)\)/i', $content, $matchesInsert, PREG_OFFSET_CAPTURE);
    if (!empty($matchesInsert[0])) {
        foreach ($matchesInsert[0] as $matchIdx => $match) {
            $tableName = trim($matchesInsert[1][$matchIdx][0], '` ');
            $colsStr = $matchesInsert[2][$matchIdx][0];
            $offset = $match[1];
            $lineNo = substr_count(substr($content, 0, $offset), "\n") + 1;
            
            if (!isset($dbSchema[$tableName])) {
                // Check case-insensitive table name
                $foundTable = false;
                foreach ($dbSchema as $tName => $tCols) {
                    if (strcasecmp($tName, $tableName) === 0) {
                        $tableName = $tName;
                        $foundTable = true;
                        break;
                    }
                }
                if (!$foundTable) {
                    // Skip if it looks like a variable table name or expression
                    if (strpos($tableName, '$') === false) {
                        echo "⚠️  $relPath:L$lineNo - Table '$tableName' in INSERT does not exist in database.\n";
                        $totalIssues++;
                    }
                    continue;
                }
            }
            
            // Extract column names
            $columns = array_map(function($c) {
                return trim($c, '` ');
            }, explode(',', $colsStr));
            
            foreach ($columns as $col) {
                if (empty($col) || strpos($col, '$') !== false || strpos($col, '?') !== false) continue;
                if (!in_array(strtolower($col), $dbSchema[$tableName])) {
                    echo "❌ $relPath:L$lineNo - INSERT refers to non-existent column '$col' in table '$tableName'.\n";
                    $totalIssues++;
                }
            }
        }
    }

    // Pattern 2: UPDATE table SET col1 = ..., col2 = ...
    preg_match_all('/UPDATE\s+([a-zA-Z0-9_`]+)\s+SET\s+([^;\n\r"]+)/i', $content, $matchesUpdate, PREG_OFFSET_CAPTURE);
    if (!empty($matchesUpdate[0])) {
        foreach ($matchesUpdate[0] as $matchIdx => $match) {
            $tableName = trim($matchesUpdate[1][$matchIdx][0], '` ');
            $setBlock = $matchesUpdate[2][$matchIdx][0];
            $offset = $match[1];
            $lineNo = substr_count(substr($content, 0, $offset), "\n") + 1;
            
            if (!isset($dbSchema[$tableName])) {
                $foundTable = false;
                foreach ($dbSchema as $tName => $tCols) {
                    if (strcasecmp($tName, $tableName) === 0) {
                        $tableName = $tName;
                        $foundTable = true;
                        break;
                    }
                }
                if (!$foundTable) {
                    if (strpos($tableName, '$') === false) {
                        echo "⚠️  $relPath:L$lineNo - Table '$tableName' in UPDATE does not exist in database.\n";
                        $totalIssues++;
                    }
                    continue;
                }
            }
            
            // Find all columns assigned in SET clause
            preg_match_all('/([a-zA-Z0-9_`]+)\s*=/i', $setBlock, $matchesCols);
            if (!empty($matchesCols[1])) {
                foreach ($matchesCols[1] as $col) {
                    $col = trim($col, '` ');
                    if (empty($col) || is_numeric($col) || strpos($col, '$') !== false) continue;
                    // Ignore SQL keywords
                    if (in_array(strtoupper($col), ['AND', 'OR', 'NOT', 'IN', 'SET', 'WHERE', 'CASE', 'WHEN'])) continue;
                    if (!in_array(strtolower($col), $dbSchema[$tableName])) {
                        echo "❌ $relPath:L$lineNo - UPDATE refers to non-existent column '$col' in table '$tableName'.\n";
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
            $tableName = trim($matchesSelect[2][$matchIdx][0], '` ');
            $offset = $match[1];
            $lineNo = substr_count(substr($content, 0, $offset), "\n") + 1;
            
            // Ignore if columns have functions like COUNT, SUM, MAX, MIN, or subqueries
            if (preg_match('/\b(count|sum|max|min|avg|coalesce|concat|now|date_sub|as)\b/i', $colsStr)) continue;
            
            if (!isset($dbSchema[$tableName])) {
                $foundTable = false;
                foreach ($dbSchema as $tName => $tCols) {
                    if (strcasecmp($tName, $tableName) === 0) {
                        $tableName = $tName;
                        $foundTable = true;
                        break;
                    }
                }
                if (!$foundTable) {
                    continue; // Skip unknown table in select (could be dynamic or SQL comment)
                }
            }
            
            $columns = array_map(function($c) {
                return trim($c, '` ');
            }, explode(',', $colsStr));
            
            foreach ($columns as $col) {
                if (empty($col) || $col === '*' || is_numeric($col) || strpos($col, '$') !== false) continue;
                if (!in_array(strtolower($col), $dbSchema[$tableName])) {
                    echo "❌ $relPath:L$lineNo - SELECT refers to non-existent column '$col' in table '$tableName'.\n";
                    $totalIssues++;
                }
            }
        }
    }
}

echo "---------------------------------------------------------\n";
echo "Scan complete. Total potential schema issues found: $totalIssues\n";
