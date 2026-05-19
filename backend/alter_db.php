<?php
require 'db_connect.php';

$sql1 = "ALTER TABLE leads ADD COLUMN connection_id INT NULL";
$conn->query($sql1);

$sql2 = "UPDATE leads l JOIN sheet_connections sc ON l.source = sc.sheet_name SET l.connection_id = sc.id WHERE l.connection_id IS NULL";
$conn->query($sql2);

echo "Updated leads table with connection_id successfully";
?>
