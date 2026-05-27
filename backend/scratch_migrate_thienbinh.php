<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$id_to_check = 30161;
$target_source = 'Facebook Ads - Form';
$lead_id = null;

echo "=== STEP 1: CHECKING IF ID {$id_to_check} IS A DIRECT LEAD ID ===\n";
$stmt = $conn->prepare("SELECT id, name, phone, email, source FROM leads WHERE id = ?");
$stmt->bind_param("i", $id_to_check);
$stmt->execute();
$res = $stmt->get_result();
if ($row = $res->fetch_assoc()) {
    $lead_id = $row['id'];
    echo "Found direct Lead! ID: {$row['id']} | Name: {$row['name']} | Phone: {$row['phone']} | Email: {$row['email']} | Source: {$row['source']}\n";
} else {
    echo "Not found directly in leads table. Checking distribution_logs...\n";
}
$stmt->close();

if ($lead_id === null) {
    echo "\n=== STEP 2: CHECKING IF ID {$id_to_check} IS A DISTRIBUTION LOG ID ===\n";
    $stmt = $conn->prepare("SELECT id, lead_id FROM distribution_logs WHERE id = ?");
    $stmt->bind_param("i", $id_to_check);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        $lead_id = $row['lead_id'];
        echo "Found via Distribution Log ID: {$row['id']} -> Lead ID: {$lead_id}\n";
        
        // Fetch lead details
        $stmtLead = $conn->prepare("SELECT id, name, phone, email, source FROM leads WHERE id = ?");
        $stmtLead->bind_param("i", $lead_id);
        $stmtLead->execute();
        $resLead = $stmtLead->get_result();
        if ($rowLead = $resLead->fetch_assoc()) {
            echo "Lead details: ID: {$rowLead['id']} | Name: {$rowLead['name']} | Phone: {$rowLead['phone']} | Email: {$rowLead['email']} | Source: {$rowLead['source']}\n";
        } else {
            echo "Lead ID {$lead_id} linked in logs but not found in leads table!\n";
            $lead_id = null;
        }
        $stmtLead->close();
    } else {
        echo "Not found in distribution_logs table either.\n";
    }
    $stmt->close();
}

if ($lead_id !== null) {
    echo "\n=== STEP 3: PERFORMING UPDATE FOR LEAD ID {$lead_id} ===\n";
    $upd = $conn->prepare("UPDATE leads SET source = ? WHERE id = ?");
    $upd->bind_param("si", $target_source, $lead_id);
    if ($upd->execute()) {
        echo "Successfully updated Lead ID {$lead_id} source to '{$target_source}'!\n";
    } else {
        echo "Failed to update lead: " . $conn->error . "\n";
    }
    $upd->close();
    
    echo "\n=== STEP 4: VERIFYING UPDATE ===\n";
    $stmt = $conn->prepare("SELECT id, name, phone, email, source FROM leads WHERE id = ?");
    $stmt->bind_param("i", $lead_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        echo "ID: {$row['id']} | Name: {$row['name']} | Phone: {$row['phone']} | Email: {$row['email']} | Source: {$row['source']}\n";
    }
    $stmt->close();
} else {
    echo "\n[ERROR] ID {$id_to_check} could not be resolved to any lead in the database.\n";
}
?>
