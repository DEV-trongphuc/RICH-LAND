<?php
// backend/test_ai_notify.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$leadIds = [22171, 22172];

foreach ($leadIds as $leadId) {
    echo "=== TESTING NOTIFICATIONS FOR LEAD ID #$leadId ===\n";
    
    // 1. Get lead details
    echo "Querying lead details...\n";
    $lStmt = $conn->prepare("SELECT name, phone, email, source, type, note, connection_id, assigned_to FROM leads WHERE id = ?");
    $lStmt->bind_param("i", $leadId);
    $lStmt->execute();
    $leadData = $lStmt->get_result()->fetch_assoc();
    $lStmt->close();
    
    if (!$leadData) {
        echo "Lead ID #$leadId not found!\n\n";
        continue;
    }
    
    $assignedConsultantId = $leadData['assigned_to'];
    echo "Lead Name: {$leadData['name']}\n";
    echo "Assigned Consultant ID: " . ($assignedConsultantId ?: 'NULL') . "\n";
    
    // 2. Get distribution log status
    echo "Querying distribution log...\n";
    $logStmt = $conn->prepare("SELECT status, round_id FROM distribution_logs WHERE lead_id = ? ORDER BY id DESC LIMIT 1");
    $logStmt->bind_param("i", $leadId);
    $logStmt->execute();
    $logData = $logStmt->get_result()->fetch_assoc();
    $logStmt->close();
    
    $status = $logData['status'] ?? 'pending';
    $targetRoundId = $logData['round_id'] ?? 0;
    echo "Distribution Log Status: '$status'\n";
    echo "Target Round ID: $targetRoundId\n";
    
    // Replicate condition
    if ($assignedConsultantId && $status !== 'pending_work_hours') {
        echo "Condition passed. Querying consultant...\n";
        $stmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $assignedConsultantId);
            $stmt->execute();
            $cRes = $stmt->get_result();
            echo "Consultant rows found: " . $cRes->num_rows . "\n";
            if ($cRes->num_rows > 0) {
                $c = $cRes->fetch_assoc();
                echo "Consultant name: {$c['name']}, email: {$c['email']}\n";
                
                echo "Requiring mailer.php and zalo_bot.php...\n";
                require_once __DIR__ . '/mailer.php';
                echo "mailer.php required successfully.\n";
                
                require_once __DIR__ . '/zalo_bot.php';
                echo "zalo_bot.php required successfully.\n";
                
                $ccEmails = '';
                $roundName = '';
                if ($targetRoundId) {
                    echo "Preparing query for distribution_rounds (for round_name and cc_emails)...\n";
                    $rStmt = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
                    if ($rStmt) {
                        $rStmt->bind_param("i", $targetRoundId);
                        $rStmt->execute();
                        $rData = $rStmt->get_result()->fetch_assoc();
                        if ($rData) {
                            $roundName = $rData['round_name'] ?? '';
                            $ccEmails = $rData['cc_emails'] ?? '';
                        }
                        $rStmt->close();
                        echo "roundName fetched: '$roundName'\n";
                        echo "cc_emails fetched: '$ccEmails'\n";
                    } else {
                        echo "Failed to prepare query for distribution_rounds\n";
                    }
                }
                
                echo "Calling sendLeadAssignedEmailToSale...\n";
                try {
                    $emailResult = sendLeadAssignedEmailToSale(
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
                    echo "sendLeadAssignedEmailToSale returned: " . ($emailResult ? 'true' : 'false') . "\n";
                } catch (Throwable $mailEx) {
                    echo "EXCEPTION in sendLeadAssignedEmailToSale: " . $mailEx->getMessage() . "\n";
                }
                
                echo "Calling sendLeadAssignedZaloMessageToSale...\n";
                try {
                    $zaloResult = sendLeadAssignedZaloMessageToSale(
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
                        false // sync = false
                    );
                    echo "sendLeadAssignedZaloMessageToSale returned: " . ($zaloResult ? 'true' : 'false') . "\n";
                } catch (Throwable $zaloEx) {
                    echo "EXCEPTION in sendLeadAssignedZaloMessageToSale: " . $zaloEx->getMessage() . "\n";
                }
            }
        }
    } else {
        echo "Condition failed! assignedConsultantId: " . ($assignedConsultantId ?: 'NULL') . ", status: '$status'\n";
    }
    echo "\n";
}
