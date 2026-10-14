const https = require('https');
const fs = require('fs');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          resolve({ error: e.message, raw: d });
        }
      });
    }).on('error', reject);
  });
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

async function main() {
  console.log("==================================================================");
  console.log("🏗️ BƯỚC 1: ĐỒNG BỘ DANH MỤC NỀN TẢNG (PROJECTS & PIPELINE STAGES)");
  console.log("==================================================================");

  // 1. Kiểm tra và bổ sung Stage "Chăm sóc dài hạn" vào pipeline_stages
  console.log("\n1. Kiểm tra pipeline_stages...");
  const curStages = await query("SELECT id, name, order_index, color FROM pipeline_stages ORDER BY order_index ASC");
  console.log("  Các stages hiện tại:", curStages.data);

  const hasNurture = curStages.data && curStages.data.some(s => s.name.toLowerCase().includes('chăm sóc dài hạn'));
  if (!hasNurture) {
    console.log("  ➕ Đang thêm Stage 'Chăm sóc dài hạn' vào pipeline_stages...");
    // Update order_index for existing stages >= 2 to make room
    await query("UPDATE pipeline_stages SET order_index = order_index + 1 WHERE order_index >= 1");
    // Insert 'Chăm sóc dài hạn' at order_index 1
    const insStageSql = `
      INSERT INTO pipeline_stages (tenant_id, name, color, order_index, is_won, is_lost)
      VALUES (1, 'Chăm sóc dài hạn', '#04C7B4', 1, 0, 0)
    `;
    const resStage = await query(insStageSql);
    console.log("  ✅ Thêm Stage thành công:", resStage.status || resStage);
  } else {
    console.log("  ℹ️ Stage 'Chăm sóc dài hạn' đã tồn tại sẵn.");
  }

  // 2. Nạp 38 dự án từ DU_AN trong AppsheetRLVN.sql vào projects
  console.log("\n2. Đọc danh mục dự án từ AppsheetRLVN.sql...");
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
  const mDuAn = content.match(/INSERT INTO `DU_AN` [^;]+;/s);
  if (!mDuAn) {
    throw new Error("Không tìm thấy bảng DU_AN trong file dump!");
  }

  const lines = mDuAn[0].split('\n').filter(l => l.trim().startsWith('('));
  console.log(`  Tìm thấy ${lines.length} dự án trong dump.`);

  // Lấy các projects hiện có trên CRM
  const curProjects = await query("SELECT id, code, name FROM projects");
  const existingCodes = new Set((curProjects.data || []).map(p => p.code));
  console.log(`  CRM hiện có ${existingCodes.size} dự án:`, Array.from(existingCodes));

  let insertedCount = 0;
  for (const line of lines) {
    // Regex trích xuất id, name, domain_name
    const parts = line.match(/'([^']*)'|NULL|\d+/g).map(s => s === 'NULL' ? null : s.replace(/^'|'$/g, ''));
    const code = parts[0];
    const name = parts[1];
    const domain = parts[3] || '';

    if (!existingCodes.has(code)) {
      const sql = `
        INSERT INTO projects (tenant_id, code, name, description, status)
        VALUES (1, ${escapeSql(code)}, ${escapeSql(name)}, ${escapeSql('Dự án đồng bộ từ AppSheet: ' + domain)}, 'active')
      `;
      const res = await query(sql);
      if (res.status === 'success') {
        insertedCount++;
        existingCodes.add(code);
        console.log(`    + Đã thêm dự án: [${code}] ${name}`);
      } else {
        console.warn(`    ⚠️ Lỗi thêm dự án [${code}] ${name}:`, res);
      }
    }
  }

  console.log(`\n✅ Đã bổ sung thành công ${insertedCount} dự án mới vào bảng projects.`);

  // 3. Kiểm tra tổng số dự án sau khi nạp
  const totalProj = await query("SELECT COUNT(*) as total, GROUP_CONCAT(name SEPARATOR ', ') as names FROM projects");
  console.log(`\n📊 Tổng số dự án hiện tại trên CRM: ${totalProj.data[0].total}`);

  // 4. Lưu map projects ra file tạm để các bước sau dùng
  const allProjects = await query("SELECT id, code, name FROM projects");
  const projectMap = {};
  allProjects.data.forEach(p => {
    projectMap[p.code] = p.id;
    projectMap[p.name.toLowerCase().trim()] = p.id;
  });
  fs.writeFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\project_map.json', JSON.stringify(projectMap, null, 2));
  console.log("💾 Đã lưu project_map.json cho các bước kế tiếp.");

  console.log("\n🎉 HOÀN TẤT BƯỚC 1!");
}

main().catch(err => {
  console.error("❌ Lỗi Bước 1:", err);
  process.exit(1);
});
