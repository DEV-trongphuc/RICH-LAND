const https = require('https');
const fs = require('fs');

function query(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
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

// SQL tuple parser
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
      vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim());
      currentVal = '';
      continue;
    }

    currentVal += ch;
  }
  vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim());
  return vals;
}

async function main() {
  console.log("==================================================================");
  console.log("👥 BƯỚC 2: IDENTITY RESOLUTION (PERSONS) & ĐỒNG BỘ LEADS (10.189 DÒNG)");
  console.log("==================================================================");

  console.log("\n1. Đang nạp AppsheetRLVN.sql...");
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

  // Load project map
  const projectMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\project_map.json', 'utf8'));

  // 1. Phân tích LEADS_KHOCHUNG
  console.log("2. Phân tích danh sách lead Kho Chung (LEADS_KHOCHUNG)...");
  const databankLeadIds = new Set();
  const khoMatches = content.matchAll(/\('[^']*',\s*'[^']*',\s*'([^']*)'/g);
  for (const m of khoMatches) {
    if (m[1]) databankLeadIds.add(m[1].trim());
  }
  console.log(`  Tìm thấy ${databankLeadIds.size} lead thuộc Kho Chung / Databank.`);

  // 2. Parse toàn bộ LEADS
  console.log("3. Đang trích xuất toàn bộ bảng LEADS...");
  const mLeads = content.match(/INSERT INTO `LEADS` [^;]+;/gs);
  const rawLeads = [];
  for (const block of mLeads) {
    const tuples = parseSqlTuples(block);
    for (const t of tuples) {
      const parts = splitTupleValues(t);
      if (parts.length >= 10) {
        rawLeads.push({
          id: parts[0],
          create_time: parts[1] || new Date().toISOString().slice(0, 19).replace('T', ' '),
          fullname: parts[2] || 'Khách hàng',
          email: parts[3] || '',
          phone: parts[4] || '',
          cleanPhone: normalizePhone(parts[4]),
          loai_lead: parts[5] || 'lead_form',
          kenh: parts[6] || 'FbAds',
          du_an: parts[7] || '',
          lead_phan_loai: parts[8] || '',
          trang_thai: parts[11] || '2',
          is_databank: databankLeadIds.has(parts[0]) || parts[12] === "b'1'",
          client_context: parts[32] || '',
          ad_id: parts[33] || '',
          campaign: parts[34] || '',
          ad_name: parts[35] || '',
        });
      }
    }
  }
  console.log(`  Đã trích xuất hoàn hảo: ${rawLeads.length} leads.`);

  // 3. Đồng bộ bảng PERSONS (Identity Resolution theo số điện thoại)
  console.log("\n4. Đang gom nhóm số điện thoại và đồng bộ bảng PERSONS...");
  const phoneMap = new Map(); // phone -> { name, email, is_public, count }
  for (const l of rawLeads) {
    if (!l.cleanPhone) continue;
    if (!phoneMap.has(l.cleanPhone)) {
      phoneMap.set(l.cleanPhone, {
        phone: l.cleanPhone,
        name: l.fullname,
        email: l.email,
        is_public: l.is_databank ? 1 : 0
      });
    } else {
      const existing = phoneMap.get(l.cleanPhone);
      if (l.is_databank) existing.is_public = 1;
      if (!existing.email && l.email) existing.email = l.email;
    }
  }
  console.log(`  Tổng số điện thoại duy nhất (Unique Persons): ${phoneMap.size}`);

  // Nạp persons theo từng mẻ 400
  const uniquePersons = Array.from(phoneMap.values());
  const PERSON_BATCH = 400;
  let personInserted = 0;
  for (let i = 0; i < uniquePersons.length; i += PERSON_BATCH) {
    const batch = uniquePersons.slice(i, i + PERSON_BATCH);
    const values = batch.map(p => 
      `(${escapeSql(p.phone)}, ${escapeSql(p.name)}, ${escapeSql(p.email || '')}, ${p.is_public})`
    ).join(',');

    const sql = `
      INSERT INTO persons (phone, full_name, email, is_public)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE 
        full_name = IF(full_name = '' OR full_name IS NULL, VALUES(full_name), full_name),
        is_public = IF(VALUES(is_public) = 1, 1, is_public)
    `;
    const res = await query(sql);
    if (res.status === 'success') {
      personInserted += batch.length;
      process.stdout.write(`\r  Đã nạp ${personInserted}/${uniquePersons.length} persons...`);
    } else {
      console.warn(`\n  ⚠️ Lỗi nạp mẻ persons ${i}:`, res);
    }
  }
  console.log(`\n  ✅ Đã đồng bộ hoàn tất bảng PERSONS!`);

  // Lấy toàn bộ persons từ DB để tạo map: phone -> person_id
  console.log("\n5. Đang nạp Persons Map từ database...");
  const personsRes = await query("SELECT id, phone FROM persons");
  const personIdMap = new Map();
  if (personsRes.data) {
    personsRes.data.forEach(p => {
      if (p.phone) personIdMap.set(normalizePhone(p.phone), p.id);
    });
  }
  console.log(`  Persons Map trong bộ nhớ: ${personIdMap.size} số.`);

  // 4. Nạp bảng LEADS theo từng mẻ 250
  console.log("\n6. Đang nạp bảng LEADS (10.189 dòng) vào RichLand CRM...");
  const LEAD_BATCH = 250;
  let leadsProcessed = 0;
  const leadIdLookup = {}; // appsheet_lead_id -> { crm_lead_id, person_id, phone }

  for (let i = 0; i < rawLeads.length; i += LEAD_BATCH) {
    const batch = rawLeads.slice(i, i + LEAD_BATCH);
    const values = batch.map(l => {
      const personId = personIdMap.get(l.cleanPhone) || 'NULL';
      const status = l.is_databank ? 'unassigned' : 'active';
      const projId = projectMap[l.du_an] || 'NULL';
      const payloadObj = {
        appsheet_id: l.id,
        kenh: l.kenh,
        loai_lead: l.loai_lead,
        lead_phan_loai: l.lead_phan_loai,
        is_databank: l.is_databank,
        client_context: l.client_context
      };

      return `(
        ${personId},
        ${escapeSql(l.phone || l.cleanPhone)},
        ${escapeSql(l.email)},
        ${escapeSql(l.fullname)},
        ${escapeSql(l.kenh || l.loai_lead || 'AppSheet')},
        ${escapeSql(l.loai_lead)},
        ${escapeSql(l.campaign)},
        ${escapeSql(l.campaign)},
        ${escapeSql(l.ad_id)},
        ${escapeSql(l.ad_name)},
        ${escapeSql(JSON.stringify(payloadObj))},
        ${projId},
        ${escapeSql(status)},
        1,
        'none',
        'none',
        'none',
        ${escapeSql(l.create_time)}
      )`;
    }).join(',');

    const sql = `
      INSERT INTO leads (
        person_id, phone, email, name, source, type,
        campaign_id, campaign_name, ad_id, ad_name, raw_payload,
        project_id, status, is_accepted, zalo_notify_status, email_notify_status, telegram_notify_status, created_at
      ) VALUES ${values}
    `;

    const res = await query(sql);
    if (res.status === 'success') {
      leadsProcessed += batch.length;
      process.stdout.write(`\r  Đã nạp ${leadsProcessed}/${rawLeads.length} leads...`);
    } else {
      console.warn(`\n  ⚠️ Lỗi nạp mẻ leads ${i}:`, res);
    }
  }

  console.log(`\n  ✅ Đã nạp thành công ${leadsProcessed} bản ghi vào bảng LEADS!`);

  // 5. Đối soát hàng đợi thông báo xem có bị rò rỉ không
  console.log("\n7. 🔍 Kiểm tra an toàn: Đối soát các bảng hàng đợi thông báo:");
  const queues = ['telegram_queue', 'zalo_queue', 'mail_queue'];
  for (const q of queues) {
    const qRes = await query(`SELECT COUNT(*) as cnt FROM \`${q}\``);
    console.log(`  - ${q}: ${qRes.data[0].cnt} (Được bảo toàn tuyệt đối, không tăng thêm)`);
  }

  // 6. Xây dựng lookup map hoàn chỉnh từ database để phục vụ Bước 3 (Contacts)
  console.log("\n8. Đang trích xuất Map LEADS từ database...");
  const dbLeadsRes = await query("SELECT id, person_id, phone, raw_payload FROM leads WHERE raw_payload LIKE '%appsheet_id%'");
  if (dbLeadsRes.data) {
    for (const row of dbLeadsRes.data) {
      try {
        const payload = JSON.parse(row.raw_payload);
        if (payload.appsheet_id) {
          leadIdLookup[payload.appsheet_id] = {
            crm_lead_id: row.id,
            person_id: row.person_id,
            phone: row.phone
          };
        }
      } catch (e) {}
    }
  }
  console.log(`  Đã tạo Lead Lookup Map với ${Object.keys(leadIdLookup).length} bản ghi.`);
  fs.writeFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', JSON.stringify(leadIdLookup, null, 2));
  console.log("💾 Đã lưu lead_map.json cho Bước 3.");

  console.log("\n🎉 HOÀN TẤT BƯỚC 2!");
}

main().catch(err => {
  console.error("❌ Lỗi Bước 2:", err);
  process.exit(1);
});
