const fs = require('fs');

console.log('Loading SQL dump...');
const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

function countStatementsAndTuples(tableName) {
  const startRegex = new RegExp(`INSERT\\s+INTO\\s+\`${tableName}\``, 'gi');
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

  const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
  let count = 0;
  trueStatements.forEach(stmt => {
    const tuples = parseSqlTuples(stmt);
    // Ignore first tuple if it's the column list (`id`, `khtn_id`, ...)
    tuples.forEach(t => {
      if (!t.startsWith('`id`') && !t.startsWith('id')) {
        count++;
      }
    });
  });

  return { statements: trueStatements.length, rows: count };
}

const resMain = countStatementsAndTuples('LS_CSKH');
console.log(`LS_CSKH: ${resMain.statements} statements, ${resMain.rows} rows`);

const resSub = countStatementsAndTuples('LS_CSKH_bangphu');
console.log(`LS_CSKH_bangphu: ${resSub.statements} statements, ${resSub.rows} rows`);
console.log(`Total rows to migrate into notes: ${resMain.rows + resSub.rows}`);
