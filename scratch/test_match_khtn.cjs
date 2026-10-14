const fs = require('fs');
const { query } = require('./query.cjs');

async function testMatchKhtn() {
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
  const approvedKhtn = new Set();

  while (true) {
    const insertIdx = sqlDump.indexOf('INSERT INTO `DUYET_NOTLEAD`', pos);
    if (insertIdx === -1) break;
    const endIdx = sqlDump.indexOf(';\n', insertIdx);
    const block = sqlDump.slice(insertIdx, endIdx === -1 ? undefined : endIdx + 1);
    pos = endIdx === -1 ? sqlDump.length : endIdx + 2;

    const rows = parseTuples(block);
    for (const r of rows) {
      if (r[6] === 'Đã duyệt' && r[9]) {
        approvedKhtn.add(r[9]);
      }
    }
  }

  console.log('Total distinct approved khtn_id:', approvedKhtn.size);
  const khtnList = Array.from(approvedKhtn);
  let matched = 0;

  for (let i = 0; i < khtnList.length; i += 300) {
    const batch = khtnList.slice(i, i + 300);
    const inSql = batch.map(k => `'${k}'`).join(',');
    const res = await query(`SELECT COUNT(*) as cnt FROM contacts WHERE legacy_khtn_id IN (${inSql})`);
    matched += parseInt(res.data?.[0]?.cnt || 0);
  }

  console.log('Matched contacts by legacy_khtn_id:', matched);
}

testMatchKhtn();
