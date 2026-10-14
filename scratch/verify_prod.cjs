const https = require('https');

function request(path, token = 'demo_token_12345') {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = https.request({
      hostname: 'crm.richland.city',
      path: '/backend/' + path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        const time = Date.now() - start;
        try {
          resolve({ status: res.statusCode, time, data: JSON.parse(resData) });
        } catch (e) {
          resolve({ status: res.statusCode, time, raw: resData.substring(0, 300) });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== 1. Benchmarking get_public_leads (/databank) on Production ===');
  const dbRes = await request('api.php?action=get_public_leads');
  const dbCount = Array.isArray(dbRes.data) ? dbRes.data.length : (dbRes.data?.data?.length || 0);
  console.log(`Status: ${dbRes.status} | Response Time: ${dbRes.time}ms | Leads Returned: ${dbCount}`);

  console.log('\n=== 2. Benchmarking get_logs (/data) on Production ===');
  const logRes = await request('api.php?action=get_logs&page=1&pageSize=50&date=all');
  console.log(`Status: ${logRes.status} | Response Time: ${logRes.time}ms`);
  if (logRes.data) {
    console.log('Total Leads (total_count):', logRes.data.total_count);
    console.log('Returned Page 1 count:', logRes.data.data ? logRes.data.data.length : 0);
    console.log('Pipeline Stats from Server:');
    console.log(JSON.stringify(logRes.data.pipeline_stats, null, 2));
  } else {
    console.log('Raw:', logRes.raw);
  }
}

main();
