<?php
include __DIR__ . '/db_connect.php';

$res = $conn->query("SHOW COLUMNS FROM contacts");
while ($row = $res->fetch_assoc()) {
    echo $row['Field'] . " - " . $row['Type'] . "\n";
}
