const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const leads = await query(`
    SELECT id, phone, name, type, loai_lead, lead_phan_loai, note 
    FROM leads 
    WHERE note LIKE '%• loai_lead:%' OR note LIKE '%• lead_phan_loai:%' OR type LIKE '%DUPLEX%'
  `);
  console.log('Leads:', JSON.stringify(leads, null, 2));
}

run();
