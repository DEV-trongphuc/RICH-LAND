<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

try {
    $res = $conn->query("SHOW CREATE VIEW consultants");
    if ($res) {
        $row = $res->fetch_assoc();
        echo "CREATE VIEW consultants:\n";
        echo $row['Create View'] . "\n";
    } else {
        echo "Failed to get view definition.\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
