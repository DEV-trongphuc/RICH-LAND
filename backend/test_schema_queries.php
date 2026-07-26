<?php
// backend/test_schema_queries.php
require_once __DIR__ . '/test_bootstrap.php';

header("Content-Type: text/plain; charset=utf-8");

echo "====================================================\n";
echo "🔍 RUNNING REAL-TIME SCHEMA & QUERY AUDIT SCANNER\n";
echo "====================================================\n\n";

$passCount = 0;
$failCount = 0;
$skippedCount = 0;

// Helper to scan PHP files recursively
function getPhpFiles($dir) {
    $files = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $path = $file->getPathname();
            // Skip libraries, tests, and configuration files to focus on controllers/logic
            if (strpos($path, 'PHPMailer') !== false) continue;
            if (strpos($path, 'vendor') !== false) continue;
            if (strpos($path, 'test_') !== false) continue;
            if (basename($path) === 'db_connect.php') continue;
            if (basename($path) === 'config.php') continue;
            if (basename($path) === 'env.php') continue;
            $files[] = $path;
        }
    }
    return $files;
}

$files = getPhpFiles(__DIR__);
echo "Found " . count($files) . " PHP files to scan for SQL queries.\n\n";

foreach ($files as $file) {
    $content = file_get_contents($file);
    
    // Find strings containing SQL keywords
    preg_match_all('/(["\'])\s*(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b.*?\1/is', $content, $matches, PREG_OFFSET_CAPTURE);
    
    if (empty($matches[0])) continue;
    
    $relativeFile = str_replace(__DIR__, '', $file);
    echo "📄 Scanning file: {$relativeFile}\n";
    
    $fileLogged = false;
    foreach ($matches[0] as $matchData) {
        $rawQuery = $matchData[0];
        $offset = $matchData[1];
        
        // Calculate line number in file
        $lineNum = substr_count(substr($content, 0, $offset), "\n") + 1;
        
        // Clean quote wrapper
        $queryText = substr($rawQuery, 1, -1);
        
        // Clean up basic string concatenations and variables
        $queryText = preg_replace('/[\'"]\s*\.\s*\$[a-zA-Z0-9_]+(\->[a-zA-Z0-9_]+)?\s*\.\s*[\'"]/', 'mock_value', $queryText);
        $queryText = preg_replace('/\$[a-zA-Z0-9_]+(\->[a-zA-Z0-9_]+)?/', '1', $queryText);
        $queryText = preg_replace('/\{\$[a-zA-Z0-9_]+(\->[a-zA-Z0-9_]+)?\}/', '1', $queryText);
        $queryText = str_replace('?', '1', $queryText);
        $queryText = preg_replace('/:[a-zA-Z0-9_]+/', '1', $queryText);
        
        // Normalize dynamic list bindings like IN ($placeholders)
        $queryText = preg_replace('/IN\s*\(\s*\)/i', 'IN (1)', $queryText);
        $queryText = preg_replace('/IN\s*\(\s*1\s*(,\s*1\s*)*\)/i', 'IN (1)', $queryText);
        
        $queryText = trim($queryText);
        
        // Filter out short dynamic fragments
        if (strlen($queryText) < 20 || stripos($queryText, 'FROM') === false && stripos($queryText, 'UPDATE') === false && stripos($queryText, 'INSERT') === false) {
            $skippedCount++;
            continue;
        }
        
        try {
            $explainSql = "EXPLAIN " . $queryText;
            $stmt = @$conn->query($explainSql);
            if ($stmt) {
                $passCount++;
            } else {
                $failCount++;
                echo "  ❌ Line {$lineNum}: SQL Error -> " . $conn->error . "\n";
                echo "     Query: {$queryText}\n";
            }
        } catch (Throwable $e) {
            $failCount++;
            echo "  ❌ Line {$lineNum}: Exception -> " . $e->getMessage() . "\n";
            echo "     Query: {$queryText}\n";
        }
    }
}

echo "\n====================================================\n";
echo "📊 SCAN COMPLETE SUMMARY:\n";
echo "   ✅ Total Valid Queries (PASS): {$passCount}\n";
echo "   ❌ Total Mismatched/Error Queries (FAIL): {$failCount}\n";
echo "   ⚠️ Total Skipped Dynamic Fragments: {$skippedCount}\n";
echo "====================================================\n";
