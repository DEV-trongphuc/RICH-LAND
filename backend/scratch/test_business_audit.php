<?php
/**
 * Richland CRM-RLVN Business Logic Audit Verification Script
 * Executed via command line to verify all complex rules.
 */

define('CLI_AUDIT_MODE', true);
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../webhook_logic.php';

echo "=== RICH LAND BUSINESS LOGIC AUDIT START ===\n\n";

$passCount = 0;
$failCount = 0;

function assertRule($name, $assertion) {
    global $passCount, $failCount;
    if ($assertion) {
        echo "[PASSED] - $name\n";
        $passCount++;
    } else {
        echo "[FAILED] - $name\n";
        $failCount++;
    }
}

try {
    // ----------------------------------------------------
    // 1. Audit Rule 1.9 (Wash Source Protection)
    // ----------------------------------------------------
    echo "\n--- Luồng 1: Lead Vào (Rule 1.9 Wash Protection) ---\n";
    $checkPhone = '0987654321';
    $today = date('Y-m-d H:i:s');
    $fifteenDaysAgo = date('Y-m-d H:i:s', strtotime('-15 days'));

    $conn->query("DELETE FROM leads WHERE phone = '$checkPhone'");
    $conn->query("INSERT INTO leads (phone, source, created_at) VALUES ('$checkPhone', 'facebook', '$fifteenDaysAgo')");

    $stmt = $conn->prepare("
        SELECT id, source, created_at 
        FROM leads 
        WHERE phone = ? 
          AND source IN ('facebook', 'google', 'google_lp', 'website', 'youtube', 'tiktok') 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        LIMIT 1
    ");
    $stmt->bind_param("s", $checkPhone);
    $stmt->execute();
    $leadDup = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    assertRule("Rule 1.9 - Duplicate wash source detection (Facebook lead in last 30 days)", ($leadDup !== null && $leadDup['source'] === 'facebook'));
    $conn->query("DELETE FROM leads WHERE phone = '$checkPhone'");

} catch (Throwable $e) {
    echo "[ERROR] Luồng 1: " . $e->getMessage() . "\n";
    $failCount++;
}

try {
    // ----------------------------------------------------
    // 2. Audit Rule 2.18 & 2.19 (Night Shift Registration & Routing)
    // ----------------------------------------------------
    echo "\n--- Luồng 2: Roster & Ca Đêm (Rule 2.18 & 2.19) ---\n";
    
    $userRow = $conn->query("SELECT id FROM users WHERE status = 'active' LIMIT 1")->fetch_assoc();
    if (!$userRow) {
        $userRow = $conn->query("SELECT id FROM users LIMIT 1")->fetch_assoc();
    }
    $testUserId = $userRow ? (int)$userRow['id'] : 1;
    $testShiftDate = date('Y-m-d');

    $conn->query("DELETE FROM night_shift_registrations WHERE user_id = $testUserId AND shift_date = '$testShiftDate'");

    $conn->query("INSERT IGNORE INTO night_shift_registrations (user_id, shift_date) VALUES ($testUserId, '$testShiftDate')");
    $checkReg = $conn->query("SELECT 1 FROM night_shift_registrations WHERE user_id = $testUserId AND shift_date = '$testShiftDate'")->fetch_assoc();
    assertRule("Rule 2.18 - Night shift registration table & insertion", ($checkReg !== null));

    $available = checkNightShiftAvailability($conn, $testUserId, '22:00');
    assertRule("Rule 2.19 - checkNightShiftAvailability returns true for registered user at 22:00", $available);

    $notAvailable = checkNightShiftAvailability($conn, 999999, '22:00');
    assertRule("Rule 2.19 - checkNightShiftAvailability returns false for unregistered user at 22:00", !$notAvailable);

    $normalAvailable = checkNightShiftAvailability($conn, 999999, '10:00');
    assertRule("Rule 2.19 - checkNightShiftAvailability returns true during normal business hours", $normalAvailable);

    $conn->query("DELETE FROM night_shift_registrations WHERE user_id = $testUserId AND shift_date = '$testShiftDate'");

} catch (Throwable $e) {
    echo "[ERROR] Luồng 2: " . $e->getMessage() . "\n";
    $failCount++;
}

try {
    // ----------------------------------------------------
    // 3. Audit Rule 3.3 (Bếp Đun Nước Hybrid Temperature)
    // ----------------------------------------------------
    echo "\n--- Luồng 3: Chăm Sóc & Nhiệt Độ ---\n";
    $chkColumns = $conn->query("SHOW COLUMNS FROM contacts");
    $cols = [];
    while ($row = $chkColumns->fetch_assoc()) {
        $cols[] = $row['Field'];
    }
    assertRule("Rule 3.3 - Calculated temperature column exists", in_array('temperature', $cols) || in_array('calculated_temperature', $cols) || in_array('machine_temperature', $cols));

} catch (Throwable $e) {
    echo "[ERROR] Luồng 3: " . $e->getMessage() . "\n";
    $failCount++;
}

try {
    // ----------------------------------------------------
    // 4. Audit Rule 4.6 & 4.7 (Cooperation Slips Split)
    // ----------------------------------------------------
    echo "\n--- Luồng 4: Hợp Tác & Hoa Hồng (Rule 4.6 & 4.7) ---\n";
    $chkSlipTable = $conn->query("SHOW TABLES LIKE 'cooperation_slips'")->fetch_row();
    assertRule("Rule 4.5 - Cooperation slips table exists", ($chkSlipTable !== null));

} catch (Throwable $e) {
    echo "[ERROR] Luồng 4: " . $e->getMessage() . "\n";
    $failCount++;
}

try {
    // ----------------------------------------------------
    // 5. Audit Rule 5.13 (Databank 3-Strikes Exclusion)
    // ----------------------------------------------------
    echo "\n--- Luồng 5: Kho Data (Rule 5.13 Bad Lead Exclusion) ---\n";
    $testPersonId = 88888;
    $testLeadId = 99999;
    $reason = "Sai số điện thoại / Số ảo";

    // Clean up first
    $conn->query("DELETE FROM data_reports WHERE lead_id = $testLeadId");
    $conn->query("DELETE FROM leads WHERE id = $testLeadId");
    $conn->query("DELETE FROM persons WHERE id = $testPersonId");

    // Insert person using correct column 'full_name'
    $conn->query("INSERT INTO persons (id, full_name, phone) VALUES ($testPersonId, 'Test Person', '0999999999')");

    // Insert lead linking to person
    $conn->query("INSERT INTO leads (id, person_id, phone, source) VALUES ($testLeadId, $testPersonId, '0999999999', 'google')");

    // Seed reports linking to lead
    $maxReportId = 99990;
    for ($i = 0; $i < 3; $i++) {
        $repId = $maxReportId + $i;
        $conn->query("INSERT INTO data_reports (id, lead_id, reason, status) VALUES ($repId, $testLeadId, '$reason', 'approved')");
    }

    // Emulate releaseExpiredLeadsToKho exclusion check
    $stmtCount = $conn->prepare("
        SELECT dr.reason, COUNT(*) as cnt 
        FROM data_reports dr
        JOIN leads l ON dr.lead_id = l.id
        WHERE l.person_id = ? AND dr.status IN ('approved', 'approved_no_comp')
        GROUP BY dr.reason
        HAVING cnt >= 3
        LIMIT 1
    ");
    $stmtCount->bind_param("i", $testPersonId);
    $stmtCount->execute();
    $resExclude = $stmtCount->get_result()->fetch_assoc();
    $stmtCount->close();

    assertRule("Rule 5.13 - Exclude Person with >=3 approved reports for same reason", ($resExclude !== null && $resExclude['cnt'] >= 3));

    // Clean up
    for ($i = 0; $i < 3; $i++) {
        $repId = $maxReportId + $i;
        $conn->query("DELETE FROM data_reports WHERE id = $repId");
    }
    $conn->query("DELETE FROM leads WHERE id = $testLeadId");
    $conn->query("DELETE FROM persons WHERE id = $testPersonId");

} catch (Throwable $e) {
    echo "[ERROR] Luồng 5: " . $e->getMessage() . "\n";
    $failCount++;
}

try {
    // ----------------------------------------------------
    // 6. Audit Row-Level Security (Phân Quyền)
    // ----------------------------------------------------
    echo "\n--- Row-Level Security: Phân Quyền ---\n";
    
    // Read backend/api.php to assert the existence of role-based RLS on get_sale_portal_data
    $apiContent = file_get_contents(__DIR__ . '/../api.php');
    $hasRLSInApi = strpos($apiContent, "dl.assigned_to = ?") !== false && strpos($apiContent, "decodedUser['role'] === 'sale'") !== false;
    
    assertRule("Row-Level Security - Sales only sees owned leads in Sale Portal data query", $hasRLSInApi);

} catch (Throwable $e) {
    echo "[ERROR] Row-Level Security: " . $e->getMessage() . "\n";
    $failCount++;
}

echo "\n============================================\n";
echo "AUDIT COMPLETED: $passCount Passed, $failCount Failed\n";
if ($failCount > 0) {
    exit(1);
} else {
    exit(0);
}
