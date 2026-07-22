<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$search = isset($_GET['name']) ? $_GET['name'] : 'Duyên 2 Kỳ';
$searchParam = '%' . $search . '%';

$response = [
    'search_query' => $search,
    'results' => []
];

try {
    // 1. Search in contacts table
    $stmt = $conn->prepare("SELECT id, first_name, last_name, name, phone, email FROM contacts WHERE first_name LIKE ? OR last_name LIKE ? OR name LIKE ? OR phone LIKE ? LIMIT 20");
    if ($stmt) {
        $stmt->bind_param("ssss", $searchParam, $searchParam, $searchParam, $searchParam);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($row = $res->fetch_assoc()) {
            $row['source_table'] = 'contacts';
            $response['results'][] = $row;
        }
        $stmt->close();
    }
    
    // 2. Also search in tickets table to see if any tickets exist for this user, and what contact_id/customer_id they have!
    $stmt = $conn->prepare("SELECT id, subject, customer_name, customer_id, contact_id, related_contacts FROM tickets WHERE customer_name LIKE ? LIMIT 10");
    if ($stmt) {
        $stmt->bind_param("s", $searchParam);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($row = $res->fetch_assoc()) {
            $row['source_table'] = 'tickets';
            $response['results'][] = $row;
        }
        $stmt->close();
    }
} catch (Exception $e) {
    $response['error'] = $e->getMessage();
}

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
