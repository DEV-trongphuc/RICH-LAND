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
  const allWebhookContacts = await query(`
    SELECT id, person_id, phone, first_name, last_name, lead_phan_loai, loai_lead, customer_type, notes 
    FROM contacts 
    WHERE notes LIKE '%• loai_lead:%' OR notes LIKE '%• lead_phan_loai:%'
  `);
  console.log('Total contacts with webhook fields in notes:', allWebhookContacts?.data?.length || 0);
  if (allWebhookContacts?.data) {
    for (const c of allWebhookContacts.data) {
      console.log(`ID ${c.id} (${c.phone}): lead_phan_loai='${c.lead_phan_loai}', loai_lead='${c.loai_lead}'`);
    }
  }
}

run();
