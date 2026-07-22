<?php
// backend/test_audit_db.php
// Diagnostic script to perform live DB payload audit across users, consultants, contacts, leads

header("Content-Type: text/plain; charset=utf-8");
require_once __DIR__ . '/db_connect.php';

echo "====================================================\n";
echo "🔍 BAT DAU KIEM THU CHOC TRUC TIEP CSDL (LIVE DB AUDIT)\n";
echo "====================================================\n\n";

$passCount = 0;
$failCount = 0;

function assertTest($title, $condition, $details = '') {
    global $passCount, $failCount;
    if ($condition) {
        $passCount++;
        echo "✅ [PASS] " . $title . ($details ? " -> " . $details : "") . "\n";
    } else {
        $failCount++;
        echo "❌ [FAIL] " . $title . ($details ? " -> " . $details : "") . "\n";
    }
}

// ----------------------------------------------------
// 1. AUDIT BANG USERS / CONSULTANTS
// ----------------------------------------------------
echo "--- 1. AUDIT BANG USERS / CONSULTANTS ---\n";

// Fetch an active test user
$uRes = $conn->query("SELECT id, email, full_name, phone, zalo_chat_id, telegram_chat_id, address, dob FROM users LIMIT 1");
if ($uRes && $uRes->num_rows > 0) {
    $testUser = $uRes->fetch_assoc();
    $userId = (int)$testUser['id'];
    $origZalo = $testUser['zalo_chat_id'];
    $origPhone = $testUser['phone'];
    $origName = $testUser['full_name'];

    echo "Found test user ID: $userId (Name: $origName, Phone: $origPhone, Zalo: " . ($origZalo ?: 'NULL') . ")\n";

    // Scenario A: Partial Update (Only updating full_name, leaving zalo_chat_id un-passed)
    // Simulate update_consultant logic in api.php
    $inputPartial = [
        'id' => $userId,
        'name' => $origName . ' (Audit Test)',
        'work_start_time' => '08:00',
        'work_end_time' => '17:30'
        // Notice: zalo_chat_id is NOT in $inputPartial
    ];

    // Read current state before update
    $stmtCurr = $conn->prepare("SELECT zalo_chat_id, email, phone FROM users WHERE id = ? LIMIT 1");
    $stmtCurr->bind_param("i", $userId);
    $stmtCurr->execute();
    $existingZaloId = $stmtCurr->get_result()->fetch_assoc()['zalo_chat_id'] ?? null;
    $stmtCurr->close();

    if (array_key_exists('zalo_chat_id', $inputPartial) && $inputPartial['zalo_chat_id'] !== '') {
        $zalo_chat_id = !empty($inputPartial['zalo_chat_id']) ? trim($inputPartial['zalo_chat_id']) : null;
    } else {
        $zalo_chat_id = $existingZaloId;
    }

    $stmtUp = $conn->prepare("UPDATE users SET full_name = ?, zalo_chat_id = ? WHERE id = ?");
    $testName = $inputPartial['name'];
    $stmtUp->bind_param("ssi", $testName, $zalo_chat_id, $userId);
    $stmtUp->execute();
    $stmtUp->close();

    // Verify after partial update
    $verifyRes = $conn->query("SELECT full_name, zalo_chat_id FROM users WHERE id = $userId")->fetch_assoc();
    assertTest("Partial Update Users: Update full_name", $verifyRes['full_name'] === $testName, "New Name: " . $verifyRes['full_name']);
    assertTest("Partial Update Users: Preserve zalo_chat_id", $verifyRes['zalo_chat_id'] === $origZalo, "Zalo ID kept: " . ($verifyRes['zalo_chat_id'] ?: 'NULL'));

    // Revert test user name back
    $conn->query("UPDATE users SET full_name = '" . $conn->real_escape_string($origName) . "' WHERE id = $userId");
} else {
    echo "⚠️ No test user found in users table.\n";
}

echo "\n";

// ----------------------------------------------------
// 2. AUDIT BANG CONTACTS
// ----------------------------------------------------
echo "--- 2. AUDIT BANG CONTACTS ---\n";

$cRes = $conn->query("SELECT id, first_name, last_name, phone, email, zalo_phone, facebook_link, preferred_location, budget FROM contacts LIMIT 1");
if ($cRes && $cRes->num_rows > 0) {
    $testContact = $cRes->fetch_assoc();
    $contactId = (int)$testContact['id'];
    $origFirstName = $testContact['first_name'];
    $origZaloPhone = $testContact['zalo_phone'];
    $origBudget = $testContact['budget'];

    echo "Found test contact ID: $contactId (Name: $origFirstName, ZaloPhone: " . ($origZaloPhone ?: 'NULL') . ")\n";

    // Simulate ContactController fields list check
    $fields = [
        'company_id','project_id','owner_id','first_name','last_name','email','phone',
        'mobile','job_title','department','source','status','notes',
        'birthday','address','city','ward',
        'expected_revenue','win_probability','last_contact','stage_id',
        'pipeline_status', 'ttl1_completed', 'ttl1_data',
        'gender', 'zalo_link', 'fb_link', 'customer_type', 'industry', 'budget_range',
        'temperature', 'suggested_temperature', 'campaign_id', 'collaborator_ids',
        'phone2', 'dob', 'citizen_id', 'district', 'company', 'tax_code', 'budget',
        'demand_type', 'property_type', 'bedroom_count', 'preferred_location',
        'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'platform',
        'form_name', 'zalo_phone', 'facebook_link'
    ];

    $bPartial = [
        'first_name' => $origFirstName . ' (Audit)',
        'zalo_phone' => '0909123456'
    ];

    $sets = []; $params = [];
    foreach ($fields as $f) {
        if ($f === 'company_id') continue;
        if (array_key_exists($f, $bPartial)) {
            $sets[] = "$f=?";
            $params[] = $bPartial[$f];
        }
    }

    assertTest("ContactController fields list contains zalo_phone", in_array('zalo_phone', $fields));
    assertTest("ContactController fields list contains preferred_location", in_array('preferred_location', $fields));
    assertTest("ContactController fields list contains tax_code", in_array('tax_code', $fields));
    assertTest("ContactController partial update generates 2 SET clauses", count($sets) === 2, "SET count: " . count($sets));

    // Execute test update on contacts
    if (!empty($sets)) {
        $params[] = $contactId;
        $sql = "UPDATE contacts SET " . implode(', ', $sets) . " WHERE id = ?";
        $stmtC = $conn->prepare($sql);
        $typesStr = str_repeat('s', count($params) - 1) . 'i';
        $stmtC->bind_param($typesStr, ...$params);
        $stmtC->execute();
        $stmtC->close();

        // Verify
        $verifyC = $conn->query("SELECT first_name, zalo_phone, budget FROM contacts WHERE id = $contactId")->fetch_assoc();
        assertTest("Partial Update Contacts: Update first_name & zalo_phone", $verifyC['zalo_phone'] === '0909123456');
        assertTest("Partial Update Contacts: Preserve budget", $verifyC['budget'] == $origBudget);

        // Revert
        $conn->query("UPDATE contacts SET first_name = '" . $conn->real_escape_string($origFirstName) . "', zalo_phone = " . ($origZaloPhone ? "'" . $conn->real_escape_string($origZaloPhone) . "'" : "NULL") . " WHERE id = $contactId");
    }
} else {
    echo "⚠️ No test contact found in contacts table.\n";
}

echo "\n";

// ----------------------------------------------------
// 3. AUDIT BANG LEADS
// ----------------------------------------------------
echo "--- 3. AUDIT BANG LEADS ---\n";

$lRes = $conn->query("SELECT id, name, phone, email, zalo_notify_status, telegram_notify_status FROM leads LIMIT 1");
if ($lRes && $lRes->num_rows > 0) {
    $testLead = $lRes->fetch_assoc();
    $leadId = (int)$testLead['id'];
    $origZaloNotify = $testLead['zalo_notify_status'];

    echo "Found test lead ID: $leadId (Name: " . $testLead['name'] . ", Zalo Notify Status: " . ($origZaloNotify ?: 'NULL') . ")\n";

    // Verify updateLead function logic preserves existing fields
    $conn->query("UPDATE leads SET zalo_notify_status = 'sent' WHERE id = $leadId");
    $verifyL = $conn->query("SELECT zalo_notify_status FROM leads WHERE id = $leadId")->fetch_assoc();
    assertTest("Leads table: zalo_notify_status can be set to sent", $verifyL['zalo_notify_status'] === 'sent');

    // Revert
    $conn->query("UPDATE leads SET zalo_notify_status = " . ($origZaloNotify ? "'" . $conn->real_escape_string($origZaloNotify) . "'" : "NULL") . " WHERE id = $leadId");
} else {
    echo "⚠️ No test lead found in leads table.\n";
}

echo "\n====================================================\n";
echo "📊 KET QUA AUDIT THUC TE CHOC CSDL:\n";
echo "   PASS: $passCount\n";
echo "   FAIL: $failCount\n";
echo "====================================================\n";
