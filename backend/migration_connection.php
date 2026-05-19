<?php
require_once __DIR__ . '/db_connect.php';
$conn->query("ALTER TABLE leads ADD COLUMN connection_id INT NULL");
$conn->query("UPDATE leads l JOIN sheet_connections sc ON l.source = sc.sheet_name SET l.connection_id = sc.id WHERE l.connection_id IS NULL");
echo "Done\n";
