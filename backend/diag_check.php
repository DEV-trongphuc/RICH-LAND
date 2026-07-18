<?php
header('Content-Type: text/plain; charset=utf-8');

if (($_GET['token'] ?? '') !== 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7') {
    die('Unauthorized');
}

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

try {
    $db = Database::getInstance();
    echo "Richland Diagnostic Integrity Check\n";
    echo "===================================\n\n";

    // Check contacts
    $stmt1 = $db->query("SELECT id, first_name, last_name, owner_id FROM contacts WHERE owner_id IS NOT NULL AND owner_id NOT IN (SELECT id FROM users)");
    $res1 = $stmt1->fetchAll(PDO::FETCH_ASSOC);
    echo "1. contacts.owner_id Mismatches (should be in users.id):\n";
    if (empty($res1)) {
        echo "   [SUCCESS] No mismatch records found.\n";
    } else {
        foreach ($res1 as $r) {
            echo "   [WARN] Contact #{$r['id']} ({$r['first_name']} {$r['last_name']}) has owner_id = {$r['owner_id']} (not found in users)\n";
        }
    }
    echo "\n";

    // Check leads
    $stmt2 = $db->query("SELECT id, name, assigned_to FROM leads WHERE assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM consultants)");
    $res2 = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    echo "2. leads.assigned_to Mismatches (should be in consultants.id):\n";
    if (empty($res2)) {
        echo "   [SUCCESS] No mismatch records found.\n";
    } else {
        foreach ($res2 as $r) {
            echo "   [WARN] Lead #{$r['id']} ({$r['name']}) has assigned_to = {$r['assigned_to']} (not found in consultants)\n";
        }
    }
    echo "\n";

    // Check registrations
    $stmt3 = $db->query("SELECT id, user_id, shift_date FROM night_shift_registrations WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)");
    $res3 = $stmt3->fetchAll(PDO::FETCH_ASSOC);
    echo "3. night_shift_registrations.user_id Mismatches (should be in users.id):\n";
    if (empty($res3)) {
        echo "   [SUCCESS] No mismatch records found.\n";
    } else {
        foreach ($res3 as $r) {
            echo "   [WARN] Registration #{$r['id']} on {$r['shift_date']} has user_id = {$r['user_id']} (not found in users)\n";
        }
    }
    echo "\n";

} catch (Throwable $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
}
