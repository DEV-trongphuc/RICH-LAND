<?php
// debug_phuc_remote.php
define('IN_API', true);
require_once __DIR__ . '/../config/database.php';
$db = Database::getInstance()->getConnection();

// 1. Get person
$res = $db->query("SELECT id, full_name, is_public, released_to_kho_at FROM persons WHERE full_name LIKE '%Phúc đẹp trai%'");
$persons = $res->fetch_all(MYSQLI_ASSOC);
echo "--- PERSONS ---\n";
print_r($persons);

if (!empty($persons)) {
    $personId = $persons[0]['id'];
    
    // 2. Get contacts
    $res = $db->query("SELECT id, person_id, project_id, owner_id, created_by, status, deleted_at FROM contacts WHERE person_id = $personId");
    echo "\n--- CONTACTS ---\n";
    print_r($res->fetch_all(MYSQLI_ASSOC));

    // 3. Get leads
    $res = $db->query("SELECT id, person_id, name, status FROM leads WHERE person_id = $personId");
    $leads = $res->fetch_all(MYSQLI_ASSOC);
    echo "\n--- LEADS ---\n";
    print_r($leads);

    if (!empty($leads)) {
        $leadId = $leads[0]['id'];
        
        // 4. Get distribution logs
        $res = $db->query("SELECT id, lead_id, assigned_to, status, message, received_at FROM distribution_logs WHERE lead_id = $leadId ORDER BY id DESC");
        echo "\n--- DISTRIBUTION LOGS ---\n";
        print_r($res->fetch_all(MYSQLI_ASSOC));
    }
}
