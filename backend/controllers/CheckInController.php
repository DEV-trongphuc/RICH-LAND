<?php
// backend/controllers/CheckInController.php

class CheckInController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        // Option to check only today's check-in for the logged-in user (useful for dashboard/buttons)
        if (isset($_GET['today_only']) && $_GET['today_only'] == '1') {
            try {
                $stmt = $this->db->prepare("
                    SELECT c.*, IF(COALESCE(u.use_custom_work_hours, 0) = 1, u.work_start_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1)) AS work_start_time, u.full_name as user_name
                    FROM check_ins c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.user_id = ? AND c.check_in_date = ?
                ");
                $stmt->execute([$auth['user_id'], date('Y-m-d')]);
                $row = $stmt->fetch();
                respond(200, $row ?: null, 'Lấy thông tin check-in hôm nay thành công');
            } catch (\Throwable $e) {
                $stmt = $this->db->prepare("
                    SELECT c.*, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1) AS work_start_time, u.full_name as user_name
                    FROM check_ins c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.user_id = ? AND c.check_in_date = ?
                ");
                $stmt->execute([$auth['user_id'], date('Y-m-d')]);
                $row = $stmt->fetch();
                respond(200, $row ?: null, 'Lấy thông tin check-in hôm nay thành công');
            }
        }

        $isManager = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'], true);
        
        try {
            $sql = "SELECT c.*, u.full_name as user_name, u.email as user_email, u.avatar_url as user_avatar, IF(COALESCE(u.use_custom_work_hours, 0) = 1, u.work_start_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1)) AS work_start_time
                    FROM check_ins c
                    JOIN users u ON c.user_id = u.id
                    WHERE u.tenant_id = ?";
        } catch (\Throwable $e) {
            $sql = "SELECT c.*, u.full_name as user_name, u.email as user_email, u.avatar_url as user_avatar, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1) AS work_start_time
                    FROM check_ins c
                    JOIN users u ON c.user_id = u.id
                    WHERE u.tenant_id = ?";
        }
        
        $params = [$auth['tenant_id']];

        // RLS: Sales can only see their own check-ins. Managers see their team's (where they are leader or belong to).
        if ($auth['role'] === 'manager') {
            $sql .= " AND (u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR (u.team_id IS NOT NULL AND u.team_id = (SELECT team_id FROM users WHERE id = ?)))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            if (isset($_GET['user_id']) && !empty($_GET['user_id']) && $_GET['user_id'] !== 'all') {
                $sql .= " AND c.user_id = ?";
                $params[] = (int)$_GET['user_id'];
            }
        } else if (!$isManager) {
            $sql .= " AND c.user_id = ?";
            $params[] = $auth['user_id'];
        } else {
            // Admin/Assistant/Superadmin filtering
            if (isset($_GET['user_id']) && !empty($_GET['user_id']) && $_GET['user_id'] !== 'all') {
                $sql .= " AND c.user_id = ?";
                $params[] = (int)$_GET['user_id'];
            }
        }

        if (isset($_GET['month']) && !empty($_GET['month'])) {
            $sql .= " AND YEAR(c.check_in_date) = ? AND MONTH(c.check_in_date) = ?";
            $params[] = (int)($_GET['year'] ?? date('Y'));
            $params[] = (int)$_GET['month'];
        } elseif (isset($_GET['from']) && !empty($_GET['from']) && isset($_GET['to']) && !empty($_GET['to'])) {
            $sql .= " AND c.check_in_date BETWEEN ? AND ?";
            $params[] = $_GET['from'];
            $params[] = $_GET['to'];
        } elseif (isset($_GET['date']) && !empty($_GET['date']) && $_GET['date'] !== 'all') {
            $sql .= " AND c.check_in_date = ?";
            $params[] = $_GET['date'];
        }

        if (isset($_GET['status']) && !empty($_GET['status']) && $_GET['status'] !== 'all') {
            $sql .= " AND c.status = ?";
            $params[] = $_GET['status'];
        }

        $sql .= " ORDER BY c.check_in_date DESC, c.check_in_time DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll() ?: [];

        if (isset($_GET['include_shifts']) && $_GET['include_shifts'] == '1') {
            $shifts = [];
            $userIdFilter = null;
            if (isset($_GET['user_id']) && !empty($_GET['user_id']) && $_GET['user_id'] !== 'all') {
                $userIdFilter = (int)$_GET['user_id'];
            }

            if (isset($_GET['month']) && !empty($_GET['month'])) {
                $year = (int)($_GET['year'] ?? date('Y'));
                $month = (int)$_GET['month'];

                // 1. Night shifts
                $nightSql = "SELECT 'night' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                             FROM night_shift_registrations r 
                             JOIN users u ON r.user_id = u.id 
                             WHERE YEAR(r.shift_date) = ? AND MONTH(r.shift_date) = ?";
                $nightParams = [$year, $month];
                if ($userIdFilter !== null) {
                    $nightSql .= " AND r.user_id = ?";
                    $nightParams[] = $userIdFilter;
                }
                $stmtNight = $this->db->prepare($nightSql);
                $stmtNight->execute($nightParams);
                $shifts = array_merge($shifts, $stmtNight->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 2. Weekend shifts
                $weekendSql = "SELECT 'weekend' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM weekend_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE YEAR(r.shift_date) = ? AND MONTH(r.shift_date) = ?";
                $weekendParams = [$year, $month];
                if ($userIdFilter !== null) {
                    $weekendSql .= " AND r.user_id = ?";
                    $weekendParams[] = $userIdFilter;
                }
                $stmtWeekend = $this->db->prepare($weekendSql);
                $stmtWeekend->execute($weekendParams);
                $shifts = array_merge($shifts, $stmtWeekend->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 3. Holiday shifts
                $holidaySql = "SELECT 'holiday' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, r.holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM holiday_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE YEAR(r.shift_date) = ? AND MONTH(r.shift_date) = ?";
                $holidayParams = [$year, $month];
                if ($userIdFilter !== null) {
                    $holidaySql .= " AND r.user_id = ?";
                    $holidayParams[] = $userIdFilter;
                }
                $stmtHoliday = $this->db->prepare($holidaySql);
                $stmtHoliday->execute($holidayParams);
                $shifts = array_merge($shifts, $stmtHoliday->fetchAll(PDO::FETCH_ASSOC) ?: []);

            } else if (isset($_GET['from']) && !empty($_GET['from']) && isset($_GET['to']) && !empty($_GET['to'])) {
                $from = $_GET['from'];
                $to = $_GET['to'];

                // 1. Night shifts
                $nightSql = "SELECT 'night' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                             FROM night_shift_registrations r 
                             JOIN users u ON r.user_id = u.id 
                             WHERE r.shift_date BETWEEN ? AND ?";
                $nightParams = [$from, $to];
                if ($userIdFilter !== null) {
                    $nightSql .= " AND r.user_id = ?";
                    $nightParams[] = $userIdFilter;
                }
                $stmtNight = $this->db->prepare($nightSql);
                $stmtNight->execute($nightParams);
                $shifts = array_merge($shifts, $stmtNight->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 2. Weekend shifts
                $weekendSql = "SELECT 'weekend' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM weekend_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE r.shift_date BETWEEN ? AND ?";
                $weekendParams = [$from, $to];
                if ($userIdFilter !== null) {
                    $weekendSql .= " AND r.user_id = ?";
                    $weekendParams[] = $userIdFilter;
                }
                $stmtWeekend = $this->db->prepare($weekendSql);
                $stmtWeekend->execute($weekendParams);
                $shifts = array_merge($shifts, $stmtWeekend->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 3. Holiday shifts
                $holidaySql = "SELECT 'holiday' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, r.holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM holiday_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE r.shift_date BETWEEN ? AND ?";
                $holidayParams = [$from, $to];
                if ($userIdFilter !== null) {
                    $holidaySql .= " AND r.user_id = ?";
                    $holidayParams[] = $userIdFilter;
                }
                $stmtHoliday = $this->db->prepare($holidaySql);
                $stmtHoliday->execute($holidayParams);
                $shifts = array_merge($shifts, $stmtHoliday->fetchAll(PDO::FETCH_ASSOC) ?: []);
            }

            respond(200, [
                'check_ins' => $rows,
                'shifts' => $shifts
            ], 'Lấy danh sách check-in và trực ca thành công');
        }

        respond(200, $rows, 'Lấy danh sách check-in thành công');
    }

    public function store(array $auth): void {
        $b = getBody();
        $selfieUrl = trim($b['selfie_url'] ?? '');
        $reason = trim($b['reason'] ?? '');
        $today = trim($b['check_in_date'] ?? date('Y-m-d'));
        $currentTime = trim($b['check_in_time'] ?? date('H:i:s'));
        $action = trim($b['action'] ?? ''); // 'checkin' or 'checkout' or auto-detect
        
        $isSupplementary = ($today !== date('Y-m-d')) || (!empty($b['is_supplementary']));

        // Fetch system settings for checkout & auto-approve requirements
        $stmtSettings = $this->db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('require_checkin_weekend_lead', 'require_checkin_holiday_lead', 'holiday_schedules', 'require_checkout', 'auto_approve_checkin', 'global_work_start_time', 'global_work_end_time')");
        $stmtSettings->execute();
        $settingsMap = $stmtSettings->fetchAll(PDO::FETCH_KEY_PAIR);

        $reqCheckout = isset($settingsMap['require_checkout']) ? (int)$settingsMap['require_checkout'] : 0;
        $autoApprove = isset($settingsMap['auto_approve_checkin']) ? (int)$settingsMap['auto_approve_checkin'] : 0;
        $reqWeekend = isset($settingsMap['require_checkin_weekend_lead']) ? (int)$settingsMap['require_checkin_weekend_lead'] : 0;
        $reqHoliday = isset($settingsMap['require_checkin_holiday_lead']) ? (int)$settingsMap['require_checkin_holiday_lead'] : 0;

        // Check if user is on leave for that date
        $stmtLeave = $this->db->prepare("SELECT 1 FROM consultant_leaves WHERE consultant_id = ? AND ? BETWEEN start_date AND end_date LIMIT 1");
        $stmtLeave->execute([$auth['user_id'], $today]);
        if ($stmtLeave->fetch()) {
            respond(400, null, 'Bạn đang trong thời gian nghỉ phép, không cần và không thể check-in vào ngày này.', false);
        }

        // Fetch existing check_in record for today
        $stmtExisting = $this->db->prepare("SELECT * FROM check_ins WHERE user_id = ? AND check_in_date = ? LIMIT 1");
        $stmtExisting->execute([$auth['user_id'], $today]);
        $existingRow = $stmtExisting->fetch(PDO::FETCH_ASSOC);

        // Fetch user work hours
        $stmtUser = $this->db->prepare("SELECT work_start_time, work_end_time, use_custom_work_hours FROM users WHERE id = ?");
        $stmtUser->execute([$auth['user_id']]);
        $uRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
        
        $workStartTime = '08:00';
        $workEndTime = '17:30';
        if ($uRow) {
            if ((int)($uRow['use_custom_work_hours'] ?? 0) === 1) {
                $workStartTime = $uRow['work_start_time'] ?: '08:00';
                $workEndTime = $uRow['work_end_time'] ?: '17:30';
            } else {
                $workStartTime = $settingsMap['global_work_start_time'] ?? '08:00';
                $workEndTime = $settingsMap['global_work_end_time'] ?? '17:30';
            }
        }

        // ==================== FLOW A: CHECK-OUT (RA CA) ====================
        if (($action === 'checkout' || ($reqCheckout === 1 && $existingRow && empty($existingRow['check_out_time']))) && !$isSupplementary) {
            if (!$existingRow) {
                respond(400, null, 'Bạn chưa thực hiện Chấm công Vào ca hôm nay, không thể chấm công Ra ca.', false);
            }

            $outTimeStr = $today . ' ' . $currentTime;
            $workEndStr = $today . ' ' . substr($workEndTime, 0, 5) . ':00';
            
            $earlyMinutes = 0;
            $checkOutStatus = 'on_time';

            if (strtotime($outTimeStr) < strtotime($workEndStr)) {
                $earlyMinutes = (int)ceil((strtotime($workEndStr) - strtotime($outTimeStr)) / 60);
                $checkOutStatus = 'early';
            }

            $coLat = trim($b['latitude'] ?? $b['checkout_latitude'] ?? '');
            $coLng = trim($b['longitude'] ?? $b['checkout_longitude'] ?? '');
            $coAddr = trim($b['location_address'] ?? $b['checkout_location_address'] ?? '');

            $updateOut = $this->db->prepare("UPDATE check_ins SET check_out_time = ?, early_minutes = ?, check_out_status = ?, checkout_latitude = ?, checkout_longitude = ?, checkout_location_address = ? WHERE id = ?");
            $updateOut->execute([$outTimeStr, $earlyMinutes, $checkOutStatus, $coLat ?: null, $coLng ?: null, $coAddr ?: null, $existingRow['id']]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CHECK_OUT', 'check_in', $existingRow['id'], json_encode([
                'date' => $today,
                'time' => $currentTime,
                'early_minutes' => $earlyMinutes,
                'check_out_status' => $checkOutStatus
            ]));

            $msgText = $earlyMinutes > 0
                ? "Ghi nhận Chấm công Ra ca thành công! (Về sớm {$earlyMinutes} phút)"
                : "Ghi nhận Chấm công Ra ca thành công! Chúc bạn buổi tối vui vẻ.";

            respond(200, [
                'id' => $existingRow['id'],
                'status' => $existingRow['status'],
                'check_out_time' => $outTimeStr,
                'early_minutes' => $earlyMinutes,
                'check_out_status' => $checkOutStatus,
                'message' => $msgText
            ]);
            return;
        }

        // ==================== FLOW B: CHECK-IN (VÀO CA) ====================
        if ($existingRow) {
            respond(409, null, 'Bạn đã thực hiện check-in hoặc gửi yêu cầu cho ngày này rồi', false);
        }

        if (empty($selfieUrl) && !$isSupplementary) {
            respond(422, null, 'Ảnh selfie check-in là bắt buộc', false);
        }

        $lat = trim($b['latitude'] ?? '');
        $lng = trim($b['longitude'] ?? '');
        if (!$isSupplementary && (empty($lat) || empty($lng))) {
            respond(422, null, 'Quyền truy cập vị trí (GPS) là bắt buộc để chấm công. Vui lòng cho phép định vị trên thiết bị.', false);
        }

        if ($isSupplementary && empty($reason)) {
            respond(422, null, 'Vui lòng cung cấp lý do/ghi chú cập nhật bổ sung chấm công', false);
        }

        $dayOfWeek = (int)date('N', strtotime($today));
        $isWeekend = ($dayOfWeek >= 6);

        $isHoliday = false;
        if (!empty($settingsMap['holiday_schedules'])) {
            try {
                $holidays = json_decode($settingsMap['holiday_schedules'], true);
                if (is_array($holidays)) {
                    foreach ($holidays as $h) {
                        if (!empty($h['start']) && !empty($h['end'])) {
                            if ($today >= $h['start'] && $today <= $h['end']) {
                                $isHoliday = true;
                                break;
                            }
                        }
                    }
                }
            } catch (\Throwable $t) {}
        }

        $isMandatoryAutoApprove = ($isWeekend && $reqWeekend === 1) || ($isHoliday && $reqHoliday === 1);

        $currentHM = substr($currentTime, 0, 5);
        $workStartHM = substr($workStartTime, 0, 5);
        $isLate = ($currentHM > $workStartHM);

        $lateMinutes = 0;
        if ($isLate) {
            $lateMinutes = (int)ceil((strtotime($today . ' ' . $currentHM . ':00') - strtotime($today . ' ' . $workStartHM . ':00')) / 60);
        }

        $status = 'approved';
        if ($isSupplementary) {
            $status = 'pending_approval';
        } else if ($isMandatoryAutoApprove || $autoApprove === 1) {
            // Auto-approve check-in when auto_approve_checkin is ON or on Weekend/Holiday mandatory check-in
            $status = 'approved';
        } else if ($isLate) {
            if (empty($reason)) {
                respond(422, null, 'Bạn đi làm trễ ' . $lateMinutes . ' phút. Vui lòng gửi lý do để quản lý phê duyệt.', false);
            }
            $status = 'pending_approval';
        }

        $inTimeStr = $today . ' ' . $currentTime;

        $addr = trim($b['location_address'] ?? '');

        // Insert check-in log with self-healing schema check
        try {
            $insert = $this->db->prepare("
                INSERT INTO check_ins (user_id, check_in_date, check_in_time, late_minutes, selfie_url, status, reason, latitude, longitude, location_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insert->execute([$auth['user_id'], $today, $inTimeStr, $lateMinutes, $selfieUrl ?: null, $status, $reason ?: null, $lat ?: null, $lng ?: null, $addr ?: null]);
        } catch (\Throwable $e) {
            // Auto-heal check_ins table if columns are missing in DB schema
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN late_minutes INT DEFAULT 0 AFTER check_in_time"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN selfie_url TEXT NULL AFTER late_minutes"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN reason TEXT NULL AFTER status"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN latitude VARCHAR(50) NULL AFTER selfie_url"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN longitude VARCHAR(50) NULL AFTER latitude"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN location_address VARCHAR(500) NULL AFTER longitude"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN checkout_latitude VARCHAR(50) NULL"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN checkout_longitude VARCHAR(50) NULL"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN checkout_location_address VARCHAR(500) NULL"); } catch (\Throwable $ex) {}
            
            $insert = $this->db->prepare("
                INSERT INTO check_ins (user_id, check_in_date, check_in_time, late_minutes, selfie_url, status, reason, latitude, longitude, location_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insert->execute([$auth['user_id'], $today, $inTimeStr, $lateMinutes, $selfieUrl ?: null, $status, $reason ?: null, $lat ?: null, $lng ?: null, $addr ?: null]);
        }
        
        $newId = (int)$this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CHECK_IN', 'check_in', $newId, json_encode([
            'date' => $today,
            'time' => $currentTime,
            'late_minutes' => $lateMinutes,
            'is_late' => $isLate,
            'status' => $status
        ]));

        // Send notifications to Admins & Managers if late (and approval is needed) or supplementary request
        if (($isLate && $status === 'pending_approval') || $isSupplementary) {
            require_once __DIR__ . '/../NotificationService.php';
            $stmtUserDetails = $this->db->prepare("SELECT full_name, team_id FROM users WHERE id = ?");
            $stmtUserDetails->execute([$auth['user_id']]);
            $uDetails = $stmtUserDetails->fetch(PDO::FETCH_ASSOC);

            $eventType = $isSupplementary ? 'ATTENDANCE_UPDATE' : 'CHECKIN_LATE';
            NotificationService::send($this->db, $auth['tenant_id'], $eventType, [
                'user_name' => $uDetails ? $uDetails['full_name'] : 'Nhân viên',
                'team_id' => $uDetails ? $uDetails['team_id'] : null,
                'date' => $today,
                'time' => $currentTime,
                'reason' => $reason
            ]);
        }

        $msgText = 'Check-in thành công!';
        if ($status === 'approved' && $isLate) {
            $msgText = "Đã ghi nhận Chấm công Vào ca! (Đi trễ {$lateMinutes} phút)";
        } else if ($status === 'pending_approval') {
            $msgText = $isSupplementary ? 'Đã gửi yêu cầu bổ sung chấm công thành công. Đang chờ phê duyệt.' : 'Đã gửi báo cáo đi trễ thành công. Đang chờ phê duyệt.';
        }

        respond(200, [
            'id' => $newId,
            'status' => $status,
            'late_minutes' => $lateMinutes,
            'message' => $msgText
        ]);
    }

    public function update(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director', 'assistant', 'manager']);
        $b = getBody();
        $status = trim($b['status'] ?? '');
        $reason = trim($b['reason'] ?? ''); // Optionally update reason or note

        if (!in_array($status, ['approved', 'rejected', 'pending_approval'], true)) {
            respond(422, null, 'Trạng thái phê duyệt không hợp lệ', false);
        }

        if ($status === 'rejected' && empty($reason)) {
            respond(422, null, 'Vui lòng cung cấp lý do từ chối yêu cầu chấm công', false);
        }

        // Fetch check-in record to make sure it belongs to the same tenant
        $stmtCheck = $this->db->prepare("
            SELECT c.*, u.tenant_id, u.full_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        $stmtCheck->execute([$id]);
        $row = $stmtCheck->fetch();

        if (!$row) {
            respond(404, null, 'Không tìm thấy bản ghi check-in', false);
        }

        if ((int)$row['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền thao tác trên dữ liệu này', false);
        }

        if ($auth['role'] === 'manager') {
            $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtUserTeam->execute([$row['user_id']]);
            $targetUserTeamId = $stmtUserTeam->fetchColumn();

            $isTeamMember = false;
            if ($targetUserTeamId !== null) {
                $stmtCheckManager = $this->db->prepare("
                    SELECT 1 FROM teams WHERE id = ? AND FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    UNION
                    SELECT 1 FROM users WHERE id = ? AND team_id = ? AND role = 'manager'
                ");
                $stmtCheckManager->execute([$targetUserTeamId, $auth['user_id'], $auth['user_id'], $targetUserTeamId]);
                $isTeamMember = (bool)$stmtCheckManager->fetch();
            }

            if ((int)$row['user_id'] !== (int)$auth['user_id'] && !$isTeamMember) {
                respond(403, null, 'Bạn chỉ có quyền phê duyệt chấm công cho nhân viên thuộc nhóm của mình', false);
            }
        }

        // Ensure admin_note column exists
        try {
            $this->db->exec("ALTER TABLE check_ins ADD COLUMN admin_note VARCHAR(255) NULL AFTER reason");
        } catch (\Throwable $e) {}

        // Update status and admin_note, keeping original Sale reason intact
        $adminNote = (!empty($reason) && trim($reason) !== '') ? trim($reason) : null;
        $upd = $this->db->prepare("UPDATE check_ins SET status = ?, admin_note = COALESCE(?, admin_note) WHERE id = ?");
        $upd->execute([$status, $adminNote, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_CHECK_IN', 'check_in', $id, json_encode([
            'old_status' => $row['status'],
            'new_status' => $status,
            'sale_name' => $row['full_name']
        ]));

        // Send approval result notification to employee via NotificationService (In-App Bell, Email, Zalo, Telegram)
        require_once __DIR__ . '/../NotificationService.php';
        $isSupplementary = !empty($row['reason']) && (mb_stripos($row['reason'], 'bổ sung') !== false || $row['check_in_date'] !== date('Y-m-d'));
        NotificationService::send($this->db, $auth['tenant_id'], 'ATTENDANCE_APPROVAL_RESULT', [
            'user_id' => (int)$row['user_id'],
            'user_name' => $row['full_name'] ?? 'Nhân viên',
            'date' => $row['check_in_date'],
            'status' => $status,
            'reason' => $adminNote ?: ($row['reason'] ?? ''),
            'is_supplementary' => $isSupplementary
        ]);

        respond(200, null, 'Cập nhật trạng thái check-in thành công');
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);

        // Fetch check-in record
        $stmtCheck = $this->db->prepare("
            SELECT c.*, u.tenant_id, u.full_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        $stmtCheck->execute([$id]);
        $row = $stmtCheck->fetch();

        if (!$row) {
            respond(404, null, 'Không tìm thấy bản ghi check-in', false);
        }

        if ((int)$row['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền thao tác trên dữ liệu này', false);
        }

        // Delete
        $this->db->prepare("DELETE FROM check_ins WHERE id = ?")->execute([$id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_CHECK_IN', 'check_in', $id, json_encode([
            'sale_name' => $row['full_name'],
            'check_in_date' => $row['check_in_date']
        ]));

        respond(200, null, 'Đã xóa bản ghi check-in thành công');
    }
}
