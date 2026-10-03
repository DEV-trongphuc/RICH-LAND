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
  const checkContacts = await query(`
    SELECT id, phone, first_name, last_name, lead_phan_loai, loai_lead, customer_type, notes 
    FROM contacts 
    WHERE loai_lead LIKE '%DUPLEX%' 
       OR loai_lead LIKE '%PENTHOUSE%' 
       OR loai_lead LIKE '%1PN%' 
       OR loai_lead LIKE '%2PN%' 
       OR loai_lead LIKE '%3PN%'
       OR loai_lead LIKE '%Căn hộ%'
       OR loai_lead LIKE '%Villa%'
       OR (notes LIKE '%• loai_lead:%' AND (loai_lead IS NULL OR loai_lead = '' OR loai_lead LIKE '%DUPLEX%'))
  `);
  console.log('Affected Contacts Count:', checkContacts?.data?.length || 0);
  if (checkContacts?.data) {
    console.log('Affected Contacts:', JSON.stringify(checkContacts.data, null, 2));
  }
}

run();
