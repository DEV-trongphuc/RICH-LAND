<?php
// Only allow local or CLI access for security
if (php_sapi_name() !== 'cli' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '::1') {
    http_response_code(403);
    die("Forbidden: This script can only be run locally or via CLI.");
}

require_once 'db_connect.php';
$sql = file_get_contents('migration_logs_lastlogin.sql');
$conn->multi_query($sql);
do {
    if ($res = $conn->store_result()) { $res->free(); }
} while ($conn->more_results() && $conn->next_result());
echo 'Migration completed';
