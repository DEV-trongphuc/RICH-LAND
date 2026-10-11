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
  const updateSql = `
    UPDATE contacts c
    JOIN (
      SELECT person_id,
             MAX(CASE WHEN lead_phan_loai IS NOT NULL AND lead_phan_loai != '' AND lead_phan_loai != 'databank' THEN lead_phan_loai
                      WHEN loai_lead IS NOT NULL AND loai_lead != '' AND loai_lead != 'databank' THEN loai_lead
                      WHEN type IS NOT NULL AND type != '' AND type != 'databank' THEN type
                      WHEN source IS NOT NULL AND source != '' AND source != 'databank' AND source != 'Website' THEN source
                      ELSE NULL END) as resolved_tag
      FROM leads
      GROUP BY person_id
    ) l_tag ON c.person_id = l_tag.person_id
    SET c.lead_phan_loai = l_tag.resolved_tag
    WHERE c.lead_phan_loai = 'databank' AND l_tag.resolved_tag IS NOT NULL
  `;
  const res = await query(updateSql);
  console.log('Update result:', res);

  const verify = await query("SELECT id, person_id, lead_phan_loai, source FROM contacts WHERE id IN (4701, 4702, 4687, 4693, 4683)");
  console.log('Verification:', JSON.stringify(verify, null, 2));
}

main().catch(console.error);
