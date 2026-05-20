<?php
// Only allow local or CLI access for security
if (php_sapi_name() !== 'cli' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '::1') {
    http_response_code(403);
    die("Forbidden: This script can only be run locally or via CLI.");
}

require 'db_connect.php';

$sql1 = "ALTER TABLE leads ADD COLUMN connection_id INT NULL";
$conn->query($sql1);

$sql2 = "UPDATE leads l JOIN sheet_connections sc ON l.source = sc.sheet_name SET l.connection_id = sc.id WHERE l.connection_id IS NULL";
$conn->query($sql2);

echo "Updated leads table with connection_id successfully";
?>
