<?php
// backend/cron_ai_worker.php
// Tiến trình chạy ngầm (Worker) để gọi Gemini API và phân bổ Lead bất đồng bộ

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

function runAIScreenerWorker($conn) {
    // Ngăn chặn chạy trùng lặp tiến trình bằng file lock
    $lockFile = __DIR__ . '/cron_ai_worker.lock';
    $fp = @fopen($lockFile, 'c+');
    if (!$fp || !@flock($fp, LOCK_EX | LOCK_NB)) {
        echo "[" . date('Y-m-d H:i:s') . "] Another instance of cron_ai_worker.php is already running. Exiting.\n";
        return;
    }

    // Đặt thời gian thực thi không giới hạn
    set_time_limit(0);

    // 1. Lấy danh sách tối đa 20 Lead đang chờ duyệt AI hoặc bị lỗi kết nối dưới 3 lần
    $conn->begin_transaction();
    $res = $conn->query("
        SELECT id, phone, email, name, source, type, note, target_round_id, ai_attempts, connection_id 
        FROM leads 
        WHERE status = 'pending_approval' 
          AND (ai_screener_status = 'pending' OR (ai_screener_status = 'error' AND ai_attempts < 3))
        ORDER BY id ASC
        LIMIT 20
        FOR UPDATE SKIP LOCKED
    ");

    $leads = [];
    while ($row = $res->fetch_assoc()) {
        $leads[] = $row;
    }

    if (empty($leads)) {
        $conn->commit();
        @flock($fp, LOCK_UN);
        @fclose($fp);
        echo "[" . date('Y-m-d H:i:s') . "] No pending AI screening leads.\n";
        return;
    }

    // Commit transaction ngay để nhường lock cho các tiến trình khác
    $conn->commit();

    echo "[" . date('Y-m-d H:i:s') . "] Found " . count($leads) . " leads for AI screening. Processing...\n";

    // 2. Xử lý từng Lead
    foreach ($leads as $lead) {
        $leadId = (int)$lead['id'];
        $targetRoundId = (int)$lead['target_round_id'];
        $attempts = (int)$lead['ai_attempts'] + 1;

        echo "[" . date('Y-m-d H:i:s') . "] Processing Lead ID: $leadId (Attempt $attempts/3)...\n";

        // Tăng số lần thử trước khi gọi API đề phòng bị crash giữa chừng
        $updAttempts = $conn->prepare("UPDATE leads SET ai_attempts = ? WHERE id = ?");
        if ($updAttempts) {
            $updAttempts->bind_param("ii", $attempts, $leadId);
            $updAttempts->execute();
            $updAttempts->close();
        }

        // Kéo cấu hình quy tắc AI cho vòng xoay cụ thể của Lead
        $aiRules = null;
        $belowStandardFallbackEnabled = 0;
        $belowStandardAutoApprove = 0;
        $belowStandardFallbackRoundId = 0;

        $configsJson = get_system_setting($conn, 'ai_screener_configs');
        $configs = json_decode($configsJson, true);
        if (is_array($configs) && !empty($configs)) {
            foreach ($configs as $config) {
                $rounds = $config['rounds'] ?? [];
                $normalizedRounds = array_map('intval', $rounds);
                if (in_array($targetRoundId, $normalizedRounds)) {
                    $aiRules = $config['ai_rules'] ?? null;
                    $belowStandardFallbackEnabled = !empty($config['below_standard_fallback_enabled']) ? 1 : 0;
                    $belowStandardAutoApprove = !empty($config['below_standard_auto_approve']) ? 1 : 0;
                    $belowStandardFallbackRoundId = !empty($config['below_standard_fallback_round_id']) ? (int)$config['below_standard_fallback_round_id'] : 0;
                    break;
                }
            }
        }

        // Fallback cấu hình cũ
        if ($aiRules === null) {
            $aiRules = get_system_setting($conn, 'ai_screener_rules');
            $belowStandardFallbackEnabled = (int)get_system_setting($conn, 'ai_screener_below_standard_fallback_enabled');
            $belowStandardFallbackRoundId = (int)get_system_setting($conn, 'ai_screener_below_standard_fallback_round_id');
            $belowStandardAutoApprove = (int)get_system_setting($conn, 'ai_screener_below_standard_auto_approve');
        }

        // Tạo tham số leadData
        $leadData = [
            'phone' => $lead['phone'],
            'email' => $lead['email'],
            'name' => $lead['name'],
            'source' => $lead['source'],
            'type' => $lead['type'],
            'note' => $lead['note'],
            'connection_id' => $lead['connection_id']
        ];

        // Gọi API thực tế thông qua hàm cũ đã tối ưu sẵn trong webhook_logic.php
        // Hàm runAIScreener() sử dụng cURL và đã được cấu hình timeout
        $aiResult = runAIScreener($conn, $leadData, $aiRules);

        echo "[" . date('Y-m-d H:i:s') . "] Lead ID $leadId AI status: " . $aiResult['status'] . ", Reason: " . ($aiResult['reason'] ?? '') . "\n";

        if ($aiResult['status'] === 'passed') {
            // 2.1. Đạt chuẩn AI -> Phân bổ số
            distributeLeadAfterAI($conn, $leadId, $targetRoundId, $aiResult, $leadData);
        } else if ($aiResult['status'] === 'failed') {
            // 2.2. Dưới chuẩn AI -> Kiểm tra cấu hình auto-approve vòng fallback
            if ($belowStandardFallbackEnabled === 1 && $belowStandardAutoApprove === 1 && $belowStandardFallbackRoundId > 0) {
                echo "[" . date('Y-m-d H:i:s') . "] Lead ID $leadId failed AI but auto-approving to Fallback Round ID: $belowStandardFallbackRoundId\n";
                $aiResult['reason'] = "[Auto-Approve Fallback] " . $aiResult['reason'];
                distributeLeadAfterAI($conn, $leadId, $belowStandardFallbackRoundId, $aiResult, $leadData);
            } else {
                // Tạm giữ cho Admin duyệt tay
                $conn->begin_transaction();
                try {
                    $updHeld = $conn->prepare("UPDATE leads SET status = 'pending_approval', ai_screener_status = 'failed', ai_evaluation = ? WHERE id = ?");
                    $updHeld->bind_param("si", $aiResult['reason'], $leadId);
                    $updHeld->execute();
                    $updHeld->close();

                    $logMsg = 'Tạm giữ bởi AI (Chạy ngầm): ' . $aiResult['reason'];
                    $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
                    $chkLog->bind_param("i", $leadId);
                    $chkLog->execute();
                    $logRow = $chkLog->get_result()->fetch_assoc();
                    $chkLog->close();

                    if ($logRow) {
                        $updLog = $conn->prepare("UPDATE distribution_logs SET message = ?, received_at = NOW() WHERE id = ?");
                        $updLog->bind_param("si", $logMsg, $logRow['id']);
                        $updLog->execute();
                        $updLog->close();
                    } else {
                        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', $logMsg, false);
                    }
                    $conn->commit();

                    // Đồng bộ live Sheet ngược về
                    triggerTwoWaySync($conn, $leadId);
                } catch (Exception $e) {
                    $conn->rollback();
                    error_log("Failed to update failed AI lead: " . $e->getMessage());
                }

                // Gửi thông báo cho admin duyệt tay
                try {
                    $roundName = '';
                    if ($targetRoundId) {
                        $rStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                        if ($rStmt) {
                            $rStmt->bind_param("i", $targetRoundId);
                            $rStmt->execute();
                            $roundName = $rStmt->get_result()->fetch_assoc()['round_name'] ?? '';
                            $rStmt->close();
                        }
                    }
                    sendHeldLeadNotifications(
                        $conn, 
                        $leadId, 
                        $leadData['name'], 
                        $leadData['phone'], 
                        $aiResult['reason'], 
                        $roundName, 
                        $leadData['email'], 
                        $leadData['source'], 
                        $leadData['type'], 
                        $leadData['note']
                    );
                } catch (Exception $ex) {
                    error_log("Failed to send held notification: " . $ex->getMessage());
                }
            }
        } else {
            // 2.3. Lỗi kết nối / Quá tải API (status === 'error')
            $conn->begin_transaction();
            try {
                $updHeld = $conn->prepare("UPDATE leads SET ai_screener_status = 'error', ai_evaluation = ? WHERE id = ?");
                $updHeld->bind_param("si", $aiResult['reason'], $leadId);
                $updHeld->execute();
                $updHeld->close();

                if ($attempts >= 3) {
                    // Nếu đã thử 3 lần lỗi, ghi log phân bổ lỗi hệ thống để admin can thiệp
                    $logMsg = 'Lỗi kết nối AI (Đã thử 3 lần thất bại): ' . $aiResult['reason'];
                    $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
                    $chkLog->bind_param("i", $leadId);
                    $chkLog->execute();
                    $logRow = $chkLog->get_result()->fetch_assoc();
                    $chkLog->close();

                    if ($logRow) {
                        $updLog = $conn->prepare("UPDATE distribution_logs SET message = ?, received_at = NOW() WHERE id = ?");
                        $updLog->bind_param("si", $logMsg, $logRow['id']);
                        $updLog->execute();
                        $updLog->close();
                    } else {
                        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', $logMsg, false);
                    }
                }
                $conn->commit();

                // Đồng bộ live Sheet ngược về
                triggerTwoWaySync($conn, $leadId);
            } catch (Exception $e) {
                $conn->rollback();
                error_log("Failed to update error AI lead: " . $e->getMessage());
            }
        }
    }

    @flock($fp, LOCK_UN);
    @fclose($fp);
}

function distributeLeadAfterAI($conn, $leadId, $targetRoundId, $aiScreenerResult, $leadData) {
    // Phân bổ Round-Robin
    $assignedConsultantId = null;
    $status = 'pending';
    $message = 'Không có tư vấn viên hoạt động trong vòng xoay.';

    if ($targetRoundId) {
        $assignResult = getNextConsultantInRound($conn, $targetRoundId);
        if ($assignResult) {
            $assignedConsultantId = $assignResult['id'];
            $status = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
            $message = $assignResult['is_compensation'] 
                ? (isset($assignResult['is_starvation']) ? 'Được phân bổ bù lượt ngoài giờ/nghỉ phép (Starvation Prevention) (Chạy ngầm).' : 'Được phân bổ đền bù lượt lỗi (Chạy ngầm).') 
                : 'Được phân bổ tự động qua vòng xoay (Chạy ngầm).';

            // Check working hours
            $whStart = '00:00';
            $whEnd = '23:59';
            $workSchedule = null;
            $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
            if ($whStmt) {
                $whStmt->bind_param("i", $assignedConsultantId);
                $whStmt->execute();
                $whRes = $whStmt->get_result();
                if ($whRes && $whRow = $whRes->fetch_assoc()) {
                    $whStart = $whRow['work_start_time'] ?? '00:00';
                    $whEnd = $whRow['work_end_time'] ?? '23:59';
                    $workSchedule = $whRow['work_schedule'] ?? null;
                }
                $whStmt->close();
            }
            $currentTime = date('H:i');
            if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule)) {
                $status = 'pending_work_hours';
                $message .= ' (Trì hoãn: ngoài khung giờ làm việc)';
            }
        }
    }

    $conn->begin_transaction();
    try {
        $leadStatus = 'active';
        $updLead = $conn->prepare("UPDATE leads SET status = ?, assigned_to = ?, ai_screener_status = ?, ai_evaluation = ? WHERE id = ?");
        $aiStatus = $aiScreenerResult['status'];
        $aiEval = $aiScreenerResult['reason'];
        $updLead->bind_param("sisss", $leadStatus, $assignedConsultantId, $aiStatus, $aiEval, $leadId);
        $updLead->execute();
        $updLead->close();

        $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
        $chkLog->bind_param("i", $leadId);
        $chkLog->execute();
        $logRow = $chkLog->get_result()->fetch_assoc();
        $chkLog->close();

        if ($logRow) {
            $updLog = $conn->prepare("UPDATE distribution_logs SET assigned_to = ?, round_id = ?, status = ?, message = ?, received_at = NOW() WHERE id = ?");
            $targetRoundVal = $targetRoundId > 0 ? $targetRoundId : null;
            $updLog->bind_param("iissi", $assignedConsultantId, $targetRoundVal, $status, $message, $logRow['id']);
            $updLog->execute();
            $updLog->close();
        } else {
            logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, $status, $message, false);
        }
        $conn->commit();

        // Đồng bộ live Sheet ngược về
        triggerTwoWaySync($conn, $leadId);
    } catch (Exception $e) {
        $conn->rollback();
        error_log("Failed to distribute lead after AI: " . $e->getMessage());
        return false;
    }

    // Gửi thông báo cho sale (Chạy bất đồng bộ qua zalo_queue và mail_queue)
    try {
        if ($assignedConsultantId && $status !== 'pending_work_hours') {
            $stmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $assignedConsultantId);
                $stmt->execute();
                $cRes = $stmt->get_result();
                if ($cRes->num_rows > 0) {
                    $c = $cRes->fetch_assoc();
                    
                    require_once __DIR__ . '/mailer.php';
                    require_once __DIR__ . '/zalo_bot.php';

                    $ccEmails = '';
                    $roundName = '';
                    $connId = $leadData['connection_id'] ?? null;
                    if ($connId) {
                        $cStmt = $conn->prepare("SELECT cc_emails FROM sheet_connections WHERE id = ?");
                        if ($cStmt) {
                            $cStmt->bind_param("i", $connId);
                            $cStmt->execute();
                            $ccEmails = $cStmt->get_result()->fetch_assoc()['cc_emails'] ?? '';
                            $cStmt->close();
                        }
                    }
                    if ($targetRoundId) {
                        $rStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                        if ($rStmt) {
                            $rStmt->bind_param("i", $targetRoundId);
                            $rStmt->execute();
                            $roundName = $rStmt->get_result()->fetch_assoc()['round_name'] ?? '';
                            $rStmt->close();
                        }
                    }

                    // Gửi email & zalo (mặc định sync = false để chèn vào hàng đợi)
                    try {
                        sendLeadAssignedEmailToSale(
                            $c['email'], 
                            $c['name'], 
                            $leadData['name'], 
                            $leadData['phone'], 
                            $leadData['note'], 
                            $leadData['source'], 
                            $ccEmails, 
                            $roundName, 
                            $leadId, 
                            $assignedConsultantId, 
                            $targetRoundId
                        );
                    } catch (Exception $mailEx) {
                        error_log("Error sending post-AI email: " . $mailEx->getMessage());
                    }
                    
                    try {
                        sendLeadAssignedZaloMessageToSale(
                            $assignedConsultantId, 
                            $c['name'], 
                            $leadData['name'], 
                            $leadData['phone'], 
                            $leadData['note'], 
                            $leadData['source'], 
                            $roundName, 
                            $leadId, 
                            $targetRoundId, 
                            $leadData['email'], 
                            $leadData['type'],
                            false // sync = false to queue it!
                        );
                    } catch (Exception $zaloEx) {
                        error_log("Error sending post-AI Zalo: " . $zaloEx->getMessage());
                    }
                }
                $stmt->close();
            }
        }
    } catch (Exception $notifyEx) {
        error_log("Error in post-AI notifications: " . $notifyEx->getMessage());
    }

    return true;
}

// Chạy trực tiếp nếu từ CLI hoặc cron
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    runAIScreenerWorker($conn);
}
