<?php
// cron_recurring_tasks.php
// Script to parse activities of type 'task' and generate next task occurrences based on recurrence rules.

if (!function_exists('runRecurringTasksCron')) {
    function runRecurringTasksCron($conn) {
        if (function_exists('logSync')) {
            logSync("Starting recurring tasks processing...");
        } else {
            echo "[" . date('Y-m-d H:i:s') . "] Starting recurring tasks processing...\n";
        }

        // 1. Get all active tasks with recurrence pattern
        $sql = "SELECT id, tenant_id, user_id, type, subject, body, status, priority, due_date, related_type, related_id, tags, participant_ids, require_approval, approver_id, link 
                FROM activities 
                WHERE type = 'task' 
                  AND deleted_at IS NULL 
                  AND body LIKE '%\"pattern\"%' 
                  AND body NOT LIKE '%\"pattern\":\"none\"%'";
                  
        $result = $conn->query($sql);
        if (!$result) {
            $err = "Error fetching activities: " . $conn->error;
            if (function_exists('logSync')) {
                logSync($err);
            } else {
                echo "[" . date('Y-m-d H:i:s') . "] " . $err . "\n";
            }
            return;
        }

        $today = date('Y-m-d');
        $todayDayOfWeek = (int)date('w'); // 0 (for Sunday) through 6 (for Saturday)
        $todayDayOfMonth = (int)date('j'); // Day of the month without leading zeros (1 to 31)

        while ($row = $result->fetch_assoc()) {
            $bodyText = $row['body'];
            $bodyData = json_decode($bodyText, true);
            if (!$bodyData || empty($bodyData['erp_task']['recurrence'])) {
                continue;
            }

            $recurrence = $bodyData['erp_task']['recurrence'];
            $pattern = $recurrence['pattern'] ?? 'none';
            $weeklyDays = $recurrence['weekly_days'] ?? [];
            $monthlyDay = (int)($recurrence['monthly_day'] ?? 1);
            $lastGenerated = $recurrence['last_generated'] ?? '';

            // If already generated for today, skip
            if ($lastGenerated === $today) {
                continue;
            }

            $shouldGenerate = false;

            if ($pattern === 'daily') {
                $shouldGenerate = true;
            } elseif ($pattern === 'weekly') {
                if (in_array($todayDayOfWeek, $weeklyDays)) {
                    $shouldGenerate = true;
                }
            } elseif ($pattern === 'monthly') {
                // Match monthly day, or handle end of month if monthlyDay is e.g. 31 and current month has 30 days
                $daysInMonth = (int)date('t');
                if ($todayDayOfMonth === $monthlyDay) {
                    $shouldGenerate = true;
                } elseif ($monthlyDay > $daysInMonth && $todayDayOfMonth === $daysInMonth) {
                    // If requested 31st but month has 30 days, generate on 30th
                    $shouldGenerate = true;
                }
            } elseif ($pattern === 'custom_days') {
                $daysInterval = (int)($recurrence['days_interval'] ?? 1);
                if ($daysInterval < 1) {
                    $daysInterval = 1;
                }
                if (empty($lastGenerated)) {
                    $shouldGenerate = true;
                } else {
                    $daysSince = (int)round((strtotime($today) - strtotime($lastGenerated)) / 86400);
                    if ($daysSince >= $daysInterval) {
                        $shouldGenerate = true;
                    }
                }
            }

            if ($shouldGenerate) {
                $msg = "Generating recurring task instance for parent task ID {$row['id']}...";
                if (function_exists('logSync')) {
                    logSync($msg);
                } else {
                    echo "[" . date('Y-m-d H:i:s') . "] " . $msg . "\n";
                }

                // 1. Create a copy of the body for the new child task
                $childBodyData = $bodyData;
                
                // Set child task recurrence pattern to 'none' so the child task itself doesn't recur
                if (isset($childBodyData['erp_task']['recurrence'])) {
                    $childBodyData['erp_task']['recurrence']['pattern'] = 'none';
                    $childBodyData['erp_task']['recurrence']['weekly_days'] = [];
                    $childBodyData['erp_task']['recurrence']['monthly_day'] = 1;
                    $childBodyData['erp_task']['recurrence']['days_interval'] = 1;
                    $childBodyData['erp_task']['recurrence']['last_generated'] = '';
                }
                
                // Reset checklist item status to false (not done)
                if (!empty($childBodyData['erp_task']['checklist'])) {
                    foreach ($childBodyData['erp_task']['checklist'] as &$item) {
                        $item['done'] = false;
                    }
                }
                
                $childBodyJson = json_encode($childBodyData, JSON_UNESCAPED_UNICODE);

                // 2. Insert new child task with planned status and due_date = today
                $timePart = '23:59:59';
                if (!empty($row['due_date'])) {
                    $parts = explode(' ', $row['due_date']);
                    if (count($parts) > 1) {
                        $timePart = $parts[1];
                    }
                }
                $childDueDate = $today . ' ' . $timePart;

                $stmtInsert = $conn->prepare("
                    INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, done_at, related_type, related_id, tags, participant_ids, progress, require_approval, approver_id, approval_status, link)
                    VALUES (?, ?, ?, 'task', ?, ?, 'planned', ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, NULL, ?)
                ");
                
                if (!$stmtInsert) {
                    $errPrep = "Statement preparation failed: " . $conn->error;
                    if (function_exists('logSync')) {
                        logSync($errPrep);
                    } else {
                        echo "[" . date('Y-m-d H:i:s') . "] " . $errPrep . "\n";
                    }
                    continue;
                }

                $tenantId = (int)$row['tenant_id'];
                $userId = !empty($row['user_id']) ? (int)$row['user_id'] : null;
                $createdBy = !empty($row['created_by']) ? (int)$row['created_by'] : null;
                $subject = $row['subject'];
                $priority = $row['priority'] ?: 'medium';
                $relatedType = $row['related_type'] ?: null;
                $relatedId = !empty($row['related_id']) ? (int)$row['related_id'] : null;
                $tags = $row['tags'] ?: null;
                $participantIds = $row['participant_ids'] ?: null;
                $requireApproval = (int)($row['require_approval'] ?? 0);
                $approverId = !empty($row['approver_id']) ? (int)$row['approver_id'] : null;
                $link = $row['link'] ?: null;

                $stmtInsert->bind_param(
                    "iiisssssssiiis",
                    $tenantId,
                    $userId,
                    $createdBy,
                    $subject,
                    $childBodyJson,
                    $priority,
                    $childDueDate,
                    $relatedType,
                    $relatedId,
                    $tags,
                    $participantIds,
                    $requireApproval,
                    $approverId,
                    $link
                );

                if ($stmtInsert->execute()) {
                    $newTaskId = $stmtInsert->insert_id;
                    $successMsg = "Child task created with ID $newTaskId.";
                    if (function_exists('logSync')) {
                        logSync($successMsg);
                    } else {
                        echo "[" . date('Y-m-d H:i:s') . "] " . $successMsg . "\n";
                    }
                    
                    // Trigger audit log for creation
                    $logMsg = json_encode(['subject' => $subject, 'type' => 'task', 'recurring_parent' => $row['id']], JSON_UNESCAPED_UNICODE);
                    $stmtAudit = $conn->prepare("
                        INSERT INTO audit_logs (tenant_id, user_id, action, resource, resource_id, new_data)
                        VALUES (?, 0, 'CREATE', 'activity', ?, ?)
                    ");
                    if ($stmtAudit) {
                        $stmtAudit->bind_param("iis", $tenantId, $newTaskId, $logMsg);
                        $stmtAudit->execute();
                        $stmtAudit->close();
                    }

                    // Send notification to the assignee
                    if ($userId) {
                        $titleNotify = "Bạn có nhiệm vụ định kỳ mới: " . $subject;
                        $bodyNotify = "Nhiệm vụ định kỳ \"" . $subject . "\" đã tự động được tạo cho ngày hôm nay.";
                        $typeNotify = "task_assignment";
                        $linkNotify = "/activities/" . $newTaskId;
                        
                        $stmtNotify = $conn->prepare("
                            INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ");
                        if ($stmtNotify) {
                            $stmtNotify->bind_param("iissss", $userId, $tenantId, $titleNotify, $bodyNotify, $typeNotify, $linkNotify);
                            $stmtNotify->execute();
                            $stmtNotify->close();
                        }

                        // Send email if user has email
                        $stmtUser = $conn->prepare("SELECT email, full_name FROM users WHERE id=?");
                        if ($stmtUser) {
                            $stmtUser->bind_param("i", $userId);
                            $stmtUser->execute();
                            $resUser = $stmtUser->get_result();
                            $u = $resUser->fetch_assoc();
                            $stmtUser->close();

                            if ($u && !empty($u['email']) && function_exists('sendEmailNotification')) {
                                try {
                                    $emailSubject = "[RICH LAND] " . $titleNotify;
                                    $emailTitle = "Nhiệm vụ định kỳ";
                                    $emailContent = "Chào <strong>" . htmlspecialchars($u['full_name']) . "</strong>,<br/><br/>" .
                                                    htmlspecialchars($bodyNotify) . "<br/><br/>" .
                                                    "Vui lòng truy cập hệ thống theo đường dẫn để xử lý công việc: <a href='" . htmlspecialchars($linkNotify) . "'>Xem chi tiết</a>";
                                    sendEmailNotification($u['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                                } catch (Throwable $e) {
                                    error_log("Cron Recurring Task Email Error: " . $e->getMessage());
                                }
                            }
                        }
                    }
                } else {
                    $errExec = "Error inserting child task: " . $stmtInsert->error;
                    if (function_exists('logSync')) {
                        logSync($errExec);
                    } else {
                        echo "[" . date('Y-m-d H:i:s') . "] " . $errExec . "\n";
                    }
                }
                $stmtInsert->close();

                // 3. Update parent task's body last_generated value in DB to prevent re-generation today
                $bodyData['erp_task']['recurrence']['last_generated'] = $today;
                $parentBodyJson = json_encode($bodyData, JSON_UNESCAPED_UNICODE);

                $stmtUpdateParent = $conn->prepare("UPDATE activities SET body = ? WHERE id = ?");
                if ($stmtUpdateParent) {
                    $stmtUpdateParent->bind_param("si", $parentBodyJson, $row['id']);
                    $stmtUpdateParent->execute();
                    $stmtUpdateParent->close();
                }
            }
        }
    }
}
