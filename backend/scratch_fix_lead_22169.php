<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== FIXING LEAD #22169 ===\n\n";

$sql = "UPDATE leads SET ai_screener_status = 'passed' WHERE id = 22169";
if ($conn->query($sql)) {
    echo "Successfully updated lead #22169 (Hoàng Nga) ai_screener_status to 'passed'.\n";
} else {
    echo "Error updating lead: " . $conn->error . "\n";
}
?>
