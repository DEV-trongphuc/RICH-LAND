const fs = require('fs');
const https = require('https');

function sendBatch(items, batchIndex, totalBatches) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ items });
    const options = {
      hostname: 'crm.richland.city',
      port: 443,
      path: '/backend/sync_appsheet_batch.php?key=richland2026',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve({ success: false, raw: body, status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Loading scratch/appsheet_extracted.json...');
  const allLeads = JSON.parse(fs.readFileSync('scratch/appsheet_extracted.json', 'utf8'));
  console.log(`Total leads to sync: ${allLeads.length}`);

  const BATCH_SIZE = 300;
  const totalBatches = Math.ceil(allLeads.length / BATCH_SIZE);

  let totalUpdatedLeads = 0;
  let totalUpdatedContacts = 0;
  let successBatches = 0;

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, allLeads.length);
    const batch = allLeads.slice(start, end);

    process.stdout.write(`Batch ${i + 1}/${totalBatches} (${batch.length} items)... `);
    try {
      const res = await sendBatch(batch, i + 1, totalBatches);
      if (res.success) {
        successBatches++;
        totalUpdatedLeads += (res.updated_leads || 0);
        totalUpdatedContacts += (res.updated_contacts || 0);
        console.log(`✅ OK (Leads updated: ${res.updated_leads}, Contacts updated: ${res.updated_contacts})`);
      } else {
        console.log(`❌ FAILED:`, res.error || res.raw || res);
      }
    } catch (err) {
      console.log(`❌ ERROR:`, err.message);
    }
  }

  console.log('\n==================================================');
  console.log('🎉 SYNC COMPLETED!');
  console.log(`- Success Batches: ${successBatches}/${totalBatches}`);
  console.log(`- Total Leads rows updated in DB: ${totalUpdatedLeads}`);
  console.log(`- Total Contacts rows updated in DB: ${totalUpdatedContacts}`);
  console.log('==================================================');
}

main().catch(console.error);
