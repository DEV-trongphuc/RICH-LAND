const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

const startRegex = /INSERT\s+INTO\s+`KHTN`/gi;
let match;
const startIndices = [];
while ((match = startRegex.exec(content)) !== null) {
  startIndices.push(match.index);
}

function extractFullStatement(str, startIdx) {
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;

  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (ch === '\\') {
      isEscaped = true;
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
    if (!inQuote && ch === ';') {
      return str.slice(startIdx, i + 1);
    }
  }
  return str.slice(startIdx);
}

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

const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
const staffCount = {};

trueStatements.forEach(stmt => {
  const tuples = parseSqlTuples(stmt);
  tuples.forEach(t => {
    const p = splitTupleValues(t);
    if (p[0] === '`id`' || p[0] === 'id') return;
    const staff = p[23] || 'UNASSIGNED';
    staffCount[staff] = (staffCount[staff] || 0) + 1;
  });
});

console.log('Distinct staff count in KHTN:', Object.keys(staffCount).length);
console.log('Top staff in KHTN:', Object.entries(staffCount).sort((a,b) => b[1] - a[1]).slice(0, 20));
