<?php
// D:\RICH_LAND_DATA_UI\backend\scratch\clear_db.php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "=== DISABLING FOREIGN KEY CHECKS ===\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");

    $tablesToTruncate = [
        'active_compensation_logs',
        'activities',
        'activity_comments',
        'admin_logs',
        'audit_logs',
        'batches',
        'capi_logs',
        'check_ins',
        'cloud_files',
        'comments',
        'communication_logs',
        'companies',
        'consultant_leaves',
        'contact_emails',
        'contact_phones',
        'contacts',
        'cooperation_slips',
        'custom_field_values',
        'custom_fields',
        'data_reports',
        'deal_stage_history',
        'deals',
        'deposit_milestones',
        'deposits',
        'distribution_logs',
        'duplicate_log',
        'entity_tags',
        'expense_entities',
        'expenses',
        'field_mappings',
        'file_categories',
        'files',
        'form_submissions',
        'forms',
        'import_jobs',
        'inventory_logs',
        'invoice_items',
        'invoices',
        'lead_offers',
        'leads',
        'login_attempts',
        'mail_queue',
        'marketing_campaigns',
        'night_shift_registrations',
        'note_mentions',
        'notes',
        'notifications',
        'persons',
        'product_categories',
        'products',
        'project_documents',
        'project_roster',
        'purchase_order_items',
        'purchase_orders',
        'quote_items',
        'quotes',
        'refresh_tokens',
        'round_consultants',
        'segments',
        'sheet_sync_records',
        'suppliers',
        'sync_queue',
        'tags',
        'teams',
        'ticket_comments',
        'tickets',
        'workflow_task_templates',
        'workflows',
        'zalo_queue'
    ];

    foreach ($tablesToTruncate as $table) {
        echo "Truncating table `$table`...\n";
        try {
            $db->exec("TRUNCATE TABLE `$table`");
        } catch (Exception $ex) {
            echo "Error truncating `$table`: " . $ex->getMessage() . "\n";
        }
    }

    $allowedUserIds = [2713, 2712, 999, 1002, 1000, 1001];
    $allowedUserIdsStr = implode(',', $allowedUserIds);

    echo "Cleaning `users` table, keeping only IDs: $allowedUserIdsStr...\n";
    $db->exec("DELETE FROM `users` WHERE id NOT IN ($allowedUserIdsStr)");

    echo "Cleaning `accounts` table, keeping only IDs: $allowedUserIdsStr...\n";
    $db->exec("DELETE FROM `accounts` WHERE id NOT IN ($allowedUserIdsStr)");

    echo "Cleaning `consultants` table, keeping only IDs: $allowedUserIdsStr...\n";
    $db->exec("DELETE FROM `consultants` WHERE id NOT IN ($allowedUserIdsStr)");

    echo "=== ENABLING FOREIGN KEY CHECKS ===\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 1");

    echo "=== DATABASE CLEANING COMPLETED SUCCESSFULLY ===\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
