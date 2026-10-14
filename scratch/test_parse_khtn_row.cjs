const fs = require('fs');

const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
const idx = sqlDump.indexOf('KHTN260919131514');
const blockStart = sqlDump.lastIndexOf('INSERT INTO `KHTN`', idx);
const blockEnd = sqlDump.indexOf(';\n', blockStart);
const block = sqlDump.slice(blockStart, blockEnd + 2);

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

const tuples = parseSqlTuples(block);
console.log('Tuples in block:', tuples.length);
const target = tuples.find(t => t.includes('KHTN260919131514'));
if (target) {
  const vals = splitTupleValues(target);
  for (let i = 0; i < vals.length; i++) {
    if (vals[i]) {
      console.log(`[${i}] ${vals[i].slice(0, 60)} (has \\\\n: ${vals[i].includes('\\n')})`);
    }
  }
}
