<?php
require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DATABASE MIGRATION: UPGRADING USERS & CONSULTANTS VIEW ===\n\n";

// 1. Check if phone column exists in users
$resPhone = $conn->query("SHOW COLUMNS FROM users LIKE 'phone'");
if ($resPhone && $resPhone->num_rows > 0) {
    echo "Column 'phone' already exists in base table 'users'.\n";
} else {
    $alter = $conn->query("ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL AFTER email");
    if ($alter) {
        echo "✅ Successfully added column 'phone' to base table 'users'!\n";
    } else {
        echo "❌ Failed to alter table users: " . $conn->error . "\n";
    }
}

// 2. Drop and Recreate view consultants
$drop = $conn->query("DROP VIEW IF EXISTS consultants");
if ($drop) {
    echo "✅ Successfully dropped old view 'consultants'.\n";
} else {
    echo "❌ Failed to drop view: " . $conn->error . "\n";
}

$createViewSql = "
CREATE VIEW `consultants` AS 
SELECT 
    `users`.`id` AS `id`,
    `users`.`full_name` AS `name`,
    `users`.`job_title` AS `job_title`,
    `users`.`email` AS `email`,
    `users`.`phone` AS `phone`,
    `users`.`role` AS `role`,
    `users`.`status` AS `status`,
    `users`.`leave_start` AS `leave_start`,
    `users`.`leave_end` AS `leave_end`,
    `users`.`work_start_time` AS `work_start_time`,
    `users`.`work_end_time` AS `work_end_time`,
    `users`.`work_schedule` AS `work_schedule`,
    `users`.`avatar_url` AS `avatar`,
    `users`.`signature_url` AS `signature_url`,
    `users`.`zalo_chat_id` AS `zalo_chat_id`,
    `users`.`telegram_chat_id` AS `telegram_chat_id`,
    `users`.`vacation_mode` AS `vacation_mode`,
    `users`.`overtime_mode` AS `overtime_mode`,
    `users`.`team_id` AS `team_id`,
    `users`.`dob` AS `dob`,
    `users`.`gender` AS `gender`,
    `users`.`citizen_id` AS `citizen_id`,
    `users`.`address` AS `address`,
    `users`.`bank_name` AS `bank_name`,
    `users`.`bank_account` AS `bank_account`,
    `users`.`extra_fields_json` AS `extra_fields_json`,
    `users`.`use_custom_work_hours` AS `use_custom_work_hours`,
    `users`.`created_at` AS `created_at` 
FROM `users`
";

$create = $conn->query($createViewSql);
if ($create) {
    echo "✅ Successfully recreated view 'consultants' with 'phone' column included!\n";
} else {
    echo "❌ Failed to create view: " . $conn->error . "\n";
}
