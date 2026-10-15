const https = require('https');

function runSql(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request({
      hostname: 'crm.richland.city',
      port: 443,
      path: '/backend/exec_db_query.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          resolve({ error: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('--- 1. TỔNG SỐ LEADS TỪ NGÀY 02/10/2026 ĐẾN NAY ---');
  const q1 = await runSql(`
    SELECT 
      DATE(created_at) as ngay,
      COUNT(*) as total,
      SUM(CASE WHEN phone IS NULL OR phone = '' THEN 1 ELSE 0 END) as phone_empty,
      SUM(CASE WHEN name IS NULL OR name = '' OR name = 'Khách hàng ẩn danh' THEN 1 ELSE 0 END) as name_empty,
      SUM(CASE WHEN note IS NULL OR note = '' THEN 1 ELSE 0 END) as note_empty,
      SUM(CASE WHEN assigned_to IS NULL OR assigned_to = 0 THEN 1 ELSE 0 END) as unassigned
    FROM leads
    WHERE created_at >= '2026-10-02 00:00:00'
    GROUP BY DATE(created_at)
    ORDER BY ngay ASC
  `);
  console.log(JSON.stringify(q1, null, 2));

  console.log('\n--- 2. KIỂM TRA LEADS RỖNG GẦN ĐÂY (TỪ 02/10) ---');
  const q2 = await runSql(`
    SELECT id, name, phone, email, source, status, assigned_to, created_at, appsheet_id, lead_phan_loai, loai_lead, donvi_chay
    FROM leads
    WHERE created_at >= '2026-10-02 00:00:00' AND (phone IS NULL OR phone = '' OR name IS NULL OR name = '' OR name = 'Khách hàng ẩn danh')
    LIMIT 20
  `);
  console.log(JSON.stringify(q2, null, 2));

  console.log('\n--- 3. KIỂM TRA CÓ LEADS NÀO BỊ DUPLICATE PHONE TRONG CRM KHÔNG ---');
  const q3 = await runSql(`
    SELECT phone, COUNT(*) as cnt, GROUP_CONCAT(id) as lead_ids, GROUP_CONCAT(name) as names, GROUP_CONCAT(created_at) as dates
    FROM leads
    WHERE phone IS NOT NULL AND phone != '' AND created_at >= '2026-10-02 00:00:00'
    GROUP BY phone
    HAVING cnt > 1
    LIMIT 10
  `);
  console.log(JSON.stringify(q3, null, 2));
}

main().catch(console.error);
