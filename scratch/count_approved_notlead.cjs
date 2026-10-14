const fs = require('fs');

const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

function parseTuples(block) {
  const rows = [];
  let inTuple = false;
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;
  let currentFields = [];
  let currentField = '';

  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (isEscaped) {
      currentField += ch;
      isEscaped = false;
      continue;
    }
    if (ch === '\\') {
      isEscaped = true;
      currentField += ch;
      continue;
    }
    if (!inQuote && (ch === "'" || ch === '"')) {
      inQuote = true;
      quoteChar = ch;
      continue;
    }
    if (inQuote && ch === quoteChar) {
      inQuote = false;
      continue;
    }
    if (!inQuote && ch === '(' && !inTuple) {
      inTuple = true;
      currentFields = [];
      currentField = '';
      continue;
    }
    if (!inQuote && ch === ',' && inTuple) {
      currentFields.push(currentField.trim().replace(/^['"]|['"]$/g, ''));
      currentField = '';
      continue;
    }
    if (!inQuote && ch === ')' && inTuple) {
      currentFields.push(currentField.trim().replace(/^['"]|['"]$/g, ''));
      rows.push(currentFields);
      inTuple = false;
      continue;
    }
    if (inTuple) {
      currentField += ch;
    }
  }
  return rows;
}

let pos = 0;
const approvedLeads = new Set();
const approvedPhones = new Set();
const approvedKhtn = new Set();

while (true) {
  const insertIdx = sqlDump.indexOf('INSERT INTO `DUYET_NOTLEAD`', pos);
  if (insertIdx === -1) break;
  const endIdx = sqlDump.indexOf(';\n', insertIdx);
  const block = sqlDump.slice(insertIdx, endIdx === -1 ? undefined : endIdx + 1);
  pos = endIdx === -1 ? sqlDump.length : endIdx + 2;

  const rows = parseTuples(block);
  for (const r of rows) {
    // Col 0: id, 1: lead_id, 2: du_an, 3: phone, 4: yeu_cau, 5: noi_dung, 6: trangthai_duyet, 7: team_id, 8: ngay_tao, 9: khtn_id
    const status = r[6];
    if (status === 'Đã duyệt') {
      if (r[1]) approvedLeads.add(r[1]);
      if (r[3]) approvedPhones.add(r[3]);
      if (r[9]) approvedKhtn.add(r[9]);
    }
  }
}

console.log('Distinct approved lead_id:', approvedLeads.size);
console.log('Distinct approved phones:', approvedPhones.size);
console.log('Distinct approved khtn_id:', approvedKhtn.size);
