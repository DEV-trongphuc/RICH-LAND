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
  console.log('Querying lead 0969434599...');
  const res = await query("SELECT id, person_id, phone, first_name, last_name, lead_phan_loai, loai_lead, customer_type, notes FROM contacts WHERE phone LIKE '%0969434599%' LIMIT 5");
  console.log('Contacts:', JSON.stringify(res, null, 2));

  const leads = await query("SELECT id, person_id, phone, name, type, lead_phan_loai, loai_lead, note FROM leads WHERE phone LIKE '%0969434599%' LIMIT 5");
  console.log('Leads:', JSON.stringify(leads, null, 2));
}

run();
