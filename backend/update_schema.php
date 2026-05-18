<?php
require_once 'db_connect.php';

// Check if custom_label column exists in field_mappings
$res = $conn->query("SHOW COLUMNS FROM field_mappings LIKE 'custom_label'");
if ($res->num_rows === 0) {
    if ($conn->query("ALTER TABLE field_mappings ADD COLUMN custom_label VARCHAR(255) NULL COMMENT 'Tên hiển thị tùy chỉnh trong Email'")) {
        echo "Successfully added custom_label column to field_mappings table.\n";
    } else {
        echo "Error adding column: " . $conn->error . "\n";
    }
} else {
    echo "custom_label column already exists.\n";
}
?>
