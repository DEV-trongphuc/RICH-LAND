<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db_connect.php';

echo "=== FORCE DATABASE UPDATE WITH VERBOSE ERRORS ===\n";

function runQuery($conn, $sql, $label) {
    echo "Running: $label ... ";
    $res = $conn->query($sql);
    if ($res === false) {
        echo "FAILED. Error: " . $conn->error . "\n";
    } else {
        echo "SUCCESS.\n";
    }
}

// 1. Alter users
runQuery($conn, "ALTER TABLE `users` ADD COLUMN `telegram_chat_id` VARCHAR(255) NULL DEFAULT NULL AFTER `zalo_chat_id`", "Alter users table");

// 2. Drop accounts view
runQuery($conn, "DROP VIEW IF EXISTS `accounts`", "Drop accounts view");

// 3. Create accounts view
runQuery($conn, "
    CREATE VIEW `accounts` AS 
    SELECT 
      `id`, 
      `username`, 
      `password_hash`, 
      `role`, 
      `full_name` AS `name`, 
      `created_at`, 
      `email`, 
      `zalo_chat_id`, 
      `telegram_chat_id`,
      `is_confirmed`, 
      `confirm_token`, 
      `last_login_at` AS `last_login`, 
      `avatar_url` AS `avatar`,
      `dob`,
      `gender`,
      `citizen_id`,
      `address`,
      `bank_name`,
      `bank_account`,
      `phone`,
      `is_active`,
      `team_id`
    FROM `users`
", "Create accounts view");

// 4. Drop consultants view
runQuery($conn, "DROP VIEW IF EXISTS `consultants`", "Drop consultants view");

// 5. Create consultants view
runQuery($conn, "
    CREATE VIEW `consultants` AS 
    SELECT 
      `id`, 
      `full_name` AS `name`, 
      `email`, 
      `phone`,
      `status`, 
      `leave_start`, 
      `leave_end`, 
      `created_at`, 
      `zalo_chat_id`, 
      `telegram_chat_id`,
      IF(`use_custom_work_hours` = 1, `work_start_time`, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1)) AS `work_start_time`,
      IF(`use_custom_work_hours` = 1, `work_end_time`, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1)) AS `work_end_time`,
      IF(`use_custom_work_hours` = 1, `work_schedule`, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_schedule' LIMIT 1)) AS `work_schedule`,
      `avatar_url` AS `avatar`, 
      `vacation_mode`, 
      `overtime_mode`,
      `team_id`,
      `dob`,
      `gender`,
      `citizen_id`,
      `address`,
      `bank_name`,
      `bank_account`,
      `extra_fields_json`,
      `use_custom_work_hours`
    FROM `users`
    WHERE `role` = 'sales'
", "Create consultants view");

// 6. Describe consultants
runQuery($conn, "DESCRIBE `consultants`", "Describe consultants");
$desc = $conn->query("DESCRIBE `consultants`");
if ($desc) {
    while ($row = $desc->fetch_assoc()) {
        echo " - " . $row['Field'] . " (" . $row['Type'] . ")\n";
    }
}
echo "=== DONE ===\n";
