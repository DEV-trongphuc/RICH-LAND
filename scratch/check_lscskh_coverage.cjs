const fs = require('fs');

console.log('Loading contact_map and lead_map...');
const contactMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\contact_map.json', 'utf8'));
const leadMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', 'utf8'));

console.log(`contact_map has ${Object.keys(contactMap).length} entries.`);

console.log('Loading SQL dump...');
const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

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

function checkTable(tableName) {
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
      if (isEscaped) { isEscaped = false; continue; }
      if (ch === '\\') { isEscaped = true; continue; }
      if (!inQuote && (ch === "'" || ch === '"')) { inQuote = true; quoteChar = ch; continue; }
      if (inQuote && ch === quoteChar) { inQuote = false; continue; }
      if (!inQuote && ch === ';') return str.slice(startIdx, i + 1);
    }
    return str.slice(startIdx);
  }

  let matchedDirect = 0;
  let matchedParent = 0;
  let unmatched = 0;
  const unmatchedSamples = [];

  const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
  trueStatements.forEach(stmt => {
    const tuples = parseSqlTuples(stmt);
    tuples.forEach(t => {
      const p = splitTupleValues(t);
      if (p[0] === '`id`' || p[0] === 'id') return;
      const khtnId = p[1];
      const parentId = p[6];

      if (khtnId && contactMap[khtnId]) {
        matchedDirect++;
      } else if (parentId && contactMap[parentId]) {
        matchedParent++;
      } else {
        unmatched++;
        if (unmatchedSamples.length < 5) unmatchedSamples.push({ id: p[0], khtnId, parentId, leadId: p[7] });
      }
    });
  });

  console.log(`\nTable ${tableName}:`);
  console.log(`  Matched directly via khtn_id: ${matchedDirect}`);
  console.log(`  Matched via parent_id: ${matchedParent}`);
  console.log(`  Unmatched: ${unmatched}`);
  if (unmatchedSamples.length > 0) {
    console.log('  Sample unmatched:', unmatchedSamples);
  }
}

checkTable('LS_CSKH');
checkTable('LS_CSKH_bangphu');
