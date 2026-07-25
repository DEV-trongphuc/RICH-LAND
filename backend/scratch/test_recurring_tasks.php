<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../test_bootstrap.php';
require_once __DIR__ . '/../cron_recurring_tasks.php';

echo "=== TESTING RECURRING TASKS GENERATION ===\n\n";

if (function_exists('runRecurringTasksCron')) {
    echo "Running runRecurringTasksCron()...\n";
    // We run it with the connection. Since there might not be any matching recurring patterns today or it will skip because last_generated == today,
    // this test will run the code paths and execute queries without causing binding fatal errors!
    runRecurringTasksCron($conn);
    echo "\n✅ Successfully executed runRecurringTasksCron() without fatal errors!\n";
} else {
    echo "❌ Error: runRecurringTasksCron function not found.\n";
}
