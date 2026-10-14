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

async function dryRun() {
  console.log('Loading AppsheetRLVN.sql...');
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
  const notLeadPhones = new Set();
  const notLeadAppsheetIds = new Set();
  const duyetReports = [];

  const mLeads = content.match(/INSERT INTO `LEADS` [^;]+;/gs);
  for (const b of mLeads) {
    const tuples = parseTuples(b);
    for (const t of tuples) {
      const parts = splitTuple(t);
      if (parts[11] === '1') {
        notLeadAppsheetIds.add(parts[0]);
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
        if (parts[1]) notLeadAppsheetIds.add(parts[1]);
        duyetReports.push({
          lead_id_str: parts[1],
          phone: np,
          reason: parts[5] || 'Not Lead',
          created_at: parts[8] || new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
      }
    }
  }

  console.log(`Found ${notLeadPhones.size} phones, ${duyetReports.length} reports.`);

  const phoneList = Array.from(notLeadPhones);
  let matchedPersons = [];
  for (let i = 0; i < phoneList.length; i += 300) {
    const batch = phoneList.slice(i, i + 300);
    const inSql = batch.map(p => `'${p}'`).join(',');
    const res = await query(`SELECT id, phone FROM persons WHERE phone IN (${inSql}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inSql})`);
    if (res.data) matchedPersons.push(...res.data);
  }

  const personIds = Array.from(new Set(matchedPersons.map(p => p.id)));
  console.log(`Matched ${personIds.length} persons in database.`);

  // Check current pipeline_status of these persons
  let pipeStatuses = {};
  for (let i = 0; i < personIds.length; i += 300) {
    const batch = personIds.slice(i, i + 300);
    const inSql = batch.join(',');
    const res = await query(`SELECT pipeline_status, COUNT(*) as cnt FROM contacts WHERE person_id IN (${inSql}) GROUP BY pipeline_status`);
    if (res.data) {
      res.data.forEach(r => {
        pipeStatuses[r.pipeline_status] = (pipeStatuses[r.pipeline_status] || 0) + parseInt(r.cnt);
      });
    }
  }
  console.log('Current contacts pipeline_status for these persons:', pipeStatuses);
}

dryRun();
