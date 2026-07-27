<?php
// backend/test_active_offers.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$userId = 1000;
try {
    $stmt = $conn->prepare("
        SELECT lo.id as offer_id, lo.lead_id, lo.expires_at,
               l.name as lead_name, l.source as lead_source, l.type as lead_type, l.note as lead_note,
               TIMESTAMPDIFF(SECOND, NOW(), lo.expires_at) as seconds_remaining,
               dr.round_name
        FROM lead_offers lo
        JOIN leads l ON lo.lead_id = l.id
        JOIN distribution_rounds dr ON lo.round_id = dr.id
        WHERE lo.user_id = ? 
          AND lo.status = 'pending' 
          AND lo.expires_at > NOW()
        ORDER BY lo.expires_at ASC
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $offers = $res->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'offers' => $offers,
        'server_time' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
