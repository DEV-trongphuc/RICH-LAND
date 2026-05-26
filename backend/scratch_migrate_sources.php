<?php
// backend/scratch_migrate_sources.php
require_once __DIR__ . '/db_connect.php';

$updates = [
    'Facebook Ads - Form' => [30163, 30162],
    'Website IDEAS' => [4893],
    'Hotline' => [4895],
    'Messenger' => [4918]
];

foreach ($updates as $source => $ids) {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $conn->prepare("UPDATE leads SET source = ? WHERE id IN ($placeholders)");
    if ($stmt) {
        $types = 's' . str_repeat('i', count($ids));
        $params = array_merge([$source], $ids);
        $stmt->bind_param($types, ...$params);
        if ($stmt->execute()) {
            echo "Successfully updated leads " . implode(', ', $ids) . " source to '$source' (Affected rows: " . $stmt->affected_rows . ").\n";
        } else {
            echo "Failed to update leads " . implode(', ', $ids) . ": " . $stmt->error . "\n";
        }
        $stmt->close();
    } else {
        echo "Failed to prepare statement for '$source': " . $conn->error . "\n";
    }
}
?>
