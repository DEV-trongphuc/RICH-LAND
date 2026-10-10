const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log("Adding donvi_chay to leads...");
  const r1 = await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS donvi_chay VARCHAR(100) NULL AFTER ad_name");
  console.log('r1:', r1);

  console.log("Adding donvi_chay to contacts...");
  const r2 = await query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS donvi_chay VARCHAR(100) NULL AFTER ad_name");
  console.log('r2:', r2);
}

run();
