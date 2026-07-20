<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

try {
    echo "Starting recreation of consultants view...\n";
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
    echo "SUCCESS: Recreated consultants view successfully!\n";
    
    // Output column info
    $res = $conn->query("DESCRIBE consultants");
    echo "\n=== Columns in consultants view ===\n";
    while ($row = $res->fetch_assoc()) {
        echo $row['Field'] . "\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
