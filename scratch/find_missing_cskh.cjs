const fs = require('fs');
const readline = require('readline');
const { query } = require('./query.cjs');

async function findMissingCSKH() {
  console.log('Fetching all existing legacy_cskh_id from MySQL notes...');
  const res = await query('SELECT legacy_cskh_id FROM notes WHERE legacy_cskh_id IS NOT NULL;');
  const existingNotes = new Set(res.data.map(r => r.legacy_cskh_id));
  console.log(`Existing legacy_cskh_id in MySQL: ${existingNotes.size}`);

  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inCSKH = false;
  const missing = [];

  for await (const line of rl) {
    if (line.includes('INSERT INTO `LS_CSKH`') || line.includes('INSERT INTO LS_CSKH') || line.includes('INSERT INTO `LS_CSKH_bangphu`') || line.includes('INSERT INTO LS_CSKH_bangphu')) {
      inCSKH = true;
      continue;
    }
    if (line.includes('INSERT INTO') || line.includes('CREATE TABLE')) {
      inCSKH = false;
    }
    if (inCSKH && line.trim().startsWith('(')) {
      // Parse columns: id, khtn_id, trang_thai, ngay_chamsoc, noi_dung, nguoi_tao, khtn_parent_id, lead_id, campaign, phanhoi_kh, trangthai_kh
      const m = line.match(/^\s*\('([^']+)',\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([\s\S]*?)'|NULL),\s*(?:'([^']*)'|NULL)/);
      if (m) {
        const [_, id, khtn_id, trang_thai, ngay_chamsoc, noi_dung, nguoi_tao] = m;
        if (!existingNotes.has(id)) {
          missing.push({ id, khtn_id, trang_thai, ngay_chamsoc, noi_dung: (noi_dung || '').slice(0, 80), nguoi_tao });
        }
      }
    }
  }

  console.log(`Found ${missing.length} missing CSKH records!`);
  console.log('Sample missing CSKH:', missing.slice(0, 10));

  // Check if those missing khtn_id exist in contacts
  const missingKHTNIds = [...new Set(missing.map(m => m.khtn_id).filter(Boolean))];
  console.log(`Unique khtn_ids among missing CSKH: ${missingKHTNIds.length}`);

  const checkContacts = await query(`
    SELECT id, legacy_khtn_id, phone, first_name 
    FROM contacts 
    WHERE legacy_khtn_id IN ('${missingKHTNIds.slice(0, 50).join("','")}');
  `);
  console.log(`Matched contacts for first 50 missing khtn_ids: ${checkContacts.data.length}`);
}

findMissingCSKH().catch(console.error);
