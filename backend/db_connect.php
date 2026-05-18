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

// Auto-migrate: ensure compensation_count column exists in round_consultants
$checkColComp = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'compensation_count'");
if ($checkColComp && $checkColComp->num_rows === 0) {
    $conn->query("ALTER TABLE round_consultants ADD COLUMN compensation_count INT DEFAULT 0 COMMENT 'Số data cần đền bù'");
}

// Auto-migrate: create data_reports table
$conn->query("CREATE TABLE IF NOT EXISTS data_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    consultant_id INT,
    round_id INT,
    reason VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (consultant_id) REFERENCES consultants(id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES distribution_rounds(id) ON DELETE CASCADE
)");
// Auto-migrate: Performance Indexes — only add if they don't already exist
// BUG-15 fix: wrapped in SHOW INDEX checks to avoid ALTER TABLE on every request

// Unique key for round_consultants
$chkIdx1 = $conn->query("SHOW INDEX FROM round_consultants WHERE Key_name='idx_round_consultant_unique'");
if ($chkIdx1 && $chkIdx1->num_rows === 0) {
    $conn->query("ALTER TABLE round_consultants ADD UNIQUE KEY `idx_round_consultant_unique` (`round_id`, `consultant_id`)");
}

// leads phone index
$chkIdx2 = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_phone'");
if ($chkIdx2 && $chkIdx2->num_rows === 0) {
    $conn->query("ALTER TABLE leads ADD INDEX `idx_phone` (`phone`)");
}

// leads email index
$chkIdx3 = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_email'");
if ($chkIdx3 && $chkIdx3->num_rows === 0) {
    $conn->query("ALTER TABLE leads ADD INDEX `idx_email` (`email`)");
}

// distribution_logs lead_id index
$chkIdx4 = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_lead_id'");
if ($chkIdx4 && $chkIdx4->num_rows === 0) {
    $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_lead_id` (`lead_id`)");
}

// data_reports round_id index
$chkIdx5 = $conn->query("SHOW INDEX FROM data_reports WHERE Key_name='idx_round_id'");
if ($chkIdx5 && $chkIdx5->num_rows === 0) {
    $conn->query("ALTER TABLE data_reports ADD INDEX `idx_round_id` (`round_id`)");
}

?>
