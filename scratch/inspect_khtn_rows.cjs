const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

// Find a statement of KHTN
const m = content.match(/INSERT\s+INTO\s+`KHTN`[^;]+;/i);

function parseSqlTuples(block) {
  const tuples = [];
  let inTuple = false;
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;
  let currentTuple = '';

  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (isEscaped) {
      if (inTuple) currentTuple += ch;
      isEscaped = false;
      continue;
    }
    if (ch === '\\') {
      isEscaped = true;
      if (inTuple) currentTuple += ch;
      continue;
    }
    if (!inQuote && (ch === "'" || ch === '"')) {
      inQuote = true;
      quoteChar = ch;
      if (inTuple) currentTuple += ch;
      continue;
    }
    if (inQuote && ch === quoteChar) {
      inQuote = false;
      if (inTuple) currentTuple += ch;
      continue;
    }
    if (!inQuote && ch === '(') {
      inTuple = true;
      currentTuple = '';
      continue;
    }
    if (!inQuote && ch === ')') {
      inTuple = false;
      tuples.push(currentTuple);
      currentTuple = '';
      continue;
    }
    if (inTuple) {
      currentTuple += ch;
    }
  }
  return tuples;
}

function splitTupleValues(tupleStr) {
  const vals = [];
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;
  let currentVal = '';

  for (let i = 0; i < tupleStr.length; i++) {
    const ch = tupleStr[i];
    if (isEscaped) {
      currentVal += ch;
      isEscaped = false;
      continue;
    }
    if (ch === '\\') {
      isEscaped = true;
      currentVal += ch;
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
    if (!inQuote && ch === ',') {
      vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim().replace(/^'|'$/g, ''));
      currentVal = '';
      continue;
    }
    currentVal += ch;
  }
  vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim().replace(/^'|'$/g, ''));
  return vals;
}

const tuples = parseSqlTuples(m[0]);
// print first 5 rows: id, ngay_tao, full_name, phone
tuples.slice(1, 10).forEach(t => {
  const p = splitTupleValues(t);
  console.log(`id: ${p[0]} | ngay_tao: ${p[3]} | name: ${p[4]} | phone: ${p[5]} | trang_thai: ${p[9]}`);
});
