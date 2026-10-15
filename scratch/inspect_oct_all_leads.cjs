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
  console.log('--- TOÀN BỘ LEADS TỪ NGÀY 02/10/2026 ĐẾN NAY TRÊN CRM ---');
  const res = await runSql(`
    SELECT 
      l.id, 
      l.name, 
      l.phone, 
      l.email, 
      l.status, 
      l.source, 
      l.created_at, 
      l.assigned_to,
      c.name as consultant_name,
      l.note,
      l.lead_phan_loai,
      l.loai_lead,
      l.donvi_chay,
      l.appsheet_id
    FROM leads l
    LEFT JOIN consultants c ON l.assigned_to = c.id
    WHERE l.created_at >= '2026-10-02 00:00:00'
    ORDER BY l.id DESC
  `);

  if (!res.data) {
    console.log('Lỗi:', res);
    return;
  }

  console.log(`Tổng số lead: ${res.data.length}`);
  res.data.forEach((lead, idx) => {
    const notePreview = (lead.note || '').substring(0, 40).replace(/\n/g, ' ');
    console.log(`[${idx+1}] ID: ${lead.id} | ${lead.created_at} | Phone: ${lead.phone} | Name: "${lead.name}" | Status: ${lead.status} | Sale: ${lead.consultant_name || 'Chưa chia'} | AppsheetID: ${lead.appsheet_id || 'None'} | Note: "${notePreview}"`);
  });
}

main().catch(console.error);
