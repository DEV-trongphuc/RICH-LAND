<?php
// D:\RICH_LAND_DATA_UI\backend\run_reset_db.php
// Script to safely drop, re-create tables, apply migrations, and seed beautiful test data.

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "=== STARTING DATABASE RESET & SEEDING PROCESS ===\n";

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
    
    // Split by semicolon (ignoring semicolons inside strings is simplified since the schema uses clean statements)
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

    // 3. Apply database self-healing & migrations to version 155
    echo "3. Applying database migrations...\n";
    $_GET['apply'] = 'true';
    $_GET['run'] = '1';
    $argv[] = '--apply';
    ob_start();
    require_once __DIR__ . '/run_migrations.php';
    $migrationsOutput = ob_get_clean();
    echo "   [MIGRATIONS LOG]:\n" . trim($migrationsOutput) . "\n";
    echo "   [SUCCESS] Migrations run successfully.\n";
    
    // 4. Seed beautiful and realistic test data
    echo "\n4. Seeding realistic test data...\n";
    
    // Ensure tenant is created (migrator usually creates tenant 1, but let's make sure it has the right name)
    $conn->query("INSERT INTO tenants (id, name, slug, plan, primary_color) VALUES (1, 'Rich Land Việt Nam', 'richland', 'enterprise', '#BD1D2D') ON DUPLICATE KEY UPDATE name = VALUES(name)");
    
    $conn->query("SET FOREIGN_KEY_CHECKS = 0;");
    $conn->query("DELETE FROM users;");
    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");

    $passwordHash = password_hash('pass123', PASSWORD_BCRYPT);
    
    // Seed Users with roles
    $usersData = [
        ['email' => 'superadmin@richland.vn', 'role' => 'superadmin', 'name' => 'Phan Quốc Khánh', 'phone' => '0911002233'],
        ['email' => 'admin@richland.vn', 'role' => 'admin', 'name' => 'Trần Thị Tuyết', 'phone' => '0988112233'],
        ['email' => 'manager@richland.vn', 'role' => 'manager', 'name' => 'Lê Minh Hoàng', 'phone' => '0909223344'],
        ['email' => 'assistant@richland.vn', 'role' => 'assistant', 'name' => 'Hoàng Thu Trang', 'phone' => '0977334455'],
        ['email' => 'sales.nam@richland.vn', 'role' => 'sales', 'name' => 'Nguyễn Văn Nam', 'phone' => '0933445566'],
        ['email' => 'sales.mai@richland.vn', 'role' => 'sales', 'name' => 'Trần Thị Mai', 'phone' => '0944556677'],
        ['email' => 'sales.quan@richland.vn', 'role' => 'sales', 'name' => 'Phạm Minh Quân', 'phone' => '0955667788'],
        ['email' => 'sales.thao@richland.vn', 'role' => 'sales', 'name' => 'Lê Thị Thảo', 'phone' => '0966778899'],
        ['email' => 'viewer@richland.vn', 'role' => 'viewer', 'name' => 'Nguyễn Bích Phượng', 'phone' => '0900998877'],
    ];

    $userIds = [];
    foreach ($usersData as $u) {
        $username = explode('@', $u['email'])[0];
        $stmt = $conn->prepare("INSERT INTO users (tenant_id, username, email, password_hash, role, full_name, phone, is_active, status, vacation_mode, is_confirmed) VALUES (1, ?, ?, ?, ?, ?, ?, 1, 'active', 0, 1)");
        $stmt->bind_param("ssssss", $username, $u['email'], $passwordHash, $u['role'], $u['name'], $u['phone']);
        if ($stmt->execute()) {
            $uId = $stmt->insert_id;
            $userIds[$u['email']] = $uId;
            echo "   - Created User: {$u['name']} ({$u['role']})\n";
        }
        $stmt->close();
    }
    
    // Seed Team
    $hpTeamName = 'Đội Ngũ Phân Phối Hải Phòng';
    $managerId = $userIds['manager@richland.vn'];
    $stmtTeam = $conn->prepare("INSERT INTO teams (tenant_id, name, leader_id) VALUES (1, ?, ?)");
    $stmtTeam->bind_param("si", $hpTeamName, $managerId);
    if ($stmtTeam->execute()) {
        $teamId = $stmtTeam->insert_id;
        echo "   - Created Team: $hpTeamName (Leader: Lê Minh Hoàng)\n";
        
        // Link sales users to the team
        $salesEmails = ['sales.nam@richland.vn', 'sales.mai@richland.vn', 'sales.quan@richland.vn', 'sales.thao@richland.vn'];
        foreach ($salesEmails as $se) {
            $sId = $userIds[$se];
            $conn->query("UPDATE users SET team_id = $teamId WHERE id = $sId");
        }
    }
    $stmtTeam->close();

    $superAdminId = $userIds['superadmin@richland.vn'];

    // Seed Suppliers (Chủ đầu tư)
    $suppliers = [
        ['name' => 'Tập đoàn Vingroup', 'prestige_tier' => 'A', 'cooperation_status' => 'active'],
        ['name' => 'Tập đoàn DOJI', 'prestige_tier' => 'A', 'cooperation_status' => 'active'],
        ['name' => 'Chủ đầu tư Geleximco', 'prestige_tier' => 'B', 'cooperation_status' => 'active']
    ];
    $supplierIds = [];
    foreach ($suppliers as $s) {
        $stmt = $conn->prepare("INSERT INTO suppliers (tenant_id, created_by, name, prestige_tier, cooperation_status) VALUES (1, ?, ?, ?, ?)");
        $stmt->bind_param("isss", $superAdminId, $s['name'], $s['prestige_tier'], $s['cooperation_status']);
        $stmt->execute();
        $supplierIds[$s['name']] = $stmt->insert_id;
        echo "   - Created Supplier: {$s['name']}\n";
        $stmt->close();
    }

    // Seed Companies (Công ty đối tác)
    $companies = [
        ['name' => 'Công ty Bất Động Sản Đất Xanh Miền Bắc', 'tax_id' => '0106173920'],
        ['name' => 'Công ty Cổ Phần CenLand Chi Nhánh Hải Phòng', 'tax_id' => '0102705030']
    ];
    $companyIds = [];
    foreach ($companies as $c) {
        $stmt = $conn->prepare("INSERT INTO companies (tenant_id, created_by, name, tax_id) VALUES (1, ?, ?, ?)");
        $stmt->bind_param("iss", $superAdminId, $c['name'], $c['tax_id']);
        $stmt->execute();
        $companyIds[$c['name']] = $stmt->insert_id;
        echo "   - Created Company: {$c['name']}\n";
        $stmt->close();
    }

    // Seed Projects (Dự án)
    $vinHP = $supplierIds['Tập đoàn Vingroup'];
    $dojiHP = $supplierIds['Tập đoàn DOJI'];
    $projects = [
        ['name' => 'Vinhomes Royal Island Vũ Yên', 'code' => 'VH-ROYAL', 'developer' => $vinHP, 'location' => 'Đảo Vũ Yên, Thủy Nguyên, Hải Phòng'],
        ['name' => 'Diamond Crown Plaza Hải Phòng', 'code' => 'DOJI-DCP', 'developer' => $dojiHP, 'location' => 'Lê Hồng Phong, Ngô Quyền, Hải Phòng']
    ];
    $projectIds = [];
    foreach ($projects as $p) {
        $stmt = $conn->prepare("INSERT INTO projects (tenant_id, name, code, developer, location) VALUES (1, ?, ?, ?, ?)");
        $stmt->bind_param("ssis", $p['name'], $p['code'], $p['developer'], $p['location']);
        $stmt->execute();
        $projectIds[$p['name']] = $stmt->insert_id;
        echo "   - Created Project: {$p['name']}\n";
        $stmt->close();
    }

    // Seed Roster mapping (users to projects)
    $vinId = $projectIds['Vinhomes Royal Island Vũ Yên'];
    $salesIds = [$userIds['sales.nam@richland.vn'], $userIds['sales.mai@richland.vn'], $userIds['sales.quan@richland.vn'], $userIds['sales.thao@richland.vn']];
    foreach ($salesIds as $sId) {
        $conn->query("INSERT INTO project_roster (project_id, user_id) VALUES ($vinId, $sId)");
    }
    echo "   - Assigned 4 Sales to Vinhomes Project Roster\n";

    // Seed Campaigns
    $conn->query("
        CREATE TABLE IF NOT EXISTS marketing_campaigns (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN start_date DATE DEFAULT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN end_date DATE DEFAULT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN project_ids TEXT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN user_ids TEXT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN manager_ids TEXT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN document_ids TEXT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN folder_path VARCHAR(500) DEFAULT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN reference_url VARCHAR(500) NULL");

    $stmtCamp = $conn->prepare("INSERT INTO marketing_campaigns (tenant_id, name, description, status, project_ids, user_ids) VALUES (1, 'Chiến dịch Vinhomes Vũ Yên Hè 2026', 'Tập trung phân phối biệt thự đảo sinh thái Vũ Yên', 'active', ?, ?)");
    $projList = (string)$vinId;
    $usersList = implode(',', $salesIds);
    $stmtCamp->bind_param("ss", $projList, $usersList);
    $stmtCamp->execute();
    $campaignId = $stmtCamp->insert_id;
    echo "   - Created Campaign: Chiến dịch Vinhomes Vũ Yên Hè 2026\n";
    $stmtCamp->close();

    // Seed Distribution Rounds
    $stmtRound = $conn->prepare("INSERT INTO distribution_rounds (round_name, description, is_active) VALUES ('Vòng Chia Lead Vinhomes Vũ Yên - Tỷ Lệ Đều', 'Chia lead tự động cho dự án Vũ Yên', 1)");
    $stmtRound->execute();
    $roundId = $stmtRound->insert_id;
    echo "   - Created Distribution Round\n";
    $stmtRound->close();

    // Seed Round Consultants
    foreach ($salesIds as $sId) {
        $conn->query("INSERT INTO round_consultants (round_id, consultant_id, receive_ratio, compensation_count, current_turn_remaining) VALUES ($roundId, $sId, 1, 0, 1)");
    }
    echo "   - Added 4 Consultants to Distribution Round\n";

    // Seed Products (Giỏ hàng)
    $products = [
        ['name' => 'Biệt thự đơn lập Hoàng Gia HG-18', 'price' => 45000000000.00, 'unit' => 'căn'],
        ['name' => 'Shophouse Tài Lộc TL-09', 'price' => 12500000000.00, 'unit' => 'căn'],
        ['name' => 'Căn hộ 2 phòng ngủ CC-1205', 'price' => 4800000000.00, 'unit' => 'căn']
    ];
    $productIds = [];
    foreach ($products as $p) {
        $stmt = $conn->prepare("INSERT INTO products (tenant_id, created_by, name, price, unit) VALUES (1, ?, ?, ?, ?)");
        $stmt->bind_param("isds", $superAdminId, $p['name'], $p['price'], $p['unit']);
        $stmt->execute();
        $productIds[$p['name']] = $stmt->insert_id;
        echo "   - Created Product: {$p['name']}\n";
        $stmt->close();
    }

    // Seed Persons (Thông tin liên hệ gốc)
    $personsData = [
        ['name' => 'Hoàng Kim Long', 'phone' => '0912345678', 'email' => 'long.hoang@gmail.com'],
        ['name' => 'Đặng Thu Thảo', 'phone' => '0987654321', 'email' => 'thao.dang@gmail.com'],
        ['name' => 'Nguyễn Quốc Cường', 'phone' => '0901234567', 'email' => 'cuong.nguyen@gmail.com']
    ];
    $personIds = [];
    foreach ($personsData as $p) {
        $stmt = $conn->prepare("INSERT INTO persons (phone, email, full_name) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $p['phone'], $p['email'], $p['name']);
        $stmt->execute();
        $personIds[$p['name']] = $stmt->insert_id;
        $stmt->close();
    }

    // Seed Contacts (Khách hàng CRM)
    $namId = $userIds['sales.nam@richland.vn'];
    $maiId = $userIds['sales.mai@richland.vn'];
    
    // Contact 1: Qualified / Tu Van
    $conn->query("INSERT INTO contacts (tenant_id, person_id, first_name, last_name, email, phone, owner_id, status, pipeline_status, temperature, source) 
                 VALUES (1, {$personIds['Hoàng Kim Long']}, 'Hoàng', 'Kim Long', 'long.hoang@gmail.com', '0912345678', $namId, 'qualified', 'tu_van', 'hot', 'FB ads')");
    $contactLongId = $conn->insert_id;

    // Contact 2: Customer / Dat coc
    $conn->query("INSERT INTO contacts (tenant_id, person_id, first_name, last_name, email, phone, owner_id, status, pipeline_status, temperature, source) 
                 VALUES (1, {$personIds['Đặng Thu Thảo']}, 'Đặng', 'Thu Thảo', 'thao.dang@gmail.com', '0987654321', $namId, 'customer', 'dat_coc', 'warm', 'Zalo')");
    $contactThaoId = $conn->insert_id;

    // Contact 3: Customer / Dong deal
    $conn->query("INSERT INTO contacts (tenant_id, person_id, first_name, last_name, email, phone, owner_id, status, pipeline_status, temperature, source) 
                 VALUES (1, {$personIds['Nguyễn Quốc Cường']}, 'Nguyễn', 'Quốc Cường', 'cuong.nguyen@gmail.com', '0901234567', $maiId, 'customer', 'dong_deal', 'neutral', 'Giới thiệu')");
    $contactCuongId = $conn->insert_id;
    echo "   - Created 3 Contacts with different stages and owners\n";

    // Clear and seed pipeline stages to make sure IDs and names are 100% matched
    $conn->query("SET FOREIGN_KEY_CHECKS = 0;");
    $conn->query("DELETE FROM pipeline_stages;");
    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");

    $defaultStages = [
        ['Chưa xác định', '#3b82f6', 0, 0, 0],
        ['Quan tâm', '#6366f1', 1, 0, 0],
        ['Đồng ý gặp', '#ec4899', 2, 0, 0],
        ['Đã gặp', '#f59e0b', 3, 0, 0],
        ['Booking', '#10b981', 4, 0, 0],
        ['Đặt cọc', '#14b8a6', 5, 0, 0],
        ['Đóng deal', '#10b981', 6, 1, 0],
        ['Thất bại/Từ chối', '#ef4444', 7, 0, 1]
    ];
    $stagesMap = [];
    foreach ($defaultStages as $ds) {
        $stmtIns = $conn->prepare("INSERT INTO pipeline_stages (tenant_id, name, color, order_index, is_won, is_lost) VALUES (1, ?, ?, ?, ?, ?)");
        $stmtIns->bind_param("ssiii", $ds[0], $ds[1], $ds[2], $ds[3], $ds[4]);
        $stmtIns->execute();
        $stagesMap[$ds[0]] = $stmtIns->insert_id;
        $stmtIns->close();
    }

    $stageQuanTam = $stagesMap['Quan tâm'] ?? 2;
    $stageDatCoc = $stagesMap['Đặt cọc'] ?? 6;
    $stageDongDeal = $stagesMap['Đóng deal'] ?? 7;

    // Seed Deals (Cơ hội giao dịch)
    $conn->query("INSERT INTO deals (tenant_id, contact_id, title, value, stage_id, owner_id, created_by) VALUES (1, $contactLongId, 'Giao dịch Biệt thự Hoàng Gia HG-18', 45000000000.00, $stageQuanTam, $namId, $superAdminId)");
    $conn->query("INSERT INTO deals (tenant_id, contact_id, title, value, stage_id, owner_id, created_by) VALUES (1, $contactThaoId, 'Giao dịch Shophouse Tài Lộc TL-09', 12500000000.00, $stageDatCoc, $namId, $superAdminId)");
    $conn->query("INSERT INTO deals (tenant_id, contact_id, title, value, stage_id, owner_id, created_by) VALUES (1, $contactCuongId, 'Giao dịch Căn CC-1205 Diamond Crown', 4800000000.00, $stageDongDeal, $maiId, $superAdminId)");
    echo "   - Created 3 Deals associated with contacts\n";

    // Seed Notes & Activities
    $conn->query("INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body) VALUES (1, $namId, 'contact', $contactLongId, 'Khách hàng VIP, quan tâm thiết kế phong cách Hoàng Gia Pháp. Yêu cầu gửi bảng tiến độ thanh toán vay ngân hàng.')");
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, related_type, related_id) 
                 VALUES (1, $namId, 'call', 'Gọi điện tư vấn lãi suất vay 0%', 'Khách đồng ý nghe điện thoại và hẹn lịch gặp cuối tuần này.', 'done', 'high', 'contact', $contactLongId)");
    echo "   - Created Notes and Activities\n";

    // Seed Invoices
    $conn->query("INSERT INTO invoices (tenant_id, contact_id, invoice_number, title, status, issue_date, due_date, total, created_by) 
                 VALUES (1, $contactCuongId, 'INV-2026-0001', 'Hóa đơn Đợt 1 Căn CC-1205', 'paid', '2026-07-01', '2026-07-15', 1500000000.00, $superAdminId)");
    echo "   - Created Paid Invoice (1.5 Billion VND)\n";

    // Seed Deposits
    $conn->query("INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) 
                 VALUES ($contactThaoId, $vinId, 'TL-09', 12500000000.00, 375000000.00, 'approved', $namId)");
    echo "   - Created Confirmed Deposit (200 Million VND)\n";

    // Seed Tickets (Báo lỗi data)
    $conn->query("INSERT INTO tickets (tenant_id, contact_id, created_by, assignee_id, subject, customer_name, description, status, priority) 
                 VALUES (1, $contactLongId, $namId, $managerId, 'Trùng số điện thoại khách hàng Long', 'Hoàng Kim Long', 'Số điện thoại 0912345678 đã có trong hệ thống từ trước.', 'open', 'high')");
    echo "   - Created Data Ticket\n";

    echo "\n=== DATABASE RESET & SEEDING COMPLETED SUCCESSFULLY ===\n";

} catch (Throwable $e) {
    http_response_code(500);
    echo "\n[ERROR] Database reset or seed failed: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
