<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$ids = [30163, 30162, 4893, 4895, 4918];
echo "=== TARGET LEADS SOURCE IN DATABASE ===\n";
foreach ($ids as $id) {
    $stmt = $conn->prepare("SELECT id, name, phone, source, last_interaction_date, connection_id FROM leads WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        echo "ID: #{$row['id']} | Name: {$row['name']} | Phone: {$row['phone']} | Source: '{$row['source']}' | ConnID: {$row['connection_id']} | Date: {$row['last_interaction_date']}\n";
    } else {
        echo "ID: #$id | NOT FOUND\n";
    }
    $stmt->close();
}
?>
