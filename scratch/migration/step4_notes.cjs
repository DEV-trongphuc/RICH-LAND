const https = require('https');
const querystring = require('querystring');
const fs = require('fs');

function query(sql) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      key: 'richland2026',
      sql: sql
    });

    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          resolve({ error: e.message, raw: d.slice(0, 300) });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function normalizePhone(p) {
  if (!p) return '';
  let clean = String(p).replace(/[^0-9]/g, '');
  if (clean.startsWith('84') && clean.length > 9) {
    clean = '0' + clean.slice(2);
  }
  return clean;
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

async function main() {
  console.log("==================================================================");
  console.log("📝 BƯỚC 4: ĐỒNG BỘ LỊCH SỬ CHĂM SÓC (LS_CSKH & BANG_PHU -> NOTES: 37.984 DÒNG)");
  console.log("==================================================================");

  // 1. Kiểm tra an toàn Kill-Switch
  console.log("\n1. 🔒 Kiểm tra trạng thái Kill-Switch & Hàng đợi thông báo...");
  const settingsRes = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('migration_in_progress', 'telegram_notifications_enabled');");
  const settings = {};
  (settingsRes.data || []).forEach(r => settings[r.setting_key] = r.setting_value);
  if (settings.migration_in_progress !== '1' || settings.telegram_notifications_enabled !== '0') {
    console.error("❌ CẢNH BÁO: Kill-Switch chưa kích hoạt! Hủy bỏ để bảo đảm an toàn.");
    process.exit(1);
  }
  console.log("  ✅ Kill-Switch đang bảo vệ hệ thống tuyệt đối (migration_in_progress=1, telegram_enabled=0).");

  // 2. Nạp các bảng tra cứu mapping
  console.log("\n2. Đang nạp các bảng tra cứu mapping...");
  const staffMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\staff_map.json', 'utf8'));
  const leadMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', 'utf8'));
  const contactMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\contact_map.json', 'utf8'));

  // Nạp toàn bộ danh bạ contacts hiện tại để xây dựng ma trận lookup đa tầng
  const contactsRes = await query("SELECT id, legacy_khtn_id, lead_id, person_id, phone FROM contacts;");
  const liveContacts = contactsRes.data || [];
  console.log(`  Live DB hiện có ${liveContacts.length} contacts.`);

  const byLegacyKhtnId = new Map();
  const byLeadId = new Map();
  const byPersonId = new Map();
  const byPhone = new Map();

  liveContacts.forEach(c => {
    if (c.legacy_khtn_id) byLegacyKhtnId.set(c.legacy_khtn_id, c.id);
    if (c.lead_id) byLeadId.set(String(c.lead_id), c.id);
    if (c.person_id) byPersonId.set(String(c.person_id), c.id);
    const clean = normalizePhone(c.phone);
    if (clean) byPhone.set(clean, c.id);
  });

  // 3. Đọc dữ liệu từ AppsheetRLVN.sql
  console.log("\n3. Đang đọc và bóc tách dữ liệu LS_CSKH và LS_CSKH_bangphu...");
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

  function parseTableNotes(tableName) {
    const startRegex = new RegExp(`INSERT\\s+INTO\\s+\`${tableName}\``, 'gi');
    let match;
    const startIndices = [];
    while ((match = startRegex.exec(content)) !== null) {
      startIndices.push(match.index);
    }
    const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
    const records = [];

    trueStatements.forEach(stmt => {
      const tuples = parseSqlTuples(stmt);
      tuples.forEach(t => {
        const p = splitTupleValues(t);
        if (p[0] === '`id`' || p[0] === 'id') return;

        records.push({
          id: p[0],
          khtnId: p[1],
          trangThai: p[2],
          ngayChamSoc: p[3] || new Date().toISOString().slice(0, 19).replace('T', ' '),
          noiDung: p[4] || '',
          nguoiTao: p[5] || 'UNASSIGNED',
          parentId: p[6],
          leadId: p[7],
          campaign: p[8],
          phanHoiKh: p[9] || '',
          trangThaiKh: p[10] || ''
        });
      });
    });

    console.log(`  Bảng ${tableName}: đã trích xuất ${records.length} bản ghi.`);
    return records;
  }

  const notesMain = parseTableNotes('LS_CSKH');
  const notesSub = parseTableNotes('LS_CSKH_bangphu');
  const allNotes = [...notesMain, ...notesSub];
  console.log(`  Tổng số ghi chú tương tác cần nạp: ${allNotes.length} dòng.`);

  // 4. Kiểm tra các leads phát sinh chưa có contact
  console.log("\n4. Kiểm tra và tự động khởi tạo contact cho các leads có ghi chú CSKH...");
  const missingLeadIds = new Set();
  allNotes.forEach(n => {
    let cId = null;
    if (n.khtnId && byLegacyKhtnId.has(n.khtnId)) cId = byLegacyKhtnId.get(n.khtnId);
    else if (n.parentId && byLegacyKhtnId.has(n.parentId)) cId = byLegacyKhtnId.get(n.parentId);
    else if (n.leadId && leadMap[n.leadId]) {
      const lInfo = leadMap[n.leadId];
      if (lInfo.crm_lead_id && byLeadId.has(String(lInfo.crm_lead_id))) cId = byLeadId.get(String(lInfo.crm_lead_id));
      else if (lInfo.person_id && byPersonId.has(String(lInfo.person_id))) cId = byPersonId.get(String(lInfo.person_id));
    }
    if (!cId && n.leadId && leadMap[n.leadId]) {
      missingLeadIds.add(n.leadId);
    }
  });

  if (missingLeadIds.size > 0) {
    console.log(`  Tìm thấy ${missingLeadIds.size} leads có ghi chú CSKH nhưng chưa có contact. Đang tự động khởi tạo contact...`);
    const crmLeadIds = Array.from(missingLeadIds).map(lId => leadMap[lId].crm_lead_id).filter(Boolean);

    // Truy vấn thông tin chi tiết của các leads này từ DB
    const leadBatches = [];
    const lBatchSize = 400;
    for (let i = 0; i < crmLeadIds.length; i += lBatchSize) {
      leadBatches.push(crmLeadIds.slice(i, i + lBatchSize));
    }

    const fetchedLeads = [];
    for (const b of leadBatches) {
      const lRes = await query(`SELECT id, person_id, name, phone, email, project_id, source, created_at FROM leads WHERE id IN (${b.join(',')});`);
      if (lRes.data) fetchedLeads.push(...lRes.data);
    }
    console.log(`  Đã truy vấn được thông tin ${fetchedLeads.length} leads từ CSDL.`);

    // Batch insert vào contacts
    const cBatchSize = 250;
    for (let i = 0; i < fetchedLeads.length; i += cBatchSize) {
      const batch = fetchedLeads.slice(i, i + cBatchSize);
      const valStrings = batch.map(l => {
        const cleanName = (l.name || 'Khách hàng').trim();
        const parts = cleanName.split(/\s+/);
        const lName = parts.length > 1 ? parts.pop() : '';
        const fName = parts.join(' ') || cleanName;
        return `(
          1,
          ${l.person_id ? l.person_id : 'NULL'},
          ${l.id},
          ${l.project_id ? l.project_id : 1},
          1003,
          1003,
          ${escapeSql(fName)},
          ${escapeSql(lName)},
          ${escapeSql(l.phone)},
          'chua_xac_dinh',
          1,
          'lead',
          ${escapeSql(l.source || 'FbAds')},
          ${escapeSql(l.created_at)},
          ${escapeSql(l.created_at)}
        )`;
      });

      const sql = `
        INSERT INTO contacts (
          tenant_id,
          person_id,
          lead_id,
          project_id,
          owner_id,
          created_by,
          first_name,
          last_name,
          phone,
          pipeline_status,
          stage_id,
          status,
          source,
          created_at,
          updated_at
        ) VALUES ${valStrings.join(', ')}
        ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);
      `;

      await query(sql);
    }

    // Refresh contact lookup
    const refRes = await query("SELECT id, legacy_khtn_id, lead_id, person_id, phone FROM contacts;");
    (refRes.data || []).forEach(c => {
      if (c.legacy_khtn_id) byLegacyKhtnId.set(c.legacy_khtn_id, c.id);
      if (c.lead_id) byLeadId.set(String(c.lead_id), c.id);
      if (c.person_id) byPersonId.set(String(c.person_id), c.id);
      const clean = normalizePhone(c.phone);
      if (clean) byPhone.set(clean, c.id);
    });
    console.log(`  Đã làm mới ma trận lookup: hiện có ${byLeadId.size} contacts gắn liền với lead.`);
  }

  // 5. Chuẩn bị danh sách NOTES để nạp
  console.log("\n5. Đang chuẩn bị chuyển đổi dữ liệu tương tác sang bảng NOTES...");
  const notesToInsert = [];
  let unlinkedCount = 0;

  for (const n of allNotes) {
    let contactId = null;
    if (n.khtnId && byLegacyKhtnId.has(n.khtnId)) {
      contactId = byLegacyKhtnId.get(n.khtnId);
    } else if (n.parentId && byLegacyKhtnId.has(n.parentId)) {
      contactId = byLegacyKhtnId.get(n.parentId);
    } else if (n.leadId && leadMap[n.leadId]) {
      const lInfo = leadMap[n.leadId];
      if (lInfo.crm_lead_id && byLeadId.has(String(lInfo.crm_lead_id))) {
        contactId = byLeadId.get(String(lInfo.crm_lead_id));
      } else if (lInfo.person_id && byPersonId.has(String(lInfo.person_id))) {
        contactId = byPersonId.get(String(lInfo.person_id));
      } else if (lInfo.phone && byPhone.has(normalizePhone(lInfo.phone))) {
        contactId = byPhone.get(normalizePhone(lInfo.phone));
      }
    }

    if (!contactId) {
      unlinkedCount++;
      // Gán vào contact fallback hoặc bỏ qua nếu hoàn toàn không xác định được danh tính
      continue;
    }

    const userId = staffMap[n.nguoiTao] ? String(staffMap[n.nguoiTao]) : '1003';
    const bodyText = (n.noiDung && n.noiDung.trim()) ? n.noiDung.trim() : (n.phanHoiKh ? n.phanHoiKh.trim() : 'Lịch sử chăm sóc');

    notesToInsert.push({
      legacy_cskh_id: n.id,
      tenant_id: 1,
      user_id: userId,
      entity_type: 'contact',
      entity_id: contactId,
      body: bodyText,
      type: 'internal',
      client_feedback: n.phanHoiKh || null,
      sale_temperature: n.trangThaiKh || null,
      is_heritage: 1,
      created_at: n.ngayChamSoc,
      updated_at: n.ngayChamSoc
    });
  }

  console.log(`  Chuẩn bị thành công: ${notesToInsert.length}/${allNotes.length} notes (Tỷ lệ khớp: ${(notesToInsert.length * 100 / allNotes.length).toFixed(2)}%).`);
  if (unlinkedCount > 0) {
    console.log(`  Số ghi chú không liên kết được danh tính: ${unlinkedCount}.`);
  }

  // 6. Nạp vào NOTES theo từng mẻ 300
  console.log(`\n6. Bắt đầu nạp ${notesToInsert.length} bản ghi vào bảng NOTES...`);
  const batchSize = 300;
  let insertedCount = 0;

  for (let i = 0; i < notesToInsert.length; i += batchSize) {
    const batch = notesToInsert.slice(i, i + batchSize);
    const valStrings = batch.map(note => {
      return `(
        ${escapeSql(note.legacy_cskh_id)},
        ${note.tenant_id},
        ${note.user_id},
        ${escapeSql(note.entity_type)},
        ${note.entity_id},
        ${escapeSql(note.body)},
        ${escapeSql(note.type)},
        ${escapeSql(note.client_feedback)},
        ${escapeSql(note.sale_temperature)},
        ${note.is_heritage},
        ${escapeSql(note.created_at)},
        ${escapeSql(note.updated_at)}
      )`;
    });

    const sql = `
      INSERT INTO notes (
        legacy_cskh_id,
        tenant_id,
        user_id,
        entity_type,
        entity_id,
        body,
        type,
        client_feedback,
        sale_temperature,
        is_heritage,
        created_at,
        updated_at
      ) VALUES ${valStrings.join(', ')}
      ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);
    `;

    const res = await query(sql);
    if (res.error) {
      console.error(`  ❌ Lỗi nạp notes mẻ ${i} - ${i + batch.length}:`, res.error);
    } else {
      insertedCount += batch.length;
      if (insertedCount % 1500 === 0 || insertedCount === notesToInsert.length) {
        console.log(`  Đã nạp ${insertedCount}/${notesToInsert.length} notes...`);
      }
    }
  }

  console.log(`\n✅ Đã nạp thành công ${insertedCount} bản ghi vào bảng NOTES!`);

  // 7. Kiểm tra an toàn: Hàng đợi thông báo
  console.log("\n7. 🔍 Kiểm tra an toàn: Đối soát các bảng hàng đợi thông báo:");
  const queues = await query("SELECT (SELECT COUNT(*) FROM telegram_queue) as t_count, (SELECT COUNT(*) FROM zalo_queue) as z_count, (SELECT COUNT(*) FROM mail_queue) as m_count;");
  const qData = (queues.data && queues.data[0]) || {};
  console.log(`  - telegram_queue: ${qData.t_count} (${qData.t_count === '1073' ? 'Được bảo toàn tuyệt đối, không tăng thêm' : 'CẢNH BÁO TĂNG'})`);
  console.log(`  - zalo_queue: ${qData.z_count} (${qData.z_count === '148' ? 'Được bảo toàn tuyệt đối, không tăng thêm' : 'CẢNH BÁO TĂNG'})`);
  console.log(`  - mail_queue: ${qData.m_count} (${qData.m_count === '525' ? 'Được bảo toàn tuyệt đối, không tăng thêm' : 'CẢNH BÁO TĂNG'})`);

  console.log("\n🎉 HOÀN TẤT BƯỚC 4!");
}

main().catch(err => {
  console.error("Lỗi thực thi Bước 4:", err);
  process.exit(1);
});
