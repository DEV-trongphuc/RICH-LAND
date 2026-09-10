const https = require('https');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const options = {
      hostname: 'crm.richland.city',
      path: '/richland/exec_db_query.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data.substring(0, 300), error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const tablesRes = await queryDb("SHOW FULL TABLES WHERE Table_type != 'VIEW'");
  const tables = tablesRes.data.map(r => Object.values(r)[0]);
  console.log(`Found ${tables.length} base tables.`);
  
  // Query counts in batches
  const counts = {};
  for (let i = 0; i < tables.length; i += 10) {
    const chunk = tables.slice(i, i + 10);
    const sql = chunk.map(t => `SELECT '${t}' as tbl, count(*) as cnt FROM \`${t}\``).join(' UNION ALL ');
    const res = await queryDb(sql);
    if (res.data) {
      res.data.forEach(r => {
        counts[r.tbl] = parseInt(r.cnt, 10);
      });
    }
  }

  console.log("\n=== NON-ZERO TABLES ===");
  Object.entries(counts).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`${k.padEnd(30)}: ${v}`);
  });

  console.log("\n=== ZERO TABLES ===");
  const zeroTables = Object.entries(counts).filter(([k, v]) => v === 0).map(([k]) => k);
  console.log(zeroTables.join(', '));
}

run().catch(console.error);
