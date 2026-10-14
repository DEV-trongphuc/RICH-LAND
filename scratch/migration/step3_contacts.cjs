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

function splitName(fullName) {
  if (!fullName) return { firstName: 'Khách hàng', lastName: '' };
  const clean = fullName.trim().replace(/^[\d\.\s\-\_]+/, '').trim() || fullName.trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const lastName = parts.pop();
  const firstName = parts.join(' ');
  return { firstName, lastName };
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
  const hienTrang = getMatch([/hiện trạng\s*:\s*([\s\S]*?)(?=(?:b\.|nhu cầu|mục đích|rào cản|giải pháp|$))/i]);
  const nhuCau = getMatch([/nhu cầu(?:\s*mua)?\s*:\s*([\s\S]*?)(?=(?:rào cản|tài chính|giải pháp|$))/i, /mục đích\s*:\s*([^\n\r]+)/i]);
  const raoCan = getMatch([/rào cản\s*:\s*([\s\S]*?)(?=(?:giải pháp|tài chính|c\.|3\.|$))/i]);
  const giaiPhap = getMatch([/giải pháp\s*:\s*([\s\S]*?)(?=$)/i]);
  const nganSach = getMatch([/tài chính\s*:\s*([^\n\r]+)/i, /ngân sách\s*:\s*([^\n\r]+)/i]);

  return {
    group1: false,
    group2: false,
    group3: false,
    group4: false,
    group5: false,
    o_dau: oDau,
    lam_gi: lamGi,
    gia_dinh: giaDinh,
    hien_trang: hienTrang,
    nhu_cau: nhuCau,
    rao_can: raoCan,
    thong_tin_bo_sung: text.length > 500 ? text.slice(0, 500) + '...' : text,
    giai_phap: giaiPhap,
    ngan_sach: nganSach
  };
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
  console.log("📋 BƯỚC 3: ĐỒNG BỘ KHÁCH HÀNG TIỀM NĂNG (KHTN -> CONTACTS: 7.875 DÒNG)");
  console.log("==================================================================");

  // 1. Kiểm tra an toàn Kill-Switch
  console.log("\n1. 🔒 Kiểm tra trạng thái Kill-Switch & Hàng đợi thông báo...");
  const settingsRes = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('migration_in_progress', 'telegram_notifications_enabled');");
  const settings = {};
  (settingsRes.data || []).forEach(r => settings[r.setting_key] = r.setting_value);
  if (settings.migration_in_progress !== '1' || settings.telegram_notifications_enabled !== '0') {
    console.error("❌ CẢNH BÁO: Kill-Switch chưa kích hoạt! Hủy bỏ để bảo đảm không rò rỉ thông báo.");
    process.exit(1);
  }
  console.log("  ✅ Kill-Switch đang bảo vệ hệ thống tuyệt đối (migration_in_progress=1, telegram_enabled=0).");

  // 2. Nạp các bảng tra cứu
  console.log("\n2. Đang nạp các bảng tra cứu mapping...");
  const projectMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\project_map.json', 'utf8'));
  const staffMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\staff_map.json', 'utf8'));
  const leadMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', 'utf8'));

  const personsRes = await query("SELECT id, phone FROM persons;");
  const phoneToPersonMap = new Map();
  (personsRes.data || []).forEach(p => {
    const clean = normalizePhone(p.phone);
    if (clean) phoneToPersonMap.set(clean, p.id);
  });
  console.log(`  Đã nạp ${phoneToPersonMap.size} persons từ CSDL.`);

  // 3. Phân tích KHTN từ AppsheetRLVN.sql
  console.log("\n3. Đang đọc và bóc tách bảng KHTN từ AppsheetRLVN.sql...");
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

  const startRegex = /INSERT\s+INTO\s+`KHTN`/gi;
  let match;
  const startIndices = [];
  while ((match = startRegex.exec(content)) !== null) {
    startIndices.push(match.index);
  }
  console.log(`  Tìm thấy ${startIndices.length} khối INSERT INTO KHTN.`);

  const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
  const rawKhtn = [];
  const missingPersonPhones = new Map();

  trueStatements.forEach(stmt => {
    const tuples = parseSqlTuples(stmt);
    tuples.forEach(t => {
      const p = splitTupleValues(t);
      if (p[0] === '`id`' || p[0] === 'id') return;

      const id = p[0];
      const leadId = p[1];
      const teamId = p[2];
      const ngayTao = p[3] || new Date().toISOString().slice(0, 19).replace('T', ' ');
      const fullName = p[4] || 'Khách hàng';
      const phone = p[5] || '';
      const cleanPhone = normalizePhone(phone);
      const chanDung = p[6] || '';
      const phanLoaiLead = p[7] || '';
      const duAn = p[8] || '';
      const trangThai = p[9] || '2';
      const phoneMore = p[11] || '';
      const nameReal = p[12] || '';
      const imageDongygap = p[19] || '';
      const imageDagap = p[20] || '';
      const imageUnc = p[21] || '';
      const nguoiNhan = p[23] || 'UNASSIGNED';
      const loaiLead = p[24] || '';
      const thongTinOrigin = p[29] || '';
      const linkFb = p[30] || '';
      const campaign = p[34] || '';

      // Check person_id
      let personId = null;
      if (leadId && leadMap[leadId] && leadMap[leadId].person_id) {
        personId = leadMap[leadId].person_id;
      } else if (cleanPhone && phoneToPersonMap.has(cleanPhone)) {
        personId = phoneToPersonMap.get(cleanPhone);
      } else if (cleanPhone) {
        missingPersonPhones.set(cleanPhone, fullName);
      }

      rawKhtn.push({
        id,
        leadId,
        teamId,
        ngayTao,
        fullName: nameReal && nameReal.length > 2 ? nameReal : fullName,
        phone,
        cleanPhone,
        chanDung,
        phanLoaiLead,
        duAn,
        trangThai,
        phoneMore,
        imageDongygap,
        imageDagap,
        imageUnc,
        nguoiNhan,
        loaiLead,
        thongTinOrigin,
        linkFb,
        campaign,
        personId
      });
    });
  });

  console.log(`  Đã trích xuất hoàn hảo: ${rawKhtn.length} khách hàng tiềm năng.`);

  // 4. Bổ sung các Person chưa có từ KHTN
  if (missingPersonPhones.size > 0) {
    console.log(`\n4. Đang bổ sung ${missingPersonPhones.size} persons phát sinh từ KHTN vào bảng PERSONS...`);
    const newPersons = Array.from(missingPersonPhones.entries()).map(([phone, name]) => ({
      phone,
      name,
      email: ''
    }));

    const batchSize = 300;
    for (let i = 0; i < newPersons.length; i += batchSize) {
      const batch = newPersons.slice(i, i + batchSize);
      const valStrings = batch.map(p => {
        return `(${escapeSql(p.phone)}, ${escapeSql(p.name)}, 0, NOW())`;
      });
      const sql = `INSERT INTO persons (phone, full_name, is_public, created_at) VALUES ${valStrings.join(', ')} ON DUPLICATE KEY UPDATE id=id;`;
      const res = await query(sql);
      if (res.error) {
        console.error(`  Lỗi bổ sung persons mẻ ${i}:`, res.error);
      }
    }

    // Refresh phoneToPersonMap
    const refRes = await query("SELECT id, phone FROM persons;");
    (refRes.data || []).forEach(p => {
      const clean = normalizePhone(p.phone);
      if (clean) phoneToPersonMap.set(clean, p.id);
    });
    console.log(`  Bảng persons hiện có ${phoneToPersonMap.size} số điện thoại.`);

    // Gán lại personId cho các bản ghi còn thiếu
    rawKhtn.forEach(r => {
      if (!r.personId && r.cleanPhone && phoneToPersonMap.has(r.cleanPhone)) {
        r.personId = phoneToPersonMap.get(r.cleanPhone);
      }
    });
  }

  // 5. Chuẩn bị dữ liệu CONTACTS
  console.log("\n5. Đang chuẩn bị chuyển đổi dữ liệu KHTN sang CONTACTS...");
  
  // Mapping trạng thái
  // 1: Not Lead, 2: Chưa Xác Định, 3: Chăm Sóc Dài Hạn, 4: Quan Tâm, 5: Thiện Chí, 6: Đã Gặp, 7: Booking, 8: Đặt Cọc
  const statusMap = {
    '1': { status: 'churned', pipeline: 'not_lead', stage: 'NULL', not_lead: 1 },
    '2': { status: 'lead', pipeline: 'chua_xac_dinh', stage: '1', not_lead: 0 },
    '3': { status: 'lead', pipeline: 'cham_soc_dai_han', stage: '31', not_lead: 0 },
    '4': { status: 'qualified', pipeline: 'quan_tam', stage: '2', not_lead: 0 },
    '5': { status: 'qualified', pipeline: 'dong_y_gap', stage: '3', not_lead: 0 },
    '6': { status: 'customer', pipeline: 'da_gap', stage: '4', not_lead: 0 },
    '7': { status: 'customer', pipeline: 'booking', stage: '5', not_lead: 0 },
    '8': { status: 'customer', pipeline: 'dat_coc', stage: '6', not_lead: 0 }
  };

  const contactsToInsert = [];

  for (const r of rawKhtn) {
    const sInfo = statusMap[r.trangThai] || statusMap['2'];
    const names = splitName(r.fullName);
    
    // Project ID lookup
    let projId = '1';
    if (r.duAn) {
      if (projectMap[r.duAn]) {
        projId = projectMap[r.duAn];
      } else if (projectMap[r.duAn.toLowerCase()]) {
        projId = projectMap[r.duAn.toLowerCase()];
      }
    }

    // Owner ID lookup
    const ownerId = staffMap[r.nguoiNhan] ? String(staffMap[r.nguoiNhan]) : '1003';

    // Lead ID lookup
    const leadId = (r.leadId && leadMap[r.leadId]) ? leadMap[r.leadId].crm_lead_id : null;

    // TTL1 & Notes extraction
    const ttl1Obj = parseTtl1(r.chanDung);
    const ttl1Completed = ttl1Obj ? 1 : 0;
    const ttl1DataStr = ttl1Obj ? JSON.stringify(ttl1Obj) : null;

    // Compile notes
    const notePieces = [];
    if (r.thongTinOrigin && r.thongTinOrigin.trim()) {
      notePieces.push(r.thongTinOrigin.trim());
    }
    if (r.imageDongygap && r.imageDongygap.trim()) {
      notePieces.push(`[Ảnh Đồng ý gặp]: ${r.imageDongygap.trim()}`);
    }
    if (r.imageDagap && r.imageDagap.trim()) {
      notePieces.push(`[Ảnh Đã gặp]: ${r.imageDagap.trim()}`);
    }
    if (r.imageUnc && r.imageUnc.trim()) {
      notePieces.push(`[Ảnh UNC]: ${r.imageUnc.trim()}`);
    }
    if (!ttl1Obj && r.chanDung && r.chanDung.trim()) {
      notePieces.push(r.chanDung.trim());
    }
    const finalNotes = notePieces.join('\n\n') || null;

    contactsToInsert.push({
      legacy_khtn_id: r.id,
      tenant_id: 1,
      person_id: r.personId,
      lead_id: leadId,
      project_id: projId,
      owner_id: ownerId,
      created_by: ownerId,
      first_name: names.firstName,
      last_name: names.lastName,
      phone: r.phone,
      phone2: r.phoneMore || null,
      pipeline_status: sInfo.pipeline,
      stage_id: sInfo.stage,
      status: sInfo.status,
      not_lead_proposed: sInfo.not_lead,
      fb_link: r.linkFb || null,
      utm_campaign: r.campaign || null,
      loai_lead: r.loaiLead || null,
      lead_phan_loai: r.phanLoaiLead || null,
      ttl1_completed: ttl1Completed,
      ttl1_data: ttl1DataStr,
      notes: finalNotes,
      created_at: r.ngayTao,
      updated_at: r.ngayTao
    });
  }

  // 6. Nạp vào CONTACTS theo từng mẻ 200
  console.log(`\n6. Bắt đầu nạp ${contactsToInsert.length} bản ghi vào bảng CONTACTS...`);
  const batchSize = 200;
  let insertedCount = 0;

  for (let i = 0; i < contactsToInsert.length; i += batchSize) {
    const batch = contactsToInsert.slice(i, i + batchSize);
    const valStrings = batch.map(c => {
      return `(
        ${escapeSql(c.legacy_khtn_id)},
        ${c.tenant_id},
        ${c.person_id ? c.person_id : 'NULL'},
        ${c.lead_id ? c.lead_id : 'NULL'},
        ${c.project_id},
        ${c.owner_id},
        ${c.created_by},
        ${escapeSql(c.first_name)},
        ${escapeSql(c.last_name)},
        ${escapeSql(c.phone)},
        ${escapeSql(c.phone2)},
        ${escapeSql(c.pipeline_status)},
        ${c.stage_id},
        ${escapeSql(c.status)},
        ${c.not_lead_proposed},
        ${escapeSql(c.fb_link)},
        ${escapeSql(c.utm_campaign)},
        ${escapeSql(c.loai_lead)},
        ${escapeSql(c.lead_phan_loai)},
        ${c.ttl1_completed},
        ${escapeSql(c.ttl1_data)},
        ${escapeSql(c.notes)},
        ${escapeSql(c.created_at)},
        ${escapeSql(c.updated_at)}
      )`;
    });

    const sql = `
      INSERT INTO contacts (
        legacy_khtn_id,
        tenant_id,
        person_id,
        lead_id,
        project_id,
        owner_id,
        created_by,
        first_name,
        last_name,
        phone,
        phone2,
        pipeline_status,
        stage_id,
        status,
        not_lead_proposed,
        fb_link,
        utm_campaign,
        loai_lead,
        lead_phan_loai,
        ttl1_completed,
        ttl1_data,
        notes,
        created_at,
        updated_at
      ) VALUES ${valStrings.join(', ')}
      ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);
    `;

    const res = await query(sql);
    if (res.error) {
      console.error(`  ❌ Lỗi nạp contacts mẻ ${i} - ${i + batch.length}:`, res.error);
    } else {
      insertedCount += batch.length;
      process.stdout.write(`  Đã nạp ${insertedCount}/${contactsToInsert.length} contacts...`);
      if (insertedCount % 1000 === 0 || insertedCount === contactsToInsert.length) {
        console.log('');
      }
    }
  }

  console.log(`\n✅ Đã nạp thành công ${insertedCount} bản ghi vào bảng CONTACTS!`);

  // 7. Kiểm tra an toàn: Hàng đợi thông báo
  console.log("\n7. 🔍 Kiểm tra an toàn: Đối soát các bảng hàng đợi thông báo:");
  const queues = await query("SELECT (SELECT COUNT(*) FROM telegram_queue) as t_count, (SELECT COUNT(*) FROM zalo_queue) as z_count, (SELECT COUNT(*) FROM mail_queue) as m_count;");
  const qData = (queues.data && queues.data[0]) || {};
  console.log(`  - telegram_queue: ${qData.t_count} (${qData.t_count === '1073' ? 'Được bảo toàn tuyệt đối, không tăng thêm' : 'CẢNH BÁO TĂNG'})`);
  console.log(`  - zalo_queue: ${qData.z_count} (${qData.z_count === '148' ? 'Được bảo toàn tuyệt đối, không tăng thêm' : 'CẢNH BÁO TĂNG'})`);
  console.log(`  - mail_queue: ${qData.m_count} (${qData.m_count === '525' ? 'Được bảo toàn tuyệt đối, không tăng thêm' : 'CẢNH BÁO TĂNG'})`);

  // 8. Xuất contact_map.json cho Bước 4 (LS_CSKH notes)
  console.log("\n8. Đang trích xuất Contact Lookup Map từ database...");
  const contactMapRes = await query("SELECT id, legacy_khtn_id, person_id, phone FROM contacts WHERE legacy_khtn_id IS NOT NULL;");
  const contactMap = {};
  (contactMapRes.data || []).forEach(c => {
    contactMap[c.legacy_khtn_id] = {
      crm_contact_id: c.id,
      person_id: c.person_id,
      phone: c.phone
    };
  });
  console.log(`  Đã tạo Contact Lookup Map với ${Object.keys(contactMap).length} bản ghi.`);
  fs.writeFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\contact_map.json', JSON.stringify(contactMap, null, 2));
  console.log('💾 Đã lưu contact_map.json cho Bước 4.');

  console.log("\n🎉 HOÀN TẤT BƯỚC 3!");
}

main().catch(err => {
  console.error("Lỗi thực thi Bước 3:", err);
  process.exit(1);
});
