<?php
require_once __DIR__ . '/../db_connect.php';

$tables = ['activity_comments', 'ticket_comments', 'comments'];
foreach ($tables as $t) {
    echo "=== Table: $t ===\n";
    try {
        $stmt = $conn->query("DESCRIBE `$t`");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "  {$row['Field']} - {$row['Type']} - {$row['Null']} - {$row['Default']}\n";
        }
    } catch (Exception $e) {
        echo "  Error: " . $e->getMessage() . "\n";
    }
}
