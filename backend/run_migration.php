<?php
require_once 'db_connect.php';
$sql = file_get_contents('migration_logs_lastlogin.sql');
$conn->multi_query($sql);
do {
    if ($res = $conn->store_result()) { $res->free(); }
} while ($conn->more_results() && $conn->next_result());
echo 'Migration completed';
