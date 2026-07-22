<?php
// backend/check_le_thi_hong_coop.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 CHECK COOPERATION SLIP FOR DATA LÊ THỊ HỒNG\n";
echo "====================================================\n\n";

$resC = $conn->query("SELECT id, first_name, last_name, phone, owner_id, collaborator_ids, pipeline_status, status FROM contacts WHERE phone LIKE '%0774%799%' OR id = 30");
$contactId = 0;
while ($c = $resC->fetch_assoc()) {
    echo "CONTACT ID: {$c['id']} | Name: {$c['first_name']} {$c['last_name']} | Phone: {$c['phone']} | OwnerID: {$c['owner_id']} | Collabs: {$c['collaborator_ids']} | Pipeline: {$c['pipeline_status']}\n";
    $contactId = (int)$c['id'];
}

if ($contactId > 0) {
    echo "\nCooperation Slips for Contact ID $contactId:\n";
    $resCS = $conn->query("SELECT * FROM cooperation_slips WHERE contact_id = $contactId ORDER BY id DESC");
    while ($cs = $resCS->fetch_assoc()) {
        echo "Coop Slip ID: {$cs['id']} | Status: {$cs['status']} | Deposit ID: {$cs['deposit_slip_id']} | Shares: {$cs['shares_json']} | Signatures: {$cs['signatures_json']}\n";
    }

    echo "\nDeposits for Contact ID $contactId:\n";
    $resD = $conn->query("SELECT * FROM deposits WHERE contact_id = $contactId ORDER BY id DESC");
    while ($d = $resD->fetch_assoc()) {
        echo "Deposit ID: {$d['id']} | Unit: {$d['unit_code']} | Price: {$d['price']} | Status: {$d['status']}\n";
    }
}
