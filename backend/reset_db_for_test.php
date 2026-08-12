<?php
// backend/reset_db_for_test.php
// Reset database for actual testing phase (keeps configurations, clears all business data and other accounts)

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

$secretKey = $_REQUEST['key'] ?? '';
// Secret key matching exec_db_query.php
if ($secretKey !== 'richland2026') {
    http_response_code(403);
    echo json_encode(["success" => false, "error" => "Unauthorized. Invalid secret key."]);
    exit;
}

try {
    // Disable foreign key checks
    $conn->query("SET FOREIGN_KEY_CHECKS = 0;");

    $tablesToClear = [
        'active_compensation_logs',
        'activities',
        'activity_comments',
        'activity_dependencies',
        'admin_logs',
        'audit_logs',
        'batches',
        'blocked_leads',
        'capi_logs',
        'check_ins',
        'cloud_files',
        'comments',
        'communication_logs',
        'consultant_leaves',
        'contact_emails',
        'contact_phones',
        'contacts',
        'cooperation_slips',
        'custom_field_values',
        'data_reports',
        'deal_stage_history',
        'deals',
        'deposit_milestones',
        'deposits',
        'distribution_logs',
        'duplicate_log',
        'email_otps',
        'entity_tags',
        'expense_entities',
        'expenses',
        'files',
        'form_submissions',
        'holiday_shift_registrations',
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
        'project_documents',
        'project_roster',
        'purchase_order_items',
        'purchase_orders',
        'quote_items',
        'quotes',
        'refresh_tokens',
        'returned_databank_leads',
        'round_consultants',
        'sent_notifications',
        'sheet_sync_records',
        'sync_queue',
        'task_focus_logs',
        'task_hidden_users',
        'task_muted_notifications',
        'telegram_queue',
        'ticket_comments',
        'tickets',
        'user_notification_settings',
        'weekend_shift_registrations',
        'zalo_queue'
    ];

    $clearedTables = [];
    foreach ($tablesToClear as $table) {
        $conn->query("DELETE FROM `$table`;");
        $conn->query("ALTER TABLE `$table` AUTO_INCREMENT = 1;");
        $clearedTables[] = $table;
    }

    // Keep only admin account (ID: 1003)
    $conn->query("DELETE FROM `users` WHERE `id` != 1003;");

    // Clean up references to other users in configuration tables
    $conn->query("UPDATE `teams` SET `leader_id` = '1003' WHERE `leader_id` != '1003';");
    $conn->query("UPDATE `teams` SET `co_leader_ids` = '' WHERE `co_leader_ids` != '';");
    $conn->query("UPDATE `projects` SET `manager_ids` = '1003' WHERE `manager_ids` != '1003';");
    $conn->query("UPDATE `projects` SET `created_by` = '1003' WHERE `created_by` != '1003';");
    $conn->query("UPDATE `companies` SET `owner_id` = '1003', `created_by` = '1003', `dedicated_rep_id` = '1003';");
    $conn->query("UPDATE `suppliers` SET `created_by` = '1003' WHERE `created_by` != '1003';");

    // Enable foreign key checks
    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");

    echo json_encode([
        "success" => true,
        "message" => "Database successfully cleared. Only admin account (ID: 1003) and settings preserved.",
        "cleared_tables_count" => count($clearedTables),
        "cleared_tables" => $clearedTables
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    // Re-enable foreign key checks just in case
    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}
