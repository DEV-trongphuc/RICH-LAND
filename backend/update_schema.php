<?php
require_once 'db_connect.php';

// Add new columns for special round distribution rules
$res = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'receive_ratio'");
if ($res->num_rows === 0) {
    if ($conn->query("ALTER TABLE round_consultants ADD COLUMN receive_ratio INT DEFAULT 1")) {
        echo "Successfully added receive_ratio column to round_consultants table.\n<br>";
    } else {
        echo "Error adding receive_ratio column: " . $conn->error . "\n<br>";
    }
} else {
    echo "receive_ratio column already exists.\n<br>";
}

$res2 = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skip_count'");
if ($res2->num_rows === 0) {
    if ($conn->query("ALTER TABLE round_consultants ADD COLUMN skip_count INT DEFAULT 0")) {
        echo "Successfully added skip_count column to round_consultants table.\n<br>";
    } else {
        echo "Error adding skip_count column: " . $conn->error . "\n<br>";
    }
} else {
    echo "skip_count column already exists.\n<br>";
}
?>
