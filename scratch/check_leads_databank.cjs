const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, { rejectUnauthorized: false }, res => {
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
  const r1 = await query("SELECT COUNT(id) as cnt FROM leads WHERE lead_phan_loai = 'databank'");
  console.log('leads with lead_phan_loai = databank:', r1);

  const r2 = await query("SELECT COUNT(id) as cnt FROM contacts WHERE lead_phan_loai = 'databank'");
  console.log('contacts with lead_phan_loai = databank:', r2);

  const r3 = await query(`
    SELECT c.id, c.person_id, c.lead_phan_loai, l.lead_phan_loai as l_phan_loai, l.loai_lead, l.type, l.source
    FROM contacts c
    LEFT JOIN leads l ON c.person_id = l.person_id
    WHERE c.lead_phan_loai = 'databank'
  `);
  console.log('sample contacts with databank:', JSON.stringify(r3, null, 2));
}

run();
