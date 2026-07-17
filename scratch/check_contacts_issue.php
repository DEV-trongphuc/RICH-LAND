<?php
// scratch/check_contacts_issue.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "=== DETAILS OF LEADS ===\n";
$res = $conn->query("SELECT id, name, phone, email, assigned_to, is_accepted, last_assigned_at, status FROM leads");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "ID: {$row['id']} | Name: {$row['name']} | Assigned: {$row['assigned_to']} | Is Accepted: {$row['is_accepted']} | Assigned At: {$row['last_assigned_at']} | Status: {$row['status']}\n";
    }
}

$conn->close();
