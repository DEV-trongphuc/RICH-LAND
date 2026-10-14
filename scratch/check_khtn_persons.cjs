const fs = require('fs');
const { query } = require('./query.cjs');

function normalizePhone(p) {
  if (!p) return '';
  let clean = String(p).replace(/[^0-9]/g, '');
  if (clean.startsWith('84') && clean.length > 9) {
    clean = '0' + clean.slice(2);
  }
  return clean;
}

async function checkKhtnPersons() {
  console.log('1. Loading persons from live CRM...');
  const res = await query("SELECT id, phone FROM persons;");
  const livePersons = res.data || [];
  const personPhoneMap = new Map();
  livePersons.forEach(p => {
    const clean = normalizePhone(p.phone);
    if (clean) personPhoneMap.set(clean, p.id);
  });
  console.log(`Loaded ${personPhoneMap.size} phones from persons table.`);

  console.log('2. Loading lead_map.json...');
  const leadMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', 'utf8'));

  console.log('3. Parsing KHTN from AppSheet dump...');
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
  let matchedByLead = 0;
  let matchedByPhone = 0;
  let missingPerson = 0;
  const missingPhones = [];

  trueStatements.forEach(stmt => {
    const tuples = parseSqlTuples(stmt);
    tuples.forEach(t => {
      const p = splitTupleValues(t);
      if (p[0] === '`id`' || p[0] === 'id') return;
      const leadId = p[1];
      const phone = p[5];
      const cleanPhone = normalizePhone(phone);

      if (leadId && leadMap[leadId] && leadMap[leadId].person_id) {
        matchedByLead++;
      } else if (cleanPhone && personPhoneMap.has(cleanPhone)) {
        matchedByPhone++;
      } else {
        missingPerson++;
        if (cleanPhone) missingPhones.push({ phone: cleanPhone, name: p[4] });
      }
    });
  });

  console.log(`Matched by Lead Map: ${matchedByLead}`);
  console.log(`Matched by Person Phone: ${matchedByPhone}`);
  console.log(`Missing Person: ${missingPerson}`);
  console.log(`Missing Phones count: ${missingPhones.length}`);
  if (missingPhones.length > 0) {
    console.log('Sample missing phones:', missingPhones.slice(0, 5));
  }
}

checkKhtnPersons();
