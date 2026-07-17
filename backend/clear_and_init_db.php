<?php
// D:\RICH_LAND_DATA_UI\backend\clear_and_init_db.php
// Script to drop all tables/views, re-create schema, run migrations and seed exactly one admin user.

$isCli = (php_sapi_name() === 'cli');
$hasValidToken = (($_GET['token'] ?? '') === 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7') || defined('DIAG_TOKEN');
if (!$isCli && !$hasValidToken) {
    http_response_code(403);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Forbidden: Direct access not allowed']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "=== STARTING DATABASE CLEAN AND SINGLE ADMIN INITIALIZATION ===\n";

try {
    // 1. Drop existing views and tables
    echo "1. Dropping existing tables and views...\n";
    $conn->query("SET FOREIGN_KEY_CHECKS = 0;");
    
    // Drop views first
    $views = ['consultants', 'accounts'];
    foreach ($views as $view) {
        $conn->query("DROP VIEW IF EXISTS `$view` CASCADE;");
    }
    
    // Get all tables
    $tablesResult = $conn->query("SHOW TABLES");
    $tables = [];
    while ($row = $tablesResult->fetch_row()) {
        $tables[] = $row[0];
    }
    
    foreach ($tables as $table) {
        $conn->query("DROP TABLE IF EXISTS `$table` CASCADE;");
        echo "   - Dropped table: $table\n";
    }
    
    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");
    echo "   [SUCCESS] Dropped all tables and views.\n\n";

    // 2. Load and execute unified_schema.sql
    echo "2. Re-creating tables from unified_schema.sql...\n";
    $schemaFile = __DIR__ . '/unified_schema.sql';
    if (!file_exists($schemaFile)) {
        throw new Exception("Schema file not found at: $schemaFile");
    }
    
    $schemaSql = file_get_contents($schemaFile);
    
    // Remove comments
    $lines = explode("\n", $schemaSql);
    $cleanSql = "";
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === "" || strpos($trimmed, "--") === 0 || strpos($trimmed, "#") === 0) {
            continue;
        }
        $cleanSql .= $line . "\n";
    }
    
    // Split by semicolon and run queries
    $statements = explode(";", $cleanSql);
    foreach ($statements as $stmt) {
        $stmt = trim($stmt);
        if ($stmt !== "") {
            if (!$conn->query($stmt)) {
                throw new Exception("Error executing SQL statement: " . $conn->error . "\nStatement: " . $stmt);
            }
        }
    }
    echo "   [SUCCESS] Schema recreated.\n\n";

    // 3. Apply database migrations
    echo "3. Applying database migrations...\n";
    $_GET['apply'] = 'true';
    $_GET['run'] = '1';
    $argv[] = '--apply';
    ob_start();
    require_once __DIR__ . '/run_migrations.php';
    $migrationsOutput = ob_get_clean();
    echo "   [MIGRATIONS LOG]:\n" . trim($migrationsOutput) . "\n";
    echo "   [SUCCESS] Migrations run successfully.\n";

    try {
        $conn->query("ALTER TABLE users ADD COLUMN permissions_json LONGTEXT NULL");
    } catch (Exception $e) {}

    // 4. Seeding Tenant 1
    echo "\n4. Seeding Tenant 1...\n";
    $conn->query("INSERT INTO tenants (id, name, slug, plan, primary_color) VALUES (1, 'Rich Land Việt Nam', 'richland', 'enterprise', '#BD1D2D') ON DUPLICATE KEY UPDATE name = VALUES(name)");
    
    // 5. Clean users and insert only turniodev@gmail.com
    echo "5. Creating admin user turniodev@gmail.com...\n";
    $conn->query("SET FOREIGN_KEY_CHECKS = 0;");
    $conn->query("DELETE FROM users;");
    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");

    $passwordHash = password_hash('pass123', PASSWORD_BCRYPT);
    $email = 'turniodev@gmail.com';
    $username = 'turniodev';
    $role = 'superadmin';
    $name = 'Admin';
    $phone = '0909000000';

    $stmt = $conn->prepare("INSERT INTO users (tenant_id, username, email, password_hash, role, full_name, phone, is_active, status, vacation_mode, is_confirmed) VALUES (1, ?, ?, ?, ?, ?, ?, 1, 'active', 0, 1)");
    if ($stmt) {
        $stmt->bind_param("ssssss", $username, $email, $passwordHash, $role, $name, $phone);
        if ($stmt->execute()) {
            echo "   [SUCCESS] Created User: $name ($role) with email $email\n";
            echo "   Default password is: pass123\n";
        } else {
            throw new Exception("Failed to insert admin user: " . $stmt->error);
        }
        $stmt->close();
    } else {
        throw new Exception("Failed to prepare statement for admin insertion: " . $conn->error);
    }

    echo "\n=== DATABASE CLEAN & INITIALIZATION COMPLETED SUCCESSFULLY ===\n";

} catch (Throwable $e) {
    echo "\n[ERROR] Database initialization failed: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
