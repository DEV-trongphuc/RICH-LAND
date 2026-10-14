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
  const insertIdx = sqlDump.indexOf('INSERT INTO `DUYET_NOTLEAD`', pos);
  if (insertIdx === -1) break;
  const endIdx = sqlDump.indexOf(';\n', insertIdx);
  const block = sqlDump.slice(insertIdx, endIdx === -1 ? undefined : endIdx + 1);
  pos = endIdx === -1 ? sqlDump.length : endIdx + 2;

  const rows = parseTuples(block);
  for (const r of rows) {
    totalRows++;
    // Col 0: id, 1: lead_id, 2: du_an, 3: phone, 4: yeu_cau, 5: noi_dung, 6: trangthai_duyet
    const tt = r[6];
    counts[tt] = (counts[tt] || 0) + 1;
  }
}

console.log('Total DUYET_NOTLEAD parsed:', totalRows);
console.log('trangthai_duyet distribution in DUYET_NOTLEAD:');
console.log(JSON.stringify(counts, null, 2));
