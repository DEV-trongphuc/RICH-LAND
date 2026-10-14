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
      currentFields.push(currentField.trim());
      currentField = '';
      continue;
    }
    if (!inQuote && ch === ')' && inTuple) {
      currentFields.push(currentField.trim());
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
const counts = {};
let totalRows = 0;

while (true) {
  const insertIdx = sqlDump.indexOf('INSERT INTO `KHTN`', pos);
  if (insertIdx === -1) break;
  const endIdx = sqlDump.indexOf(';\n', insertIdx);
  const block = sqlDump.slice(insertIdx, endIdx === -1 ? undefined : endIdx + 1);
  pos = endIdx === -1 ? sqlDump.length : endIdx + 2;

  const rows = parseTuples(block);
  for (const r of rows) {
    totalRows++;
    // Col 0: id, 1: lead_id, 2: team_id, 3: ngay_tao, 4: full_name, 5: phone, 6: chan_dung, 7: phan_loai_lead, 8: du_an, 9: trang_thai
    const tt = r[9];
    counts[tt] = (counts[tt] || 0) + 1;
  }
}

console.log('Total KHTN parsed:', totalRows);
console.log('trang_thai distribution in AppsheetRLVN.sql:');
console.log(JSON.stringify(counts, null, 2));
