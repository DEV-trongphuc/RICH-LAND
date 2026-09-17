const https = require('https');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: data });
        }
      });
    }).on('error', reject);
  });
}

async function searchVercelInAllTables() {
  const tablesRes = await queryDb('SHOW TABLES');
  if (!tablesRes || tablesRes.status !== 'success') {
    console.log('Failed to get tables:', tablesRes);
    return;
  }

  const dbName = Object.keys(tablesRes.data[0])[0];
  const tables = tablesRes.data.map(row => row[dbName]);
  console.log(`Found ${tables.length} tables. Searching for %vercel%...`);

  for (const table of tables) {
    const colsRes = await queryDb(`DESCRIBE \`${table}\``);
    if (!colsRes || colsRes.status !== 'success') continue;

    const textCols = colsRes.data
      .filter(c => c.Type.includes('char') || c.Type.includes('text') || c.Type.includes('blob'))
      .map(c => c.Field);

    if (textCols.length === 0) continue;

    const whereClauses = textCols.map(col => `\`${col}\` LIKE '%vercel%'`).join(' OR ');
    const searchSql = `SELECT count(*) as cnt FROM \`${table}\` WHERE ${whereClauses}`;
    const searchRes = await queryDb(searchSql);

    if (searchRes && searchRes.data && searchRes.data[0] && parseInt(searchRes.data[0].cnt) > 0) {
      console.log(`\n>>> Table \`${table}\` has ${searchRes.data[0].cnt} row(s) containing vercel:`);
      const sampleSql = `SELECT * FROM \`${table}\` WHERE ${whereClauses} LIMIT 5`;
      const sampleRes = await queryDb(sampleSql);
      console.log(JSON.stringify(sampleRes.data, null, 2));
    }
  }
  console.log('\nSearch completed.');
}

searchVercelInAllTables();
