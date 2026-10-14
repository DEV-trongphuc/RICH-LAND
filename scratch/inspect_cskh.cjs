const fs = require('fs');
const readline = require('readline');
const { query } = require('./query.cjs');

async function inspectCSKH() {
  console.log('--- 1. Phân tích LS_CSKH và LS_CSKH_bangphu trong AppsheetRLVN.sql ---');
  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inCSKH = false;
  let inCSKH_bp = false;
  let cskhCount = 0;
  let cskhBpCount = 0;
  const sampleCSKH = [];

  for await (const line of rl) {
    if (line.includes('INSERT INTO `LS_CSKH`') || line.includes('INSERT INTO LS_CSKH')) {
      inCSKH = true;
      inCSKH_bp = false;
      continue;
    }
    if (line.includes('INSERT INTO `LS_CSKH_bangphu`') || line.includes('INSERT INTO LS_CSKH_bangphu')) {
      inCSKH = false;
      inCSKH_bp = true;
      continue;
    }
    if (line.includes('INSERT INTO') || line.includes('CREATE TABLE')) {
      inCSKH = false;
      inCSKH_bp = false;
    }

    if (inCSKH && line.trim().startsWith('(')) {
      cskhCount++;
      if (sampleCSKH.length < 3) sampleCSKH.push({ tbl: 'LS_CSKH', line: line.slice(0, 200) });
    }
    if (inCSKH_bp && line.trim().startsWith('(')) {
      cskhBpCount++;
      if (sampleCSKH.length < 6) sampleCSKH.push({ tbl: 'LS_CSKH_bangphu', line: line.slice(0, 200) });
    }
  }

  console.log(`LS_CSKH: ${cskhCount} dòng`);
  console.log(`LS_CSKH_bangphu: ${cskhBpCount} dòng`);
  console.log('Sample rows:\n', sampleCSKH);

  // Check notes table in CRM MySQL
  console.log('\n--- 2. Kiểm tra bảng notes trong CRM MySQL ---');
  const notesCols = await query('SHOW COLUMNS FROM notes;');
  console.log('Cột bảng notes:', notesCols.data.map(c => c.Field));

  const notesSample = await query(`
    SELECT id, contact_id, author_id, content, type, created_at
    FROM notes
    ORDER BY id DESC
    LIMIT 3;
  `);
  console.log('Sample notes trong CRM:', notesSample.data);

  // Check how many notes have contact_id matching contacts
  const notesMatching = await query(`
    SELECT 
      COUNT(*) as total_notes,
      COUNT(DISTINCT contact_id) as distinct_contacts,
      SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) as matched_contacts,
      SUM(CASE WHEN c.id IS NULL THEN 1 ELSE 0 END) as orphan_notes,
      SUM(CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as matched_authors,
      SUM(CASE WHEN u.id IS NULL THEN 1 ELSE 0 END) as orphan_authors
    FROM notes n
    LEFT JOIN contacts c ON n.contact_id = c.id
    LEFT JOIN users u ON n.author_id = u.id;
  `);
  console.log('\nThống kê tính toàn vẹn của bảng notes:', notesMatching.data[0]);
}

inspectCSKH().catch(console.error);
