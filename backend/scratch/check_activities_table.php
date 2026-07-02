<?php
require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db_connect.php';

try {
    $res = $conn->query("DESCRIBE activities");
    while ($row = $res->fetch_assoc()) {
        print_r($row);
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
