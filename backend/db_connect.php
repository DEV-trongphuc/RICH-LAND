<?php
require_once __DIR__ . '/env.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

$servername = $_ENV['DB_HOST'] ?? "localhost";
$username = $_ENV['DB_USER'] ?? "vhvxoigh_mail_auto";
$password = $_ENV['DB_PASS'] ?? "Ideas@812";
$dbname = $_ENV['DB_NAME'] ?? "vhvxoigh_sale_data";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

$conn->set_charset("utf8mb4");

// Auto-migrate: ensure custom_label column exists in field_mappings
$checkCol = $conn->query("SHOW COLUMNS FROM field_mappings LIKE 'custom_label'");
if ($checkCol && $checkCol->num_rows === 0) {
    $conn->query("ALTER TABLE field_mappings ADD COLUMN custom_label VARCHAR(255) NULL COMMENT 'Tên hiển thị tùy chỉnh trong Email'");
}

// Auto-migrate: ensure require_both_contact column exists in sheet_connections
$checkColSC = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'require_both_contact'");
if ($checkColSC && $checkColSC->num_rows === 0) {
    $conn->query("ALTER TABLE sheet_connections ADD COLUMN require_both_contact BOOLEAN DEFAULT FALSE COMMENT 'Yêu cầu có cả SĐT và Email'");
}

// Auto-migrate: ensure receive_ratio column exists in round_consultants
$checkColRR = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'receive_ratio'");
if ($checkColRR && $checkColRR->num_rows === 0) {
    $conn->query("ALTER TABLE round_consultants ADD COLUMN receive_ratio INT DEFAULT 1");
}

// Auto-migrate: ensure skip_count column exists in round_consultants
$checkColSC = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skip_count'");
if ($checkColSC && $checkColSC->num_rows === 0) {
    $conn->query("ALTER TABLE round_consultants ADD COLUMN skip_count INT DEFAULT 0");
}

// Auto-migrate: ensure sheet_sync_records table exists
$conn->query("CREATE TABLE IF NOT EXISTS sheet_sync_records (
    connection_id INT,
    row_hash VARCHAR(64),
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (connection_id, row_hash),
    FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE
)");

// Auto-migrate: ensure conditions_json column exists in routing_rules for multi-conditions
$checkColRRJson = $conn->query("SHOW COLUMNS FROM routing_rules LIKE 'conditions_json'");
if ($checkColRRJson && $checkColRRJson->num_rows === 0) {
    $conn->query("ALTER TABLE routing_rules ADD COLUMN conditions_json LONGTEXT NULL COMMENT 'Mảng điều kiện JSON'");
}

// Auto-migrate: ensure logical_operator column exists in routing_rules for multi-conditions
$checkColRROp = $conn->query("SHOW COLUMNS FROM routing_rules LIKE 'logical_operator'");
if ($checkColRROp && $checkColRROp->num_rows === 0) {
    $conn->query("ALTER TABLE routing_rules ADD COLUMN logical_operator VARCHAR(10) DEFAULT 'AND' COMMENT 'Toán tử logic giữa các điều kiện'");
}
