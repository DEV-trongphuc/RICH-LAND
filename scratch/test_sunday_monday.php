<?php
// scratch/test_sunday_monday.php

// The schedule config JSON shown in the user's screenshot:
// Thursday, Friday, Saturday: Active 08:00 - 17:30
// Sunday: Closed (Nghi)
// Monday: Active 08:00 - 17:30
$workScheduleJson = json_encode([
    "1" => ["active" => true, "start" => "08:00", "end" => "17:30"], // Monday
    "2" => ["active" => true, "start" => "08:00", "end" => "17:30"], // Tuesday
    "3" => ["active" => true, "start" => "08:00", "end" => "17:30"], // Wednesday
    "4" => ["active" => true, "start" => "08:00", "end" => "17:30"], // Thursday
    "5" => ["active" => true, "start" => "08:00", "end" => "17:30"], // Friday
    "6" => ["active" => true, "start" => "08:00", "end" => "17:30"], // Saturday
    "7" => ["active" => false, "start" => "08:00", "end" => "17:30"] // Sunday (OFF / Nghỉ)
], JSON_PRETTY_PRINT);

/**
 * Modified version of isConsultantInWorkHours allowing a mocked day of week.
 */
function testIsConsultantInWorkHours($timeStr, $start, $end, $workScheduleJson, $mockDayOfWeek)
{
    $timeStr = trim($timeStr ?? '');
    if (preg_match('/^(\d{2}:\d{2})/', $timeStr, $m)) {
        $timeStr = $m[1];
    } else {
        $timeStr = '12:00';
    }

    if (!empty($workScheduleJson)) {
        $schedule = json_decode($workScheduleJson, true);
        if (is_array($schedule)) {
            // Get mock day of week: 1 (Monday) to 7 (Sunday)
            $dayOfWeek = $mockDayOfWeek;
            if (isset($schedule[$dayOfWeek])) {
                $dayConfig = $schedule[$dayOfWeek];
                $active = isset($dayConfig['active']) ? (bool) $dayConfig['active'] : false;
                if (!$active) {
                    return false; // Closed today
                }
                $start = $dayConfig['start'] ?? '00:00';
                $end = $dayConfig['end'] ?? '23:59';
            }
        }
    }

    $start = trim($start ?? '00:00');
    $end = trim($end ?? '23:59');

    if (preg_match('/^(\d{2}:\d{2})/', $start, $m)) {
        $start = $m[1];
    } else {
        $start = '00:00';
    }

    if (preg_match('/^(\d{2}:\d{2})/', $end, $m)) {
        $end = $m[1];
    } else {
        $end = '23:59';
    }

    if ($start === '00:00' && $end === '23:59') {
        return true;
    }
    if ($start === $end) {
        return true;
    }

    if ($start < $end) {
        return ($timeStr >= $start && $timeStr <= $end);
    } else {
        return ($timeStr >= $start || $timeStr <= $end);
    }
}

echo "=== CẤU HÌNH LỊCH LÀM VIỆC MOCK ===\n";
echo "Chủ Nhật (7): active = false (Nghỉ)\n";
echo "Thứ Hai (1): active = true (Bật, 08:00 - 17:30)\n\n";

echo "--- THỬ NGHIỆM 1: Nhận lead vào Chủ Nhật (Bất kỳ giờ nào) ---\n";
for ($hour = 0; $hour < 24; $hour += 4) {
    $time = sprintf("%02d:00", $hour);
    $inWorkHours = testIsConsultantInWorkHours($time, '08:00', '17:30', $workScheduleJson, 7);
    echo "Thời gian: Chủ Nhật $time => " . ($inWorkHours ? "BẬT (Giao lead ngay)" : "NGHỈ (Chờ đến giờ làm việc)") . "\n";
}

echo "\n--- THỬ NGHIỆM 2: Phân bổ / giải phóng lead vào Thứ Hai (08:00 - 17:30) ---\n";
$mondayTimes = ["07:30", "07:59", "08:00", "08:05", "12:00", "17:30", "17:31", "20:00"];
foreach ($mondayTimes as $time) {
    $inWorkHours = testIsConsultantInWorkHours($time, '08:00', '17:30', $workScheduleJson, 1);
    echo "Thời gian: Thứ Hai $time => " . ($inWorkHours ? "BẬT (Giao lead ngay)" : "NGHỈ (Chờ đến giờ làm việc)") . "\n";
}
