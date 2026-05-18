<?php
require_once 'db_connect.php';
$sql = file_get_contents('schema.sql');
if ($conn->multi_query($sql)) {
    echo "Schema updated successfully.\n";
} else {
    echo "Error: " . $conn->error;
}
?>
