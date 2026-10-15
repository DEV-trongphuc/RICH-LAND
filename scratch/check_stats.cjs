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
  const stats = await queryProd(`
    SELECT 
      COUNT(*) as total_leads,
      SUM(CASE WHEN lead_phan_loai IS NOT NULL AND lead_phan_loai != '' THEN 1 ELSE 0 END) as has_phan_loai,
      SUM(CASE WHEN loai_lead IS NOT NULL AND loai_lead != '' THEN 1 ELSE 0 END) as has_loai_lead,
      SUM(CASE WHEN donvi_chay IS NOT NULL AND donvi_chay != '' THEN 1 ELSE 0 END) as has_donvi_chay,
      SUM(CASE WHEN facebook_link IS NOT NULL AND facebook_link != '' THEN 1 ELSE 0 END) as has_fb_link,
      SUM(CASE WHEN form_name IS NOT NULL AND form_name != '' THEN 1 ELSE 0 END) as has_form_name,
      SUM(CASE WHEN ad_name IS NOT NULL AND ad_name != '' THEN 1 ELSE 0 END) as has_ad_name
    FROM leads
  `);
  console.log('LEADS STATS ON PRODUCTION:', JSON.stringify(stats.data, null, 2));
}

main().catch(console.error);
