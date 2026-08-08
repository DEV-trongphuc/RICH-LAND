<?php
// backend/generate_db_schema_live.php
require_once __DIR__ . '/db_connect.php';

// Verify token for security
$token = $_GET['token'] ?? '';
if ($token !== 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7') {
    http_response_code(403);
    die("Forbidden");
}

try {
    $tablesRes = $conn->query("SHOW TABLES");
    $schema = [];
    while ($tRow = $tablesRes->fetch_row()) {
        $tableName = $tRow[0];
        $colsRes = $conn->query("SHOW COLUMNS FROM `$tableName`");
        $columns = [];
        while ($cRow = $colsRes->fetch_assoc()) {
            $columns[] = [
                'field'   => $cRow['Field'],
                'type'    => $cRow['Type'],
                'null'    => $cRow['Null'],
                'key'     => $cRow['Key'] === 'PRI' ? 'PRI' : ($cRow['Key'] === 'UNI' ? 'UNI' : ($cRow['Key'] === 'MUL' ? 'MUL' : '')),
                'default' => $cRow['Default'],
                'extra'   => $cRow['Extra']
            ];
        }
        $schema[$tableName] = $columns;
    }
    
    $resultData = [
        'success' => true,
        'schema' => $schema
    ];
    
    $json = json_encode($resultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    // Write locally to backend
    file_put_contents(__DIR__ . '/db_schema.json', $json);
    
    // Write to frontend assets folder if structure matches
    $fePath = dirname(__DIR__) . '/src/assets/db_schema.json';
    if (is_dir(dirname($fePath))) {
        file_put_contents($fePath, $json);
    }
    
    echo "SUCCESS: db_schema.json updated with " . count($schema) . " tables.\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
