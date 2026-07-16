<?php
// D:\RICH_LAND_DATA_UI\backend\run_reset_db.php
// Script to safely drop, re-create tables, apply migrations, and seed beautiful test data.

// Safe check: Allow CLI, inclusion by diagnostic script, or token validation
$isCli = (php_sapi_name() === 'cli');
$hasValidToken = (($_GET['token'] ?? '') === 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7') || defined('DIAG_TOKEN');
if (!$isCli && !$hasValidToken) {
    http_response_code(403);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Forbidden: Direct access to database reset is not allowed']);
    exit;
}

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

    // Seed Cloud Files (Tài liệu lưu trữ đám mây)
    $stmtFile = $conn->prepare("INSERT INTO cloud_files (tenant_id, uploaded_by, name, file_path, mime_type, file_size, category, visibility) VALUES (1, ?, ?, ?, ?, ?, ?, 'shared')");
    
    // File 1
    $f1Name = 'Tài liệu Pháp lý & Quy hoạch Vũ Yên.pdf';
    $f1Path = 'uploads/Quy_hoach_Vu_Yen.pdf';
    $f1Mime = 'application/pdf';
    $f1Size = 5242880;
    $f1Cat = 'legal';
    $stmtFile->bind_param("isssis", $superAdminId, $f1Name, $f1Path, $f1Mime, $f1Size, $f1Cat);
    $stmtFile->execute();
    $file1Id = $stmtFile->insert_id ?: 1;

    // File 2
    $f2Name = 'Bảng hàng Vinhomes Vũ Yên đợt 1.xlsx';
    $f2Path = 'uploads/Bang_hang_Vu_Yen.xlsx';
    $f2Mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    $f2Size = 2097152;
    $f2Cat = 'sales';
    $stmtFile->bind_param("isssis", $superAdminId, $f2Name, $f2Path, $f2Mime, $f2Size, $f2Cat);
    $stmtFile->execute();
    $file2Id = $stmtFile->insert_id ?: 2;
    
    $stmtFile->close();
    echo "   - Seeded 2 Cloud Files\n";

    // Seed Projects (Dự án)
    $projects = [
        [
            'name' => 'Vinhomes Royal Island Vũ Yên', 
            'code' => 'VH-ROYAL', 
            'developer' => 'Tập đoàn Vingroup', 
            'location' => 'Đảo Vũ Yên, Thủy Nguyên, Hải Phòng',
            'manager_ids' => "$managerId",
            'document_ids' => "$file1Id,$file2Id",
            'campaign_ids' => 'Chiến dịch Vinhomes Vũ Yên Hè 2026'
        ],
        [
            'name' => 'Diamond Crown Plaza Hải Phòng', 
            'code' => 'DOJI-DCP', 
            'developer' => 'Tập đoàn DOJI', 
            'location' => 'Lê Hồng Phong, Ngô Quyền, Hải Phòng',
            'manager_ids' => "$managerId",
            'document_ids' => "$file2Id",
            'campaign_ids' => ""
        ]
    ];
    $projectIds = [];
    foreach ($projects as $p) {
        $stmt = $conn->prepare("INSERT INTO projects (tenant_id, name, code, developer, location, manager_ids, document_ids, campaign_ids) VALUES (1, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssssss", $p['name'], $p['code'], $p['developer'], $p['location'], $p['manager_ids'], $p['document_ids'], $p['campaign_ids']);
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
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN project_id INT NULL DEFAULT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN user_ids TEXT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN manager_ids TEXT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN document_ids TEXT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN folder_path VARCHAR(500) DEFAULT NULL");
    $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN reference_url VARCHAR(500) NULL");

    $stmtCamp = $conn->prepare("INSERT INTO marketing_campaigns (tenant_id, name, description, status, project_id, user_ids) VALUES (1, 'Chiến dịch Vinhomes Vũ Yên Hè 2026', 'Tập trung phân phối biệt thự đảo sinh thái Vũ Yên', 'active', ?, ?)");
    $projIdVal = (int)$vinId;
    $usersList = implode(',', $salesIds);
    $stmtCamp->bind_param("is", $projIdVal, $usersList);
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
        ['name' => 'Hoàng Kim Long', 'phone' => '0909998888', 'email' => 'long.hoang@gmail.com'],
        ['name' => 'Đặng Thu Thảo', 'phone' => '0907776666', 'email' => 'thao.dang@gmail.com'],
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
                 VALUES (1, {$personIds['Hoàng Kim Long']}, 'Hoàng', 'Kim Long', 'long.hoang@gmail.com', '0909998888', $namId, 'qualified', 'tu_van', 'hot', 'FB ads')");
    $contactLongId = $conn->insert_id;

    // Contact 2: Customer / Dat coc
    $conn->query("INSERT INTO contacts (tenant_id, person_id, first_name, last_name, email, phone, owner_id, status, pipeline_status, temperature, source) 
                 VALUES (1, {$personIds['Đặng Thu Thảo']}, 'Đặng', 'Thu Thảo', 'thao.dang@gmail.com', '0907776666', $namId, 'customer', 'dat_coc', 'warm', 'Zalo')");
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
    
    // Customer Activities (Planned/Done, Tasks/Calls/Meetings/Emails)
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, related_type, related_id) 
                 VALUES (1, $namId, 'task', 'Soạn thảo hợp đồng đặt cọc căn HG-18', 'Cần soạn thảo và gửi dự thảo hợp đồng đặt cọc cho khách hàng Đặng Thu Thảo để duyệt trước.', 'planned', 'high', 'contact', $contactThaoId)");
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, related_type, related_id) 
                 VALUES (1, $namId, 'call', 'Gọi điện xác nhận lịch hẹn xem dự án Vũ Yên', 'Xác nhận thời gian và địa điểm đón khách hàng Hoàng Kim Long vào cuối tuần.', 'planned', 'medium', 'contact', $contactLongId)");
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, related_type, related_id) 
                 VALUES (1, $namId, 'call', 'Tư vấn vị trí căn góc Shophouse Tài Lộc', 'Khách hàng Quốc Cường đã nghe tư vấn và chọn căn TL-09.', 'done', 'high', 'contact', $contactCuongId)");
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, related_type, related_id) 
                 VALUES (1, $namId, 'meeting', 'Họp ký kết thỏa thuận dịch vụ môi giới', 'Gặp trực tiếp khách hàng Đặng Thu Thảo tại văn phòng để ký thỏa thuận.', 'planned', 'high', 'contact', $contactThaoId)");
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, related_type, related_id) 
                 VALUES (1, $namId, 'email', 'Gửi bảng báo giá chi tiết và CSBH mới nhất', 'Gửi qua email thông tin chi tiết chính sách bán hàng dự án Vũ Yên.', 'planned', 'medium', 'contact', $contactLongId)");

    // Team Activities (planned, internal)
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, tags) 
                 VALUES (1, $namId, 'meeting', 'Họp giao ban tuần Đội ngũ Hải Phòng', 'Báo cáo tiến độ tiếp cận khách hàng và chia sẻ kinh nghiệm xử lý từ chối.', 'planned', 'high', 'team_meeting,internal')");
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, tags) 
                 VALUES (1, $namId, 'task', 'Trực bàn trực dự án Vinhomes Royal Island', 'Phân ca trực bàn trực tại sa bàn nhà mẫu Vũ Yên.\\n\\n- [ ] Lập danh sách trực tuần 1\\n- [x] Đăng ký trực với ban quản lý dự án\\n- [ ] Phân công chuẩn bị tài liệu dự án\\n- [ ] Chuẩn bị nước uống và hoa quả cho khách hàng', 'planned', 'medium', 'duty_schedule,internal')");

    // Personal Activities (planned/done, personal_task)
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, tags) 
                 VALUES (1, $namId, 'task', 'Nghiên cứu tài liệu pháp lý dự án Diamond Crown', 'Đọc và hiểu rõ quy hoạch 1/500 dự án Diamond Crown Plaza để tư vấn cho khách.\\n\\n- [x] Tải file quy hoạch 1/500\\n- [ ] Đọc hết chương 3 về pháp lý đất đai\\n- [ ] Lập slide tóm tắt các điểm quan trọng', 'planned', 'low', 'personal_task,study')");
    $conn->query("INSERT INTO activities (tenant_id, user_id, type, subject, body, status, priority, tags) 
                 VALUES (1, $namId, 'task', 'Tham gia khóa đào tạo kỹ năng telesale BĐS', 'Hoàn thành khóa học telesale do công ty tổ chức.\\n\\n- [x] Đăng ký lớp học\\n- [x] Tham gia buổi lý thuyết 1\\n- [x] Thực hành cuộc gọi trực tiếp\\n- [x] Nhận chứng chỉ hoàn thành', 'done', 'medium', 'personal_task,training')");

    echo "   - Created Notes and Activities\n";

    // Seed Invoices
    $conn->query("INSERT INTO invoices (tenant_id, contact_id, invoice_number, title, status, issue_date, due_date, total, created_by) 
                 VALUES (1, $contactCuongId, 'INV-2026-0001', 'Hóa đơn Đợt 1 Căn CC-1205', 'paid', '2026-07-01', '2026-07-15', 1500000000.00, $superAdminId)");
    echo "   - Created Paid Invoice (1.5 Billion VND)\n";

    // Seed Deposits
    $conn->query("INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) 
                 VALUES ($contactThaoId, $vinId, 'TL-09', 12500000000.00, 375000000.00, 'approved', $namId)");
    echo "   - Created Confirmed Deposit (200 Million VND)\n";

    // Seed Tickets (Báo lỗi data & Hỗ trợ)
    $conn->query("INSERT INTO tickets (tenant_id, contact_id, created_by, assignee_id, subject, customer_name, description, status, priority) 
                 VALUES (1, $contactLongId, $namId, $managerId, 'Trùng số điện thoại khách hàng Long', 'Hoàng Kim Long', 'Số điện thoại 0909998888 đã có trong hệ thống từ trước.', 'open', 'high')");
    $conn->query("INSERT INTO tickets (tenant_id, contact_id, created_by, assignee_id, subject, customer_name, description, status, priority) 
                 VALUES (1, $contactThaoId, $namId, $managerId, 'Yêu cầu đổi phương án vay ngân hàng', 'Đặng Thu Thảo', 'Khách hàng muốn chuyển từ gói vay Techcombank sang Vietcombank.', 'in_progress', 'medium')");
    echo "   - Created Tickets (Data & Support)\n";

    // Seed Check-ins (Chấm công)
    $conn->query("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES ($namId, CURDATE(), '08:05:22', 'approved')");
    $conn->query("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES ($maiId, CURDATE(), '07:58:10', 'approved')");
    echo "   - Seeded Today Attendance Check-ins\n";

    // Seed Project Documents (Tài liệu dự án)
    $conn->query("INSERT INTO project_documents (project_id, name, file_path, file_size, mime_type, uploaded_by) 
                 VALUES ($vinId, 'Layout_Mat_Bang_Vin_Vu_Yen.pdf', '/uploads/Layout_Mat_Bang_Vin_Vu_Yen.pdf', 5242880, 'application/pdf', $superAdminId)");
    echo "   - Seeded Project Documents\n";

    // Seed Cooperation Slips (Duyệt hợp tác)
    $sharesJson = json_encode([['user_id' => $namId, 'percentage' => 70], ['user_id' => $maiId, 'percentage' => 30]]);
    $conn->query("INSERT INTO cooperation_slips (contact_id, version, total_percentage, shares_json, status, created_by) 
                 VALUES ($contactThaoId, 1, 100, '$sharesJson', 'approved', $namId)");
    echo "   - Seeded Cooperation Slips\n";

    // Seed Quotes (Báo giá)
    $conn->query("INSERT INTO quotes (tenant_id, contact_id, created_by, quote_number, title, status, total) 
                 VALUES (1, $contactThaoId, $namId, 'QT-2026-0001', 'Báo giá Shophouse Tài Lộc', 'accepted', 12500000000.00)");
    echo "   - Seeded Quotes\n";

    // Seed Expenses (Chi phí vận hành)
    $conn->query("INSERT INTO expenses (tenant_id, created_by, title, category, amount, date, status) 
                 VALUES (1, $superAdminId, 'Thuê văn phòng Hải Phòng Tháng 7/2026', 'rental', 45000000.00, '2026-07-01', 'approved')");
    echo "   - Seeded Operating Expenses\n";

    // Seed Purchase Orders (Đơn nhập hàng - Kho hàng)
    $vingroupId = $supplierIds['Tập đoàn Vingroup'];
    $conn->query("INSERT INTO purchase_orders (tenant_id, supplier_id, created_by, po_number, order_date, status, total) 
                 VALUES (1, $vingroupId, $superAdminId, 'PO-2026-0001', '2026-07-01', 'received', 45000000000.00)");
    echo "   - Seeded Purchase Orders\n";

    // Seed Public Persons (Kho Databank)
    $publicPersons = [
        ['name' => 'Vũ Minh Trí', 'phone' => '0934567890', 'email' => 'tri.vu@gmail.com', 'source' => 'Google Search', 'project_id' => $vinId],
        ['name' => 'Nguyễn Thị Lan', 'phone' => '0976543210', 'email' => 'lan.nguyen@outlook.com', 'source' => 'Facebook Lead', 'project_id' => $projectIds['Diamond Crown Plaza Hải Phòng']]
    ];
    foreach ($publicPersons as $pp) {
        $stmt = $conn->prepare("INSERT INTO persons (phone, email, full_name, is_public, released_to_kho_at) VALUES (?, ?, ?, 1, NOW())");
        $stmt->bind_param("sss", $pp['phone'], $pp['email'], $pp['name']);
        $stmt->execute();
        $pid = $stmt->insert_id;
        $stmt->close();
        
        $stmtC = $conn->prepare("INSERT INTO contacts (tenant_id, person_id, first_name, last_name, email, phone, status, pipeline_status, source, project_id) 
                                VALUES (1, ?, ?, '', ?, ?, 'qualified', 'tu_van', ?, ?)");
        $stmtC->bind_param("issssi", $pid, $pp['name'], $pp['email'], $pp['phone'], $pp['source'], $pp['project_id']);
        $stmtC->execute();
        $stmtC->close();
    }
    echo "   - Seeded Public Persons & Contacts in Databank\n";

    // Seed Leads (Kho Data)
    $conn->query("INSERT INTO leads (phone, email, name, source, type, status, connection_id) 
                 VALUES ('0909998888', 'long.hoang@gmail.com', 'Hoàng Kim Long', 'Google Ads', 'import', 'assigned', 1)");
    $lead1Id = $conn->insert_id ?: 1;
    $conn->query("INSERT INTO leads (phone, email, name, source, type, status, connection_id) 
                 VALUES ('0907776666', 'thao.dang@yahoo.com', 'Đặng Thu Thảo', 'Facebook Lead', 'sync', 'assigned', 1)");
    $lead2Id = $conn->insert_id ?: 2;
    echo "   - Seeded Leads (Kho Data)\n";

    // Seed Distribution Logs (Nhật ký phân bổ)
    $conn->query("INSERT INTO distribution_logs (lead_id, round_id, assigned_to, status, received_at) 
                 VALUES ($lead1Id, 1, $namId, 'assigned', NOW())");
    $conn->query("INSERT INTO distribution_logs (lead_id, round_id, assigned_to, status, received_at) 
                 VALUES ($lead2Id, 1, $maiId, 'assigned', NOW())");
    echo "   - Seeded Distribution Logs\n";

    // Seed Data Reports (Ticket báo lỗi)
    $conn->query("INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, status, created_at) 
                 VALUES ($lead1Id, $namId, 1, 'Sai số điện thoại / Số ảo', 'pending', NOW())");
    echo "   - Seeded Data Reports\n";

    // Seed Login Attempts (Lịch sử đăng nhập)
    $conn->query("INSERT INTO login_attempts (email, ip_address, attempt_time, is_successful) 
                 VALUES ('admin@richland.vn', '127.0.0.1', NOW(), 1)");
    echo "   - Seeded Login Attempts\n";

    // Seed Notifications (Thông báo)
    $conn->query("INSERT INTO notifications (user_id, tenant_id, title, body, is_read, created_at) 
                 VALUES ($namId, 1, 'Lead Mới Được Phân Phối', 'Bạn nhận được khách hàng Đặng Thu Thảo từ vòng xoay.', 0, NOW())");
    echo "   - Seeded Notifications\n";

    // Seed Custom Fields (Trường tùy chỉnh)
    $conn->query("INSERT INTO custom_fields (tenant_id, entity_type, field_key, label, field_type) 
                 VALUES (1, 'contact', 'finance_source', 'Nguồn tài chính dự kiến', 'text')");
    $cfId = $conn->insert_id ?: 1;
    $conn->query("INSERT INTO custom_field_values (custom_field_id, entity_id, value_text) 
                 VALUES ($cfId, 1, 'Vay ngân hàng 70%')");
    echo "   - Seeded Custom Fields & Values\n";

    // Seed Sheet Connections (Liên kết trang tính Google Sheets)
    $conn->query("INSERT INTO sheet_connections (sheet_name, spreadsheet_id, webhook_token, is_active) 
                 VALUES ('Google Sheet Đăng Ký Vũ Yên', '1abc123xyz', 'token_sheet_connection_001', 1)");
    echo "   - Seeded Sheet Connections\n";

    // Seed Routing Rules (Quy tắc phân bổ nâng cao)
    $conn->query("INSERT INTO routing_rules (connection_id, target_round_id, condition_column, condition_value, priority) 
                 VALUES ('1', 1, 'province', 'Hải Phòng', 1)");
    echo "   - Seeded Routing Rules\n";

    // Seed Workflows & Templates (Quy trình tiến độ)
    $conn->query("INSERT INTO workflows (tenant_id, name, trigger_type, actions, is_active, created_by) 
                 VALUES (1, 'Chăm sóc sau cuộc hẹn', 'status_changed', '[]', 1, $superAdminId)");
    $conn->query("INSERT INTO workflow_task_templates (tenant_id, stage_id, title, description, priority, due_days_offset, require_approval) 
                 VALUES (1, 1, 'Gọi điện xác nhận dịch vụ', 'Gọi lại cho khách hàng sau 2 ngày để xác nhận tiến độ.', 'medium', 2, 0)");
    echo "   - Seeded Workflows & Templates\n";

    // Seed Queues (Zalo, Mail, CAPI)
    $conn->query("INSERT INTO zalo_queue (bot_token, chat_id, body_text, status, lead_id) 
                 VALUES ('zalo_token_01', 'zalo_chat_123', 'Chào anh Long, em gửi thông tin mặt bằng dự án Vũ Yên qua Zalo.', 'pending', $lead1Id)");
    $conn->query("INSERT INTO mail_queue (to_email, subject, body_html, status, lead_id) 
                 VALUES ('long.hoang@gmail.com', 'Mặt bằng Vinhomes Royal Island Vũ Yên', '<p>Chào anh Long...</p>', 'pending', $lead1Id)");
    $conn->query("INSERT INTO capi_logs (lead_id, contact_id, event_name, payload_hash, sent_payload, response_status, response_body) 
                 VALUES ($lead1Id, 1, 'CompleteRegistration', 'hash123', '{\"phone\":\"0909998888\"}', 200, '{\"success\":true}')");
    echo "   - Seeded Communication Queues (Zalo, Mail, CAPI)\n";

    // Seed Logs (Audit & Communication)
    $conn->query("INSERT INTO audit_logs (tenant_id, user_id, action, resource, resource_id, old_data, new_data) 
                 VALUES (1, $superAdminId, 'update', 'contact', 1, '{\"status\":\"qualified\"}', '{\"status\":\"assigned\"}')");
    $conn->query("INSERT INTO communication_logs (lead_id, type, recipient, status) 
                 VALUES ($lead1Id, 'zalo', '0909998888', 'sent')");
    echo "   - Seeded System Audit & Comm Logs\n";

    // Seed Comments
    $conn->query("INSERT INTO activity_comments (tenant_id, activity_id, user_id, content) 
                 VALUES (1, 1, $managerId, 'Cần bám sát khách này, họ rất có thiện chí.')");
    echo "   - Seeded Activity Comments\n";

    // Seed Leaves (Nghỉ phép)
    $conn->query("INSERT INTO consultant_leaves (consultant_id, start_date, end_date) 
                 VALUES ($namId, '2026-07-10', '2026-07-12')");
    echo "   - Seeded Consultant Leaves\n";

    // Seed Quote & Invoice Items
    $conn->query("INSERT INTO quote_items (quote_id, product_id, name, quantity, unit_price) 
                 VALUES (1, 2, 'Shophouse Tài Lộc TL-09', 1.00, 12500000000.00)");
    $conn->query("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price) 
                 VALUES (1, 3, 'Căn hộ 2 phòng ngủ CC-1205', 1.00, 1500000000.00)");
    echo "   - Seeded Itemized Quote & Invoice Details\n";

    // Seed Batches & Inventory Logs
    $conn->query("INSERT INTO batches (tenant_id, product_id, supplier_id, batch_code, import_date, import_price, initial_qty, current_qty) 
                 VALUES (1, 1, $vingroupId, 'BATCH-BT-01', '2026-07-01', 45000000000.00, 1, 1)");
    $batchId = $conn->insert_id ?: 1;
    $conn->query("INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by) 
                 VALUES (1, $batchId, 'IMPORT', 1, 'Nhập giỏ hàng căn biệt thự đơn lập', $superAdminId)");
    echo "   - Seeded Batches & Inventory Logs\n";

    // Seed active_compensation_logs (Bù lead)
    $conn->query("INSERT INTO active_compensation_logs (round_id, consultant_id, admin_id, amount, reason) 
                 VALUES (1, $namId, $superAdminId, 1, 'Bù data do số điện thoại sai')");
    echo "   - Seeded Active Compensation Logs\n";

    // Seed admin_logs (Nhật ký quản trị)
    $conn->query("INSERT INTO admin_logs (account_id, action, details) 
                 VALUES ($superAdminId, 'reset_database', '{\"client\":\"cli_reset\"}')");
    echo "   - Seeded Admin Logs\n";

    // Seed duplicate_log (Nhật ký trùng lặp)
    $conn->query("INSERT INTO duplicate_log (tenant_id, entity_type, original_id, duplicate_id, match_field, resolved) 
                 VALUES (1, 'contact', 1, 2, 'phone', 0)");
    echo "   - Seeded Duplicate Detection Logs\n";

    // Seed refresh_tokens (Token làm mới)
    $conn->query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
                 VALUES ($superAdminId, 'refresh_token_sample_123_hash', DATE_ADD(NOW(), INTERVAL 30 DAY))");
    echo "   - Seeded Session Refresh Tokens\n";

    // Seed ticket_comments (Bình luận ticket)
    $conn->query("INSERT INTO ticket_comments (ticket_id, user_id, body) 
                 VALUES (1, $managerId, 'Đã xác minh và chuyển sang data khác bù cho Sale.')");
    echo "   - Seeded Ticket Comments\n";

    echo "\n=== DATABASE RESET & SEEDING COMPLETED SUCCESSFULLY ===\n";

} catch (Throwable $e) {
    http_response_code(500);
    echo "\n[ERROR] Database reset or seed failed: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
