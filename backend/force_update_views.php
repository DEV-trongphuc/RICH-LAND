<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "=== DATABASE DIAGNOSTICS & VIEW UPDATES ===\n\n";

// 1. Check users table columns
echo "--- Columns in users table:\n";
$res = $conn->query("DESCRIBE users");
$hasTgCol = false;
while ($row = $res->fetch_assoc()) {
    echo "Field: {$row['Field']} | Type: {$row['Type']} | Null: {$row['Null']}\n";
    if ($row['Field'] === 'telegram_chat_id') {
        $hasTgCol = true;
    }
}

// 2. Add columns if missing
if (!$hasTgCol) {
    echo "\nAdding telegram_chat_id to users table...\n";
    try {
        $conn->query("ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(255) NULL DEFAULT NULL AFTER zalo_chat_id");
        echo "SUCCESS: Added telegram_chat_id column.\n";
    } catch (Exception $e) {
        echo "ERROR adding column: " . $e->getMessage() . "\n";
    }
} else {
    echo "\ntelegram_chat_id column already exists in users table.\n";
}

// 3. Drop and recreate views
echo "\n--- Recreating accounts view...\n";
try {
    $conn->query("DROP VIEW IF EXISTS accounts");
    $conn->query("
        CREATE VIEW accounts AS 
        SELECT 
          id, 
          username, 
          password_hash, 
          role, 
          full_name AS name, 
          created_at, 
          email, 
          zalo_chat_id, 
          telegram_chat_id,
          is_confirmed, 
          confirm_token, 
          last_login_at AS last_login, 
          avatar_url AS avatar,
          dob,
          gender,
          citizen_id,
          address,
          bank_name,
          bank_account,
          phone,
          is_active,
          team_id
        FROM users
    ");
    echo "SUCCESS: Recreated accounts view.\n";
} catch (Exception $e) {
    echo "ERROR recreating accounts view: " . $e->getMessage() . "\n";
}

echo "\n--- Recreating consultants view...\n";
try {
    $conn->query("DROP VIEW IF EXISTS consultants");
    $conn->query("
        CREATE VIEW consultants AS 
        SELECT 
          id, 
          full_name AS name, 
          email, 
          phone,
          status, 
          leave_start, 
          leave_end, 
          created_at, 
          zalo_chat_id, 
          telegram_chat_id,
          IF(use_custom_work_hours = 1, work_start_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1)) AS work_start_time,
          IF(use_custom_work_hours = 1, work_end_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1)) AS work_end_time,
          IF(use_custom_work_hours = 1, work_schedule, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_schedule' LIMIT 1)) AS work_schedule,
          avatar_url AS avatar, 
          vacation_mode, 
          overtime_mode,
          team_id,
          dob,
          gender,
          citizen_id,
          address,
          bank_name,
          bank_account,
          extra_fields_json,
          use_custom_work_hours
        FROM users
        WHERE role = 'sales'
    ");
    echo "SUCCESS: Recreated consultants view.\n";
} catch (Exception $e) {
    echo "ERROR recreating consultants view: " . $e->getMessage() . "\n";
}

// 4. Verify columns in consultants view
echo "\n--- Columns in consultants view:\n";
try {
    $res = $conn->query("DESCRIBE consultants");
    while ($row = $res->fetch_assoc()) {
        echo "Field: {$row['Field']} | Type: {$row['Type']}\n";
    }
} catch (Exception $e) {
    echo "ERROR describing consultants: " . $e->getMessage() . "\n";
}

// 5. Verify columns in accounts view
echo "\n--- Columns in accounts view:\n";
try {
    $res = $conn->query("DESCRIBE accounts");
    while ($row = $res->fetch_assoc()) {
        echo "Field: {$row['Field']} | Type: {$row['Type']}\n";
    }
} catch (Exception $e) {
    echo "ERROR describing accounts: " . $e->getMessage() . "\n";
}
