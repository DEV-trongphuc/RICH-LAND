const https = require('https');

function execQuery(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const logs = await execQuery(`
    SELECT dl.id, dl.lead_id, dl.assigned_to, c.name, dl.status, dl.message, dl.received_at
    FROM distribution_logs dl
    LEFT JOIN consultants c ON dl.assigned_to = c.id
    WHERE dl.lead_id = 10413
    ORDER BY dl.id DESC
    LIMIT 5
  `);
  console.log("Recent logs for 10413:", JSON.stringify(logs.data, null, 2));
}

run();
