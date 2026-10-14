const fs = require('fs');
const { query } = require('./query.cjs');

async function checkMatch() {
  const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

  function parseTuples(block) {
    const rows = [];
    let inTuple = false, inQuote = false, quoteChar = '', isEscaped = false;
    let currentFields = [], currentField = '';

    for (let i = 0; i < block.length; i++) {
      const ch = block[i];
      if (isEscaped) { currentField += ch; isEscaped = false; continue; }
      if (ch === '\\') { isEscaped = true; currentField += ch; continue; }
      if (!inQuote && (ch === "'" || ch === '"')) { inQuote = true; quoteChar = ch; continue; }
      if (inQuote && ch === quoteChar) { inQuote = false; continue; }
      if (!inQuote && ch === '(' && !inTuple) { inTuple = true; currentFields = []; currentField = ''; continue; }
      if (!inQuote && ch === ',' && inTuple) { currentFields.push(currentField.trim().replace(/^['"]|['"]$/g, '')); currentField = ''; continue; }
      if (!inQuote && ch === ')' && inTuple) { currentFields.push(currentField.trim().replace(/^['"]|['"]$/g, '')); rows.push(currentFields); inTuple = false; continue; }
      if (inTuple) currentField += ch;
    }
    return rows;
  }

  let pos = 0;
  const approvedRows = [];

  while (true) {
    const insertIdx = sqlDump.indexOf('INSERT INTO `DUYET_NOTLEAD`', pos);
    if (insertIdx === -1) break;
    const endIdx = sqlDump.indexOf(';\n', insertIdx);
    const block = sqlDump.slice(insertIdx, endIdx === -1 ? undefined : endIdx + 1);
    pos = endIdx === -1 ? sqlDump.length : endIdx + 2;

    const rows = parseTuples(block);
    for (const r of rows) {
      // Col 0: id, 1: lead_id, 2: du_an, 3: phone, 4: yeu_cau, 5: noi_dung, 6: trangthai_duyet, 7: team_id, 8: ngay_tao, 9: khtn_id, 10: nguoi_bao_cao
      if (r[6] === 'Đã duyệt') {
        approvedRows.push({
          id: r[0],
          lead_id: r[1],
          phone: r[3],
          noi_dung: r[5],
          created_at: r[8],
          khtn_id: r[9],
          nguoi_bao_cao: r[10]
        });
      }
    }
  }

  console.log('Total approved not lead rows:', approvedRows.length);

  // Let's sample 10 lead_ids and check against our `leads` table in MySQL
  const sampleLeadIds = approvedRows.map(r => r.lead_id).filter(Boolean).slice(0, 10);
  const res = await query(`SELECT id, phone, name, status, connection_id FROM leads WHERE id IN (${sampleLeadIds.map(id => `'${id}'`).join(',')})`);
  console.log('Matched leads by id:', res.data);

  // Check matching by phone
  const samplePhones = approvedRows.map(r => r.phone).filter(Boolean).slice(0, 10);
  const resPhone = await query(`SELECT id, phone, name, status FROM leads WHERE phone IN (${samplePhones.map(p => `'${p}'`).join(',')})`);
  console.log('Matched leads by phone:', resPhone.data);

  // Check matching by khtn_id in contacts
  const sampleKhtn = approvedRows.map(r => r.khtn_id).filter(Boolean).slice(0, 10);
  const resKhtn = await query(`SELECT id, phone, legacy_khtn_id, pipeline_status FROM contacts WHERE legacy_khtn_id IN (${sampleKhtn.map(k => `'${k}'`).join(',')})`);
  console.log('Matched contacts by legacy_khtn_id:', resKhtn.data);
}

checkMatch();
