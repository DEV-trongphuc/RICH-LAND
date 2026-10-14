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

async function migrateNotLeads() {
  console.log('1. Đang nạp AppsheetRLVN.sql để trích xuất danh sách Not Lead đã duyệt...');
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
  const notLeadPhones = new Set();
  const duyetReports = [];

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
        duyetReports.push({
          lead_id_str: parts[1],
          phone: np,
          reason: parts[5] || 'Not Lead',
          created_at: parts[8] || new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
      }
    }
  }

  console.log(`  Tìm thấy ${notLeadPhones.size} số điện thoại Not Lead.`);

  console.log('2. Đang tìm person_id tương ứng trong CSDL CRM...');
  const phoneList = Array.from(notLeadPhones);
  let matchedPersons = [];
  for (let i = 0; i < phoneList.length; i += 300) {
    const batch = phoneList.slice(i, i + 300);
    const inSql = batch.map(p => `'${p}'`).join(',');
    const res = await query(`SELECT id, phone FROM persons WHERE phone IN (${inSql}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inSql})`);
    if (res.data) matchedPersons.push(...res.data);
  }

  const personIds = Array.from(new Set(matchedPersons.map(p => p.id)));
  console.log(`  Khớp được ${personIds.length} persons.`);

  console.log('3. Đang cập nhật trạng thái Not Lead cho leads, contacts và distribution_logs...');
  let updatedLeads = 0;
  let updatedContacts = 0;
  let updatedLogs = 0;

  for (let i = 0; i < personIds.length; i += 200) {
    const batch = personIds.slice(i, i + 200);
    const inSql = batch.join(',');

    // 1. Update leads (do not overwrite won deals or booking)
    const lRes = await query(`
      UPDATE leads 
      SET status = 'not_lead' 
      WHERE person_id IN (${inSql})
        AND status NOT IN ('won', 'dong_deal')
    `);
    updatedLeads += lRes.affected_rows || 0;

    // 2. Update contacts (do not overwrite booking or dat_coc)
    const cRes = await query(`
      UPDATE contacts 
      SET pipeline_status = 'not_lead', not_lead_proposed = 1
      WHERE person_id IN (${inSql})
        AND pipeline_status NOT IN ('booking', 'dat_coc', 'dong_deal')
    `);
    updatedContacts += cRes.affected_rows || 0;

    // 3. Update distribution_logs
    const dlRes = await query(`
      UPDATE distribution_logs dl
      JOIN leads l ON dl.lead_id = l.id
      SET dl.status = 'not_lead'
      WHERE l.person_id IN (${inSql})
        AND dl.status != 'won'
    `);
    updatedLogs += dlRes.affected_rows || 0;
  }

  console.log(`  ✅ Đã cập nhật leads: ${updatedLeads} dòng.`);
  console.log(`  ✅ Đã cập nhật contacts: ${updatedContacts} dòng.`);
  console.log(`  ✅ Đã cập nhật distribution_logs: ${updatedLogs} dòng.`);

  // 4. Đồng bộ vào data_reports
  console.log('4. Đang nạp các bản ghi duyệt Not Lead vào data_reports để lưu vết lịch sử...');
  // Find leads for these reports
  let insertedReports = 0;
  for (let i = 0; i < duyetReports.length; i += 100) {
    const batch = duyetReports.slice(i, i + 100);
    const phones = batch.map(b => b.phone).filter(Boolean);
    if (phones.length === 0) continue;

    const inPhones = phones.map(p => `'${p}'`).join(',');
    const leadMapRes = await query(`SELECT id, phone FROM leads WHERE phone IN (${inPhones}) OR CONCAT('84', SUBSTRING(phone, 2)) IN (${inPhones})`);
    const leadMap = {};
    if (leadMapRes.data) {
      leadMapRes.data.forEach(l => {
        const np = normalizePhone(l.phone);
        if (np && !leadMap[np]) leadMap[np] = l.id;
      });
    }

    const reportValues = [];
    for (const item of batch) {
      const leadId = leadMap[item.phone];
      if (leadId) {
        const safeReason = (item.reason || 'Not Lead (AppSheet)').replace(/'/g, "\\'");
        const safeDate = item.created_at || '2026-01-01 00:00:00';
        reportValues.push(`(${leadId}, 'Not Lead (AppSheet)', 'approved', '${safeDate}', '${safeDate}', 'AppSheet Import', '${safeReason}')`);
      }
    }

    if (reportValues.length > 0) {
      const insRes = await query(`
        INSERT IGNORE INTO data_reports (lead_id, reason, status, created_at, resolved_at, resolved_by, approval_reason)
        VALUES ${reportValues.join(',')}
      `);
      insertedReports += insRes.affected_rows || 0;
    }
  }
  console.log(`  ✅ Đã nạp ${insertedReports} báo cáo Not Lead đã duyệt vào data_reports.`);
}

migrateNotLeads().then(() => console.log('HOÀN TẤT.')).catch(e => console.error(e));
