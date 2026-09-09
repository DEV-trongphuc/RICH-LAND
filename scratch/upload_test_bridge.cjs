const fs = require('fs');
const https = require('https');
const CpanelClient = require('./cpanel_client.cjs');

async function main() {
  const client = new CpanelClient();
  const fileContent = fs.readFileSync('scratch/test_bridge.php');

  console.log("Uploading test_bridge.php to /home/zccqvhhh/crm.richland.city ...");
  const uploadRes = await client.uploadFile('crm.richland.city', 'test_bridge.php', fileContent);
  console.log("Upload result:", JSON.stringify(uploadRes));

  console.log("Checking https://crm.richland.city/test_bridge.php ...");
  https.get('https://crm.richland.city/test_bridge.php', { rejectUnauthorized: false }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log("HTTP Status:", res.statusCode);
      try {
        console.log("Response:", JSON.stringify(JSON.parse(data), null, 2));
      } catch (e) {
        console.log("Raw Response:", data);
      }
    });
  }).on('error', console.error);
}

main().catch(console.error);
