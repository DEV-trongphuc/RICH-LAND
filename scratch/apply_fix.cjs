const fs = require('fs');
const path = require('path');

// 1. Patch webhook_logic.php
{
    const file = path.join(__dirname, '../backend/webhook_logic.php');
    let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

    const startStr = "if (!function_exists('hasApprovedNightShiftForDate')) {";
    const endStr = "function checkNightShiftAvailability($conn, $consultantId, $currentTime)";

    const startIdx = content.indexOf(startStr);
    const endIdx = content.indexOf(endStr, startIdx);

    if (startIdx === -1 || endIdx === -1) {
        console.error("Indices not found for hasApprovedNightShiftForDate in webhook_logic.php!");
        process.exit(1);
    }

    const newFuncSection = `if (!function_exists('hasApprovedNightShiftForDate')) {
    function hasApprovedNightShiftForDate($conn, $consultantOrUserId, $shiftDate)
    {
        if (!$consultantOrUserId) {
            return false;
        }

        $cId = (int)$consultantOrUserId;
        $targetUserId = $cId;

        // Map consultant_id sang users.id qua email nếu có khác biệt
        $stmtU = $conn->prepare("SELECT u.id FROM users u JOIN consultants c ON u.email = c.email WHERE c.id = ? LIMIT 1");
        if ($stmtU) {
            $stmtU->bind_param("i", $cId);
            $stmtU->execute();
            $row = $stmtU->get_result()->fetch_assoc();
            $stmtU->close();
            if ($row && !empty($row['id'])) {
                $targetUserId = (int)$row['id'];
            }
        }

        // 1. Kiểm tra trực đêm trong bảng night_shift_registrations
        $stmt = $conn->prepare("SELECT 1 FROM night_shift_registrations WHERE (user_id = ? OR user_id = ?) AND shift_date = ? AND approved = 1 LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("iis", $targetUserId, $cId, $shiftDate);
            $stmt->execute();
            $hasShift = (bool)$stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($hasShift) {
                return true;
            }
        }

        // 2. Nếu ngày đó là ngày nghỉ (cuối tuần): TVV có ca trực cuối tuần đã duyệt cũng được tính là đang trực ca hợp lệ
        if (function_exists('isRestDayForUser') && isRestDayForUser($conn, $targetUserId, $shiftDate)) {
            $stmtW = $conn->prepare("SELECT 1 FROM weekend_shift_registrations WHERE (user_id = ? OR user_id = ?) AND shift_date = ? AND approved = 1 LIMIT 1");
            if ($stmtW) {
                $stmtW->bind_param("iis", $targetUserId, $cId, $shiftDate);
                $stmtW->execute();
                $hasWeekend = (bool)$stmtW->get_result()->fetch_assoc();
                $stmtW->close();
                if ($hasWeekend) {
                    return true;
                }
            }
        }

        // 3. Nếu ngày đó là ngày lễ: TVV có ca trực lễ đã duyệt cũng được tính là đang trực ca hợp lệ
        $holidayName = '';
        $resHol = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'holiday_schedules' LIMIT 1");
        if ($resHol && $hRow = $resHol->fetch_assoc()) {
            $holidays = json_decode($hRow['setting_value'] ?? '[]', true);
            if (is_array($holidays)) {
                foreach ($holidays as $h) {
                    if ($shiftDate >= $h['start'] && $shiftDate <= $h['end']) {
                        $holidayName = $h['name'];
                        break;
                    }
                }
            }
        }
        if (!empty($holidayName)) {
            $stmtH = $conn->prepare("SELECT 1 FROM holiday_shift_registrations WHERE (user_id = ? OR user_id = ?) AND shift_date = ? AND approved = 1 LIMIT 1");
            if ($stmtH) {
                $stmtH->bind_param("iis", $targetUserId, $cId, $shiftDate);
                $stmtH->execute();
                $hasHoliday = (bool)$stmtH->get_result()->fetch_assoc();
                $stmtH->close();
                if ($hasHoliday) {
                    return true;
                }
            }
        }

        return false;
    }
}

/**
 * Kiểm tra xem Tư vấn viên có ca trực hợp lệ (đêm / cuối tuần / lễ) trong khung giờ trực đêm hay không.
 */
`;

    content = content.substring(0, startIdx) + newFuncSection + content.substring(endIdx);

    // Patch Gate 2 in checkConsultantGates
    const oldGate2 = `$isApprovedNight = hasApprovedNightShiftForDate($conn, $targetUserId, $nightShiftWindow['shift_date']);
        if (!$isApprovedNight) {
            return "Failed Gate 2: Đang trong khung giờ ca trực đêm ({$nightShiftWindow['start_time']} - {$nightShiftWindow['end_time']}) nhưng TVV chưa đăng ký hoặc chưa được duyệt trực ca đêm ngày {$nightShiftWindow['shift_date']}";
        }`;

    const newGate2 = `$isApprovedShift = hasApprovedShiftForDate($conn, $targetUserId, $nightShiftWindow['shift_date']);
        if (!$isApprovedShift) {
            return "Failed Gate 2: Đang trong khung giờ ca trực đêm ({$nightShiftWindow['start_time']} - {$nightShiftWindow['end_time']}) nhưng TVV chưa đăng ký hoặc chưa được duyệt ca trực (đêm/cuối tuần/lễ) ngày {$nightShiftWindow['shift_date']}";
        }`;

    if (!content.includes(oldGate2)) {
        console.error("Gate 2 not found in webhook_logic.php!");
        process.exit(1);
    }
    content = content.replace(oldGate2, newGate2);

    fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
    console.log("Patched backend/webhook_logic.php successfully!");
}

// 2. Patch backend/webhook.php
{
    const file = path.join(__dirname, '../backend/webhook.php');
    let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

    const oldStr = `if ($nightWindow['is_night_shift']) {
                    if (!hasApprovedNightShiftForDate($conn, $c['id'], $nightWindow['shift_date'])) {
                        continue; // Bỏ qua nếu không đăng ký trực ca đêm
                    }
                }`;

    const newStr = `if ($nightWindow['is_night_shift']) {
                    if (!hasApprovedShiftForDate($conn, $c['id'], $nightWindow['shift_date'])) {
                        continue; // Bỏ qua nếu không có ca trực đã duyệt (đêm/cuối tuần/lễ)
                    }
                }`;

    if (!content.includes(oldStr)) {
        console.error("String not found in webhook.php!");
        process.exit(1);
    }
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
    console.log("Patched backend/webhook.php successfully!");
}

// 3. Patch backend/cron_sync.php
{
    const file = path.join(__dirname, '../backend/cron_sync.php');
    let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

    const oldStr = `if ($nightWindow['is_night_shift']) {
                                if (!hasApprovedNightShiftForDate($conn, $c['id'], $nightWindow['shift_date'])) {
                                    continue; // Bỏ qua nếu không đăng ký trực ca đêm
                                }
                            }`;

    const newStr = `if ($nightWindow['is_night_shift']) {
                                if (!hasApprovedShiftForDate($conn, $c['id'], $nightWindow['shift_date'])) {
                                    continue; // Bỏ qua nếu không có ca trực đã duyệt (đêm/cuối tuần/lễ)
                                }
                            }`;

    if (!content.includes(oldStr)) {
        console.error("String not found in cron_sync.php!");
        process.exit(1);
    }
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
    console.log("Patched backend/cron_sync.php successfully!");
}

// 4. Patch backend/api.php
{
    const file = path.join(__dirname, '../backend/api.php');
    let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

    const oldStr = `if ($nightWindow['is_night_shift']) {
                                if (!hasApprovedNightShiftForDate($conn, $c['id'], $nightWindow['shift_date'])) {
                                    continue; // Bỏ qua nếu không đăng ký trực ca đêm
                                }
                            }`;

    const newStr = `if ($nightWindow['is_night_shift']) {
                                if (!hasApprovedShiftForDate($conn, $c['id'], $nightWindow['shift_date'])) {
                                    continue; // Bỏ qua nếu không có ca trực đã duyệt (đêm/cuối tuần/lễ)
                                }
                            }`;

    if (!content.includes(oldStr)) {
        console.error("String not found in api.php!");
        process.exit(1);
    }
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
    console.log("Patched backend/api.php successfully!");
}
