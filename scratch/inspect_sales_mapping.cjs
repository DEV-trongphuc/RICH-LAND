const fs = require('fs');
const readline = require('readline');
const { query } = require('./query.cjs');

async function inspectSales() {
  console.log('--- 1. Danh sách nhân viên trong AppsheetRLVN.sql (NHAN_VIEN) ---');
  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inNV = false;
  const nvList = [];

  for await (const line of rl) {
    if (line.includes('INSERT INTO `NHAN_VIEN`') || line.includes('INSERT INTO NHAN_VIEN')) {
      inNV = true;
      continue;
    }
    if (inNV) {
      if (line.includes('INSERT INTO') || line.includes('CREATE TABLE')) {
        inNV = false;
        continue;
      }
      if (line.trim().startsWith('(')) {
        // NHAN_VIEN columns: id, ho_ten, gioi_tinh, avatar, phong_ban, chuc_vu, phe_duyet, phan_quyen, trang_thai_lam_viec, username, password, email, ngay_vao_lam, ngan_hang, quyen_xem, quyen_sua, quyen_xoa, ngay_tao, nguoi_tao, last_update, team_id, floor_director, leader, mode
        const m = line.match(/^\s*\('([^']*)',\s*'([^']*)',\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*'([^']*)'/);
        if (m) {
          const [_, id, ho_ten, gioi_tinh, avatar, phong_ban, chuc_vu, phe_duyet, phan_quyen, trang_thai, username, password, email] = m;
          nvList.push({ id, ho_ten, email: email ? email.toLowerCase().trim() : '', chuc_vu, trang_thai });
        }
      }
    }
  }

  console.log(`Tìm thấy ${nvList.length} nhân viên trong AppSheet:`);
  console.log(nvList.slice(0, 10));

  // Check users in CRM MySQL
  console.log('\n--- 2. Danh sách users & consultants trong CRM MySQL ---');
  const usersRes = await query(`
    SELECT u.id, u.email, u.full_name, u.role, u.status, c.id as consultant_id, c.name as consultant_name
    FROM users u
    LEFT JOIN consultants c ON LOWER(u.email) = LOWER(c.email)
    ORDER BY u.id ASC;
  `);
  console.log(`Tìm thấy ${usersRes.data.length} users trong CRM MySQL.`);

  // Check how many KHTN nguoi_nhan match users
  console.log('\n--- 3. Kiểm tra KHTN.nguoi_nhan trong AppSheet ---');
  const fileStream2 = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl2 = readline.createInterface({ input: fileStream2, crlfDelay: Infinity });

  let inKHTN = false;
  const nguoiNhanCounts = {};

  for await (const line of rl2) {
    if (line.includes('INSERT INTO `KHTN`') || line.includes('INSERT INTO KHTN')) {
      inKHTN = true;
      continue;
    }
    if (inKHTN) {
      if (line.includes('INSERT INTO') || line.includes('CREATE TABLE')) {
        inKHTN = false;
        continue;
      }
      if (line.trim().startsWith('(')) {
        // match nguoi_nhan (col 23)
        // Let's split commas outside quotes or match
        // In KHTN: ..., b'0', 'NV6041609...', ...
        const m = line.match(/'(NV[0-9a-zA-Z]+)'/);
        if (m) {
          const nvId = m[1];
          nguoiNhanCounts[nvId] = (nguoiNhanCounts[nvId] || 0) + 1;
        } else {
          nguoiNhanCounts['NO_NV'] = (nguoiNhanCounts['NO_NV'] || 0) + 1;
        }
      }
    }
  }

  console.log('Top KHTN.nguoi_nhan trong AppSheet:');
  const sortedNV = Object.entries(nguoiNhanCounts).sort((a,b) => b[1] - a[1]);
  for (const [nvId, count] of sortedNV.slice(0, 15)) {
    const nvInfo = nvList.find(x => x.id === nvId);
    const matchedUser = usersRes.data.find(u => nvInfo && u.email === nvInfo.email);
    console.log(`  - ${nvId} (${nvInfo?.ho_ten || 'Unknown'} - ${nvInfo?.email || 'No email'}): ${count} leads => Matched User ID: ${matchedUser?.id || 'NOT_FOUND'}`);
  }

  // Check contacts.owner_id distribution in CRM MySQL
  console.log('\n--- 4. Phân bổ contacts.owner_id hiện tại trong CRM MySQL ---');
  const ownerStats = await query(`
    SELECT c.owner_id, u.full_name, u.email, COUNT(*) as contact_count
    FROM contacts c
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE c.deleted_at IS NULL
    GROUP BY c.owner_id, u.full_name, u.email
    ORDER BY contact_count DESC
    LIMIT 15;
  `);
  console.log('Top owners trong contacts CRM:', ownerStats.data);
}

inspectSales().catch(console.error);
