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
  const settings = await execQuery(`
    SELECT \`key\`, \`value\` FROM system_settings 
    WHERE \`key\` LIKE '%recall%' OR \`key\` LIKE '%attempt%' OR \`key\` LIKE '%response%' OR \`key\` LIKE '%cooldown%'
  `);
  console.log("Settings:", JSON.stringify(settings, null, 2));

  const round2 = await execQuery(`
    SELECT * FROM round_consultants rc
    JOIN consultants c ON rc.consultant_id = c.id
    WHERE rc.round_id = 2
  `);
  console.log("Round 2 Consultants:", JSON.stringify(round2, null, 2));
}

run();
