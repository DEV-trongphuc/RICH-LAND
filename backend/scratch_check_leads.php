<?php
require_once 'db_connect.php';

echo "=== LAST 5 LEADS ===\n";
$res = $conn->query("SELECT id, name, phone, email, status, assigned_to, connection_id, created_at, ai_screener_status, ai_evaluation FROM leads ORDER BY id DESC LIMIT 5");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "Query leads failed: " . $conn->error . "\n";
}

echo "\n=== INDEXES ON LEADS ===\n";
$resIdx = $conn->query("SHOW INDEX FROM leads");
if ($resIdx) {
    while ($row = $resIdx->fetch_assoc()) {
        echo "Table: " . $row['Table'] . ", Non_unique: " . $row['Non_unique'] . ", Key_name: " . $row['Key_name'] . ", Column_name: " . $row['Column_name'] . "\n";
    }
} else {
    echo "Query indexes failed: " . $conn->error . "\n";
}
?>
