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

async function prepareNotLeads() {
  console.log('Loading AppsheetRLVN.sql...');
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

  // 1. Collect from LEADS where trang_thai = 1
  const notLeadAppsheetIds = new Set();
  const notLeadPhones = new Set();
  const mLeads = content.match(/INSERT INTO `LEADS` [^;]+;/gs);
  for (const b of mLeads) {
    const tuples = parseTuples(b);
    for (const t of tuples) {
      const parts = splitTuple(t);
      // Col 0: id, Col 4: phone, Col 11: trang_thai
      if (parts[11] === '1') {
        notLeadAppsheetIds.add(parts[0]);
        const np = normalizePhone(parts[4]);
        if (np) notLeadPhones.add(np);
      }
    }
  }
  console.log(`From LEADS(trang_thai=1): ${notLeadAppsheetIds.size} ids, ${notLeadPhones.size} phones`);

  // 2. Collect from DUYET_NOTLEAD where trangthai_duyet = 'Đã duyệt'
  const mDuyet = content.match(/INSERT INTO `DUYET_NOTLEAD` [^;]+;/gs);
  let duyetCount = 0;
  for (const b of mDuyet) {
    const tuples = parseTuples(b);
    for (const t of tuples) {
      const parts = splitTuple(t);
      // Col 1: lead_id, Col 3: phone, Col 6: trangthai_duyet
      if (parts[6] === 'Đã duyệt') {
        duyetCount++;
        if (parts[1]) notLeadAppsheetIds.add(parts[1]);
        const np = normalizePhone(parts[3]);
        if (np) notLeadPhones.add(np);
      }
    }
  }
  console.log(`From DUYET_NOTLEAD: ${duyetCount} approved rows.`);
  console.log(`Total union of Not Lead: ${notLeadAppsheetIds.size} AppSheet IDs, ${notLeadPhones.size} phones.`);

  // 3. Test matching in our live database
  console.log('Querying matching leads and contacts in CRM database...');
  // Check how many leads have raw_payload matching appsheet_id
  const appsheetIdList = Array.from(notLeadAppsheetIds);
  const phoneList = Array.from(notLeadPhones);

  // Match leads by phone
  let matchedLeadsByPhone = 0;
  for (let i = 0; i < phoneList.length; i += 300) {
    const batch = phoneList.slice(i, i + 300);
    const inSql = batch.map(p => `'${p}'`).join(',');
    const res = await query(`SELECT COUNT(*) as cnt FROM leads WHERE phone IN (${inSql}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inSql})`);
    matchedLeadsByPhone += parseInt(res.data?.[0]?.cnt || 0);
  }

  // Match persons by phone
  let matchedPersonsByPhone = 0;
  for (let i = 0; i < phoneList.length; i += 300) {
    const batch = phoneList.slice(i, i + 300);
    const inSql = batch.map(p => `'${p}'`).join(',');
    const res = await query(`SELECT COUNT(*) as cnt FROM persons WHERE phone IN (${inSql}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inSql})`);
    matchedPersonsByPhone += parseInt(res.data?.[0]?.cnt || 0);
  }

  console.log(`Matched leads in CRM: ${matchedLeadsByPhone}`);
  console.log(`Matched persons in CRM: ${matchedPersonsByPhone}`);
}

prepareNotLeads();
