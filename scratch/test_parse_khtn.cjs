const fs = require('fs');

console.log('Loading SQL dump...');
const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

// Find all start positions of INSERT INTO `KHTN`
const startRegex = /INSERT\s+INTO\s+`KHTN`/gi;
let match;
const startIndices = [];
while ((match = startRegex.exec(content)) !== null) {
  startIndices.push(match.index);
}
console.log('Number of INSERT INTO `KHTN` found:', startIndices.length);

// Instead of matching [^;]+;, we find the true end of the statement by properly parsing quotes until a semicolon outside quotes!
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

let fullTuplesCount = 0;
// Test first 5 blocks
const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
console.log('Successfully extracted true statements:', trueStatements.length);

// Now count tuples with proper quote parsing
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

trueStatements.forEach((stmt, idx) => {
  const tuples = parseSqlTuples(stmt);
  fullTuplesCount += tuples.length;
});
console.log('True total KHTN tuples extracted:', fullTuplesCount);
