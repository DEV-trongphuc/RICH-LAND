<?php
require 'db_connect.php';
$sql = "ALTER TABLE sheet_connections ADD COLUMN connection_type VARCHAR(20) DEFAULT 'sheets' AFTER spreadsheet_id";
if ($conn->query($sql)) {
    echo "Column added successfully";
} else {
    echo "Error: " . $conn->error;
}
?>
