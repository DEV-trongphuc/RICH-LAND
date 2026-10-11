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
  const checkSql = `
    SELECT c.id, c.person_id, c.lead_phan_loai as old_phan_loai,
           COALESCE(
             NULLIF(l.lead_phan_loai, 'databank'),
             NULLIF(l.loai_lead, 'databank'),
             NULLIF(l.type, 'databank'),
             NULLIF(l.source, 'databank')
           ) as new_phan_loai,
           l.lead_phan_loai as l_phan_loai,
           l.type as l_type,
           l.source as l_source
    FROM contacts c
    JOIN leads l ON c.person_id = l.person_id
    WHERE c.lead_phan_loai = 'databank'
  `;
  const preview = await query(checkSql);
  console.log('Preview update:');
  console.log(JSON.stringify(preview, null, 2));
}

main().catch(console.error);
