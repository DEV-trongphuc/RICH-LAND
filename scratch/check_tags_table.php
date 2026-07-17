<?php
require_once __DIR__ . '/../backend/db_connect.php';

try {
    $res = $conn->query("SHOW CREATE TABLE tags");
    $row = $res->fetch_assoc();
    echo "TABLE STRUCTURE:\n";
    echo $row['Create Table'] . "\n\n";

    $res2 = $conn->query("SELECT * FROM tags LIMIT 10");
    $tags = [];
    while ($r = $res2->fetch_assoc()) {
        $tags[] = $r;
    }
    echo "TAGS DATA:\n";
    echo json_encode($tags, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
