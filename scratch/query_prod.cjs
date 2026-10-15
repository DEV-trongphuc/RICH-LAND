const https = require('https');

function queryProd(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const res = await queryProd("SELECT * FROM leads WHERE phone LIKE '%948740779%' LIMIT 1");
  console.log('RESULT LEADS:', JSON.stringify(res, null, 2));

  const resDl = await queryProd("SELECT * FROM distribution_logs WHERE lead_id = " + (res.data?.[0]?.id || 0) + " LIMIT 1");
  console.log('RESULT DL:', JSON.stringify(resDl, null, 2));

  const resCt = await queryProd("SELECT * FROM contacts WHERE phone LIKE '%948740779%' LIMIT 1");
  console.log('RESULT CONTACTS:', JSON.stringify(resCt, null, 2));
}

main().catch(console.error);
