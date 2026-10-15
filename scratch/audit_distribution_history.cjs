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
  console.log('=== 1. KIỂM TRA CHI TIẾT 3 LEAD TRONG ẢNH CỦA USER ===');
  const phones = ['0936141163', '+420775423337', '0969434599', '+4915560763024'];
  for (const phone of phones) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Kiểm tra Phone: ${phone}`);
    const leadRes = await runSql(`
      SELECT l.id, l.name, l.phone, l.status, l.assigned_to, c.name as sale_name, l.is_public, l.note, l.raw_payload, l.created_at
      FROM leads l
      LEFT JOIN consultants c ON l.assigned_to = c.id
      WHERE l.phone LIKE '%${phone.replace('+', '')}%'
    `);
    console.log('Lead row:', JSON.stringify(leadRes.data, null, 2));

    if (leadRes.data && leadRes.data.length > 0) {
      const leadId = leadRes.data[0].id;
      const logsRes = await runSql(`
        SELECT dl.id, dl.lead_id, dl.assigned_to, c.name as assigned_to_name, dl.status, dl.received_at, dl.round_id, dl.reason
        FROM distribution_logs dl
        LEFT JOIN consultants c ON dl.assigned_to = c.id
        WHERE dl.lead_id = ${leadId}
        ORDER BY dl.id ASC
      `);
      console.log('Distribution Logs:', JSON.stringify(logsRes.data, null, 2));
    }
  }

  console.log('\n=== 2. KIỂM TRA TRONG APPSHEET CHO 3 SỐ NÀY ===');
  for (const phone of phones) {
    const rawDigits = phone.replace(/\D/g, '');
    const qApp = await runSql(`
      SELECT appsheet_id, phone, name, status, assigned_to
      FROM leads
      WHERE phone LIKE '%${rawDigits}%'
    `);
    console.log(`Appsheet search for ${phone}:`, qApp.data);
  }
}

main().catch(console.error);
