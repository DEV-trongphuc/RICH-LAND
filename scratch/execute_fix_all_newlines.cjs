const fs = require('fs');
const { query } = require('./query.cjs');

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

function parseTtl1(text) {
  if (!text) return null;
  const isForm = /FORM phản hồi/i.test(text) || /NGHIÊN CỨU KHÁCH HÀNG/i.test(text);
  if (!isForm) return null;

  const getMatch = (patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };

  const oDau = getMatch([/ở đâu\s*:\s*([^\n\r]+)/i, /nơi ở\s*:\s*([^\n\r]+)/i]);
  const lamGi = getMatch([/làm gì\s*:\s*([^\n\r]+)/i, /nghề nghiệp\s*:\s*([^\n\r]+)/i, /công việc\s*:\s*([^\n\r]+)/i]);
  const giaDinh = getMatch([/gia đình\s*:\s*([^\n\r]+)/i, /độ tuổi\s*:\s*([^\n\r]+)/i, /tình trạng hôn nhân\s*:\s*([^\n\r]+)/i]);
  const hienTrang = getMatch([/a\.\s*hiện trạng\s*:\s*([\s\S]*?)(?=(?:b\.|nhu cầu|mục đích|rào cản|giải pháp|$))/i, /hiện trạng\s*:\s*([\s\S]*?)(?=(?:b\.|nhu cầu|mục đích|rào cản|giải pháp|$))/i]);
  const nhuCau = getMatch([/b\.\s*nhu cầu(?:\s*mua)?\s*:\s*([\s\S]*?)(?=(?:c\.|rào cản|tài chính|giải pháp|$))/i, /nhu cầu(?:\s*mua)?\s*:\s*([\s\S]*?)(?=(?:c\.|rào cản|tài chính|giải pháp|$))/i, /mục đích\s*:\s*([^\n\r]+)/i]);
  const raoCan = getMatch([/c\.\s*rào cản\s*:\s*([\s\S]*?)(?=(?:d\.|giải pháp|tài chính|3\.|$))/i, /rào cản\s*:\s*([\s\S]*?)(?=(?:d\.|giải pháp|tài chính|3\.|$))/i]);
  const giaiPhap = getMatch([/giải pháp\s*:\s*([\s\S]*?)(?=$)/i]);
  const nganSach = getMatch([/tài chính\s*:\s*([^\n\r]+)/i, /ngân sách\s*:\s*([^\n\r]+)/i]);

  const cleanField = (s) => {
    if (!s) return '';
    return s.replace(/^[\s\r\n\-•:]+/, '').trim();
  };

  return {
    group1: false,
    group2: false,
    group3: false,
    group4: false,
    group5: false,
    o_dau: cleanField(oDau),
    lam_gi: cleanField(lamGi),
    gia_dinh: cleanField(giaDinh),
    hien_trang: cleanField(hienTrang),
    nhu_cau: cleanField(nhuCau),
    rao_can: cleanField(raoCan),
    thong_tin_bo_sung: text.length > 500 ? text.slice(0, 500) + '...' : text,
    giai_phap: cleanField(giaiPhap),
    ngan_sach: cleanField(nganSach)
  };
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

async function main() {
  console.log('1. Reading AppSheet dump for KHTN data...');
  const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

  let pos = 0;
  const khtnUpdates = []; // { legacy_khtn_id, ttl1_data, notes }
  let totalKhtn = 0;

  while ((pos = sqlDump.indexOf('INSERT INTO `KHTN`', pos)) !== -1) {
    const fullStmt = extractFullStatement(sqlDump, pos);
    pos += fullStmt.length;
    const tuples = parseSqlTuples(fullStmt);

    for (const t of tuples) {
      const v = splitTupleValues(t);
      totalKhtn++;
      const id = v[0];
      const chanDung = v[6];
      const thongTinOrigin = v[29];
      const imageDongygap = v[10];
      const imageDagap = v[11];
      const imageUnc = v[12];

      const cleanChanDung = chanDung ? chanDung.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '').trim() : '';
      const cleanOrigin = thongTinOrigin ? thongTinOrigin.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '').trim() : '';

      const ttl1Obj = parseTtl1(cleanChanDung);
      const ttl1DataStr = ttl1Obj ? JSON.stringify(ttl1Obj) : null;

      const notePieces = [];
      if (cleanOrigin) notePieces.push(cleanOrigin);
      if (imageDongygap && imageDongygap.trim()) notePieces.push(`[Ảnh Đồng ý gặp]: ${imageDongygap.trim()}`);
      if (imageDagap && imageDagap.trim()) notePieces.push(`[Ảnh Đã gặp]: ${imageDagap.trim()}`);
      if (imageUnc && imageUnc.trim()) notePieces.push(`[Ảnh UNC]: ${imageUnc.trim()}`);
      if (!ttl1Obj && cleanChanDung) notePieces.push(cleanChanDung);

      const finalNotes = notePieces.join('\n\n') || null;

      if (ttl1DataStr !== null || finalNotes !== null) {
        khtnUpdates.push({
          legacy_khtn_id: id,
          ttl1_data: ttl1DataStr,
          notes: finalNotes
        });
      }
    }
  }

  console.log(`Found ${totalKhtn} total KHTN rows. ${khtnUpdates.length} rows have notes/TTL1.`);

  // Update in batches of 100
  console.log('\n2. Updating contacts in MySQL with clean TTL1 and notes...');
  const batchSize = 100;
  let updatedCount = 0;

  for (let i = 0; i < khtnUpdates.length; i += batchSize) {
    const batch = khtnUpdates.slice(i, i + batchSize);
    // Build CASE statement for batch update
    const ids = batch.map(b => escapeSql(b.legacy_khtn_id)).join(',');
    const ttl1Cases = batch.map(b => `WHEN legacy_khtn_id = ${escapeSql(b.legacy_khtn_id)} THEN ${escapeSql(b.ttl1_data)}`).join(' ');
    const notesCases = batch.map(b => `WHEN legacy_khtn_id = ${escapeSql(b.legacy_khtn_id)} THEN ${escapeSql(b.notes)}`).join(' ');

    const sql = `
      UPDATE contacts 
      SET 
        ttl1_data = CASE ${ttl1Cases} ELSE ttl1_data END,
        notes = CASE ${notesCases} ELSE notes END
      WHERE legacy_khtn_id IN (${ids});
    `;

    const res = await query(sql);
    if (res.error) {
      console.error(`Batch ${i} failed:`, res.error);
    } else {
      updatedCount += batch.length;
      process.stdout.write(`\rUpdated ${updatedCount} / ${khtnUpdates.length} contacts...`);
    }
  }
  console.log('\nFinished updating contacts.');

  // Clean remaining notes in `notes` table
  console.log('\n3. Cleaning literal \\n in interaction notes table...');
  const fixNotesBody = await query("UPDATE notes SET body = REPLACE(body, '\\\\n', CHAR(10)) WHERE body LIKE '%\\\\n%';");
  console.log('Fixed notes.body:', fixNotesBody);

  const fixNotesFeedback = await query("UPDATE notes SET client_feedback = REPLACE(client_feedback, '\\\\n', CHAR(10)) WHERE client_feedback LIKE '%\\\\n%';");
  console.log('Fixed notes.client_feedback:', fixNotesFeedback);

  // Verification on contact 10830
  console.log('\n4. Verification on contact 10830:');
  const check10830 = await query("SELECT id, legacy_khtn_id, notes, ttl1_data FROM contacts WHERE id = 10830;");
  const c = check10830.data[0];
  console.log('Contact 10830 notes:');
  console.log(c.notes);
  console.log('\nContact 10830 ttl1 parsed:');
  console.log(JSON.parse(c.ttl1_data));
}

main().catch(console.error);
