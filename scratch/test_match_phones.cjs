const fs = require('fs');
const { query } = require('./query.cjs');

function normalizePhone(p) {
  if (!p) return '';
  let s = p.replace(/[^\d]/g, '');
  if (s.startsWith('84') && s.length >= 11) {
    s = '0' + s.slice(2);
  } else if (!s.startsWith('0') && s.length === 9) {
    s = '0' + s;
  }
  return s;
}

async function testMatch() {
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
  const approvedPhones = new Map();

  while (true) {
    const insertIdx = sqlDump.indexOf('INSERT INTO `DUYET_NOTLEAD`', pos);
    if (insertIdx === -1) break;
    const endIdx = sqlDump.indexOf(';\n', insertIdx);
    const block = sqlDump.slice(insertIdx, endIdx === -1 ? undefined : endIdx + 1);
    pos = endIdx === -1 ? sqlDump.length : endIdx + 2;

    const rows = parseTuples(block);
    for (const r of rows) {
      if (r[6] === 'Đã duyệt') {
        const rawPhone = r[3];
        const norm = normalizePhone(rawPhone);
        if (norm) {
          approvedPhones.set(norm, {
            rawPhone,
            noi_dung: r[5],
            created_at: r[8]
          });
        }
      }
    }
  }

  console.log('Total normalized approved phones in DUYET_NOTLEAD:', approvedPhones.size);

  // Let's check against persons and leads in batches of 500
  const phoneList = Array.from(approvedPhones.keys());
  let matchedPersonsCount = 0;
  let matchedLeadsCount = 0;

  for (let i = 0; i < phoneList.length; i += 300) {
    const batch = phoneList.slice(i, i + 300);
    const inSql = batch.map(p => `'${p}'`).join(',');
    const pRes = await query(`SELECT COUNT(*) as cnt FROM persons WHERE phone IN (${inSql}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inSql})`);
    matchedPersonsCount += parseInt(pRes.data?.[0]?.cnt || 0);

    const lRes = await query(`SELECT COUNT(*) as cnt FROM leads WHERE phone IN (${inSql}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inSql})`);
    matchedLeadsCount += parseInt(lRes.data?.[0]?.cnt || 0);
  }

  console.log('Matched in persons table:', matchedPersonsCount);
  console.log('Matched in leads table:', matchedLeadsCount);
}

testMatch();
