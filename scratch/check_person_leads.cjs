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
    current += ch;
  }
  vals.push(current.trim().replace(/^['"]|['"]$/g, ''));
  return vals;
}

async function checkPersonLeads() {
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
  const notLeadPhones = new Set();
  const mLeads = content.match(/INSERT INTO `LEADS` [^;]+;/gs);
  for (const b of mLeads) {
    const tuples = parseTuples(b);
    for (const t of tuples) {
      const parts = splitTuple(t);
      if (parts[11] === '1') {
        const np = normalizePhone(parts[4]);
        if (np) notLeadPhones.add(np);
      }
    }
  }

  const mDuyet = content.match(/INSERT INTO `DUYET_NOTLEAD` [^;]+;/gs);
  for (const b of mDuyet) {
    const tuples = parseTuples(b);
    for (const t of tuples) {
      const parts = splitTuple(t);
      if (parts[6] === 'Đã duyệt') {
        const np = normalizePhone(parts[3]);
        if (np) notLeadPhones.add(np);
      }
    }
  }

  const phoneList = Array.from(notLeadPhones);
  console.log(`Checking ${phoneList.length} phones...`);

  let matchedPersons = [];
  for (let i = 0; i < phoneList.length; i += 300) {
    const batch = phoneList.slice(i, i + 300);
    const inSql = batch.map(p => `'${p}'`).join(',');
    const res = await query(`SELECT id, phone FROM persons WHERE phone IN (${inSql}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inSql})`);
    if (res.data) matchedPersons.push(...res.data);
  }

  const personIds = Array.from(new Set(matchedPersons.map(p => p.id)));
  console.log(`Found ${personIds.length} distinct persons!`);

  // How many leads belong to these persons?
  let totalLeads = 0;
  for (let i = 0; i < personIds.length; i += 300) {
    const batch = personIds.slice(i, i + 300);
    const inSql = batch.join(',');
    const res = await query(`SELECT COUNT(*) as cnt FROM leads WHERE person_id IN (${inSql})`);
    totalLeads += parseInt(res.data?.[0]?.cnt || 0);
  }
  console.log(`Total leads linked to these persons: ${totalLeads}`);

  // How many contacts belong to these persons?
  let totalContacts = 0;
  for (let i = 0; i < personIds.length; i += 300) {
    const batch = personIds.slice(i, i + 300);
    const inSql = batch.join(',');
    const res = await query(`SELECT COUNT(*) as cnt FROM contacts WHERE person_id IN (${inSql})`);
    totalContacts += parseInt(res.data?.[0]?.cnt || 0);
  }
  console.log(`Total contacts linked to these persons: ${totalContacts}`);
}

checkPersonLeads();
