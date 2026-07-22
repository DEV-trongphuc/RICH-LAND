<?php
// backend/debug_night_shift_release.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 AUDIT NIGHT SHIFT & PENDING WORK HOURS LEADS\n";
echo "====================================================\n\n";

$today = date('Y-m-d');
$now = date('H:i:s');
echo "Current Server Time: $now | Date: $today\n\n";

// 1. Check System Settings for Night Shift
$nightStart = get_system_setting($conn, 'night_shift_start_time') ?: '22:00';
$nightEnd = get_system_setting($conn, 'night_shift_end_time') ?: '06:00';
echo "1. Night Shift Settings: Start=$nightStart, End=$nightEnd\n";

// 2. Check Night Shift Registrations for today
$resNight = $conn->query("SELECT nsr.*, u.full_name, c.id as consultant_id, c.name as consultant_name 
                          FROM night_shift_registrations nsr 
                          JOIN users u ON nsr.user_id = u.id 
                          LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.user_id)
                          WHERE nsr.shift_date = '$today'");
echo "\n2. Night Shift Registrations today ($today):\n";
$nightCount = 0;
while ($nr = $resNight->fetch_assoc()) {
    $nightCount++;
    echo "  • User: {$nr['full_name']} (User ID: {$nr['user_id']}, Consultant ID: {$nr['consultant_id']}) | Approved: {$nr['approved']}\n";
}
if ($nightCount === 0) {
    echo "  ⚠️ NO NIGHT SHIFT REGISTRATIONS FOUND FOR TODAY ($today)!\n";
}

// 3. Check Pending Work Hours Leads
$resPending = $conn->query("SELECT dl.id as log_id, dl.lead_id, dl.assigned_to, dl.status, dl.created_at, l.name as lead_name, l.phone 
                            FROM distribution_logs dl 
                            JOIN leads l ON dl.lead_id = l.id 
                            WHERE dl.status = 'pending_work_hours' OR l.status = 'pending_work_hours'");
echo "\n3. Pending Work Hours Leads:\n";
$pCount = 0;
while ($pr = $resPending->fetch_assoc()) {
    $pCount++;
    echo "  • Log ID: {$pr['log_id']} | Lead ID: {$pr['lead_id']} | Name: {$pr['lead_name']} | AssignedTo: " . ($pr['assigned_to'] ?: 'NULL (Rich Land Bot)') . " | Time: {$pr['created_at']}\n";
}
if ($pCount === 0) {
    echo "  No pending_work_hours leads found.\n";
}
