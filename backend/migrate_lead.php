<?php
require_once __DIR__ . '/db_connect.php';

$lead_id = 22163;
$new_eval = "Thông tin khách hàng không đáp ứng yêu cầu về trình độ tiếng Anh. Quy tắc yêu cầu có tiếng Anh, nhưng dữ liệu ghi rõ 'Chưa có tiếng anh'.";

$stmt = $conn->prepare("UPDATE leads SET ai_evaluation = ? WHERE id = ?");
$stmt->bind_param("si", $new_eval, $lead_id);
if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Successfully migrated lead #22163!"]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to migrate lead: " . $stmt->error]);
}
$stmt->close();
?>
