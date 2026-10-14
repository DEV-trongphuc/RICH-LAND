const https = require('https');

async function testUrl(url) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Authorization': 'Bearer demo_token_12345'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const ms = Date.now() - t0;
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, timeMs: ms, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, timeMs: ms, raw: data.substring(0, 300) });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== VERIFYING PRODUCTION ON CRM.RICHLAND.CITY ===\n');

  console.log('--- 1. Testing get_public_leads (Kho DB Databank) ---');
  const dbRes = await testUrl('https://crm.richland.city/backend/api.php?action=get_public_leads');
  console.log(`HTTP ${dbRes.status} in ${dbRes.timeMs} ms`);
  const leads = Array.isArray(dbRes.data) ? dbRes.data : (dbRes.data?.data || []);
  console.log(`Total public leads: ${leads.length}`);
  if (leads.length > 0) {
    console.log(`Sample lead #0: ID=${leads[0].id}, Name=${leads[0].name}, Phone=${leads[0].phone}, Takers=${JSON.stringify(leads[0].takers)}`);
  }

  console.log('\n--- 2. Testing get_logs (Quản lý Lead - Tất cả thời gian) ---');
  const logsRes = await testUrl('https://crm.richland.city/backend/api.php?action=get_logs&page=1&pageSize=50&date=all');
  console.log(`HTTP ${logsRes.status} in ${logsRes.timeMs} ms`);
  if (logsRes.data) {
    console.log(`Total count: ${logsRes.data.total_count}`);
    console.log(`Page records: ${logsRes.data.data?.length}`);
    console.log(`Pipeline counts:`, JSON.stringify(logsRes.data.pipeline_counts, null, 2));
  }

  console.log('\n--- 3. Testing Frontend SPA Status & Maintenance Mode ---');
  const feRes = await testUrl('https://crm.richland.city/');
  console.log(`HTTP ${feRes.status} in ${feRes.timeMs} ms`);
}

run();
