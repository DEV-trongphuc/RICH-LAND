<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== MIGRATING LEADS WITH UNKNOWN/EMPTY SOURCE TO 'Facebook Ads - Form' ===\n\n";

$target_ids = [22131, 4686];
$target_source = 'Facebook Ads - Form';

echo "=== STEP 1: SELECTING TARGET LEADS BEFORE UPDATE ===\n";
$placeholders = implode(',', array_fill(0, count($target_ids), '?'));
$stmt = $conn->prepare("SELECT id, name, phone, email, source FROM leads WHERE id IN ($placeholders)");
$stmt->bind_param(str_repeat('i', count($target_ids)), ...$target_ids);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    echo "Lead ID: {$row['id']} | Name: {$row['name']} | Phone: {$row['phone']} | Email: {$row['email']} | Current Source: '{$row['source']}'\n";
}
$stmt->close();

echo "\n=== STEP 2: PERFORMING UPDATE ===\n";
// Update the specific target IDs, or we can also update all leads where source is empty
$upd = $conn->prepare("UPDATE leads SET source = ? WHERE id IN ($placeholders)");
$upd->bind_param('s' . str_repeat('i', count($target_ids)), $target_source, ...$target_ids);
if ($upd->execute()) {
    echo "Successfully updated source to '{$target_source}' for lead IDs: " . implode(', ', $target_ids) . "\n";
} else {
    echo "Failed to update target leads: " . $conn->error . "\n";
}
$upd->close();

// Optionally, let's also update any other lead in the database that has an empty/null source to prevent future 'Không xác định' labels
echo "\n=== STEP 3: CLEANING UP ANY REMAINING EMPTY/NULL SOURCES IN DATABASE ===\n";
$updAll = $conn->prepare("UPDATE leads SET source = ? WHERE source IS NULL OR TRIM(source) = ''");
$updAll->bind_param('s', $target_source);
if ($updAll->execute()) {
    $affected = $conn->affected_rows;
    echo "Database cleanup completed! Updated {$affected} other lead(s) with empty/null sources to '{$target_source}'.\n";
} else {
    echo "Failed database cleanup: " . $conn->error . "\n";
}
$updAll->close();

echo "\n=== STEP 4: SELECTING TARGET LEADS AFTER UPDATE ===\n";
$stmt = $conn->prepare("SELECT id, name, phone, email, source FROM leads WHERE id IN ($placeholders)");
$stmt->bind_param(str_repeat('i', count($target_ids)), ...$target_ids);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    echo "Lead ID: {$row['id']} | Name: {$row['name']} | Phone: {$row['phone']} | Email: {$row['email']} | Updated Source: '{$row['source']}'\n";
}
$stmt->close();

?>
