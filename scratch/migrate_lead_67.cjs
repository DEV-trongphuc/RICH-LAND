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
  console.log('--- Migrating Contact 67 ---');
  // 1. Get current notes
  const cRes = await query("SELECT id, notes FROM contacts WHERE id = 67");
  let notes = cRes?.data?.[0]?.notes || '';
  if (!notes.includes('loai_hinh:')) {
    notes = notes + "\n• loai_hinh: DUPLEX PENTHOUSE";
  }

  const updateContact = await query(`
    UPDATE contacts 
    SET loai_lead = 'lead_form',
        lead_phan_loai = 'R3_Fb',
        customer_type = 'lead_form',
        property_type = 'DUPLEX PENTHOUSE',
        notes = ${JSON.stringify(notes)}
    WHERE id = 67
  `);
  console.log('Update contact result:', updateContact);

  console.log('--- Migrating Lead 69 ---');
  const lRes = await query("SELECT id, note FROM leads WHERE id = 69");
  let lNote = lRes?.data?.[0]?.note || '';
  if (!lNote.includes('loai_hinh:')) {
    lNote = lNote + "\n• loai_hinh: DUPLEX PENTHOUSE";
  }

  const updateLead = await query(`
    UPDATE leads 
    SET type = 'lead_form',
        loai_lead = 'lead_form',
        lead_phan_loai = 'R3_Fb',
        note = ${JSON.stringify(lNote)}
    WHERE id = 69
  `);
  console.log('Update lead result:', updateLead);

  console.log('--- Verifying result ---');
  const verifyCt = await query("SELECT id, phone, first_name, last_name, lead_phan_loai, loai_lead, customer_type, property_type, notes FROM contacts WHERE id = 67");
  console.log('Verified Contact:', JSON.stringify(verifyCt, null, 2));

  const verifyLd = await query("SELECT id, phone, name, type, loai_lead, lead_phan_loai, note FROM leads WHERE id = 69");
  console.log('Verified Lead:', JSON.stringify(verifyLd, null, 2));
}

run();
