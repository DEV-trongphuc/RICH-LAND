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

async function main() {
  const countRes = await query("SELECT COUNT(*) as cnt FROM contacts WHERE lead_phan_loai = 'databank'");
  console.log('Count of contacts with lead_phan_loai = databank:', countRes);

  const listRes = await query(`
    SELECT c.id, c.person_id, c.owner_id, c.source, c.lead_phan_loai,
           l.source as lead_source, l.lead_phan_loai as lead_real_phan_loai, l.loai_lead as lead_loai_lead, l.type as lead_type
    FROM contacts c
    LEFT JOIN leads l ON (c.person_id = l.person_id)
    WHERE c.lead_phan_loai = 'databank'
    ORDER BY c.id DESC
  `);
  console.log('Contacts and their original lead classifications:');
  console.log(JSON.stringify(listRes, null, 2));
}

main().catch(console.error);
