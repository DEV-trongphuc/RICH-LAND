<?php
require_once __DIR__ . '/db_connect.php';

echo "=== FORCE UPDATING DATABASE STRUCTS ===\n";

// 1. Alter users table
try {
    $res = $conn->query("ALTER TABLE `users` ADD COLUMN `telegram_chat_id` VARCHAR(255) NULL DEFAULT NULL AFTER `zalo_chat_id`");
    echo "users table altered successfully.\n";
} catch (Throwable $t) {
    echo "Alter users table message: " . $t->getMessage() . "\n";
}

// 2. Drop and recreate accounts view
try {
    $conn->query("DROP VIEW IF EXISTS `accounts`");
    $conn->query("
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
    ");
    echo "accounts view recreated successfully.\n";
} catch (Throwable $t) {
    echo "accounts view error: " . $t->getMessage() . "\n";
}

// 3. Drop and recreate consultants view
try {
    $conn->query("DROP VIEW IF EXISTS `consultants`");
    $conn->query("
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
    ");
    echo "consultants view recreated successfully.\n";
} catch (Throwable $t) {
    echo "consultants view error: " . $t->getMessage() . "\n";
}

echo "=== DONE ===\n";
