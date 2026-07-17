<?php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    function printTable($db, $table) {
        echo "=== TABLE: $table ===\n";
        $stmt = $db->query("DESCRIBE `$table`");
        while ($row = $stmt->fetch()) {
            echo "  {$row['Field']} - {$row['Type']} (Null: {$row['Null']}, Key: {$row['Key']}, Default: {$row['Default']})\n";
        }
    }
    
    printTable($db, 'distribution_logs');
    printTable($db, 'leads');
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
