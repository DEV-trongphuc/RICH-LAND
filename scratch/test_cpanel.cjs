const https = require('https');

const host = 'hf60-22099.azdigihost.com';
const port = 2083;
const username = 'zccqvhhh';
const password = '1Re35Dn3ia';

const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

function callCpanel(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': auth,
        'User-Agent': 'Mozilla/5.0'
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data.substring(0, 500) });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log("Testing cPanel UAPI...");
  // Test Fileman list_files in crm.richland.city
  const res = await callCpanel('/execute/Fileman/list_files?dir=crm.richland.city');
  console.log("Status:", res.status);
  console.log("Result:", JSON.stringify(res.data || res.raw, null, 2));
}

test().catch(console.error);
