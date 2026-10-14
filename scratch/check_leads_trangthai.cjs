const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

const counts = {};
const mLeads = content.match(/INSERT INTO `LEADS` [^;]+;/gs);

// Quick tuple parser
function parseTuples(block) {
  const tuples = [];
  let inTuple = false, inQuote = false, quoteChar = '', isEscaped = false, current = '';
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (isEscaped) { if (inTuple) current += ch; isEscaped = false; continue; }
    if (ch === '\\') { isEscaped = true; if (inTuple) current += ch; continue; }
    if (!inQuote && (ch === "'" || ch === '"')) { inQuote = true; quoteChar = ch; if (inTuple) current += ch; continue; }
    if (inQuote && ch === quoteChar) { inQuote = false; if (inTuple) current += ch; continue; }
    if (!inQuote && ch === '(') { inTuple = true; current = ''; continue; }
    if (!inQuote && ch === ')') { inTuple = false; tuples.push(current); current = ''; continue; }
    if (inTuple) current += ch;
  }
  return tuples;
}

function splitTuple(str) {
  const vals = [];
  let inQuote = false, quoteChar = '', isEscaped = false, current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (isEscaped) { current += ch; isEscaped = false; continue; }
    if (ch === '\\') { isEscaped = true; current += ch; continue; }
    if (!inQuote && (ch === "'" || ch === '"')) { inQuote = true; quoteChar = ch; continue; }
    if (inQuote && ch === quoteChar) { inQuote = false; continue; }
    if (!inQuote && ch === ',') { vals.push(current.trim().replace(/^['"]|['"]$/g, '')); current = ''; continue; }
    if (inTuple = true) current += ch;
  }
  vals.push(current.trim().replace(/^['"]|['"]$/g, ''));
  return vals;
}

for (const b of mLeads) {
  const tuples = parseTuples(b);
  for (const t of tuples) {
    const parts = splitTuple(t);
    const tt = parts[11];
    counts[tt] = (counts[tt] || 0) + 1;
  }
}

console.log('trang_thai distribution in LEADS table:');
console.log(JSON.stringify(counts, null, 2));
