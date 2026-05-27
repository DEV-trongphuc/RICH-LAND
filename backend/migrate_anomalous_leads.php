<?php
require_once __DIR__ . '/db_connect.php';

echo "<pre>";
echo "--- MIGRATING LEADS TO Facebook Ads - Form ---\n";

// We will update by the specific phone numbers of the leads:
// - Minh Vuong: 0869028046 (ID: 8856/4918)
// - Bảo Võ: 0372261194 (ID: 4901/4895)
// - Ly Ly: 0824866886 (ID: 4899/4915/4893)
// And also by the specific IDs mentioned by you just in case.

$queries = [
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE phone = '0869028046'",
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE phone = '0372261194'",
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE phone = '0824866886'",
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE id = 8856",
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE id = 4901",
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE id = 4915",
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE id = 4899",
    "UPDATE leads SET source = 'Facebook Ads - Form' WHERE name = 'Ly Ly'"
];

foreach ($queries as $sql) {
    if ($conn->query($sql)) {
        echo "Executed: $sql\n";
        echo "Affected rows: " . $conn->affected_rows . "\n\n";
    } else {
        echo "Error executing: $sql\n";
        echo "Error message: " . $conn->error . "\n\n";
    }
}

echo "Migration finished.\n";
echo "</pre>";
