const https = require('https');
const fs = require('fs');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const options = {
      hostname: 'open.domation.net',
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

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

async function dumpDatabase() {
  console.log("=== BẮT ĐẦU XUẤT DATABASE TỪ OPEN.DOMATION.NET ===");
  
  const tablesRes = await queryDb("SHOW FULL TABLES;");
  if (!tablesRes.data) {
    throw new Error("Không lấy được danh sách bảng: " + JSON.stringify(tablesRes));
  }

  const baseTables = [];
  const views = [];

  tablesRes.data.forEach(r => {
    const vals = Object.values(r);
    const name = vals[0];
    const type = vals[1];
    if (type === 'VIEW') {
      views.push(name);
    } else {
      baseTables.push(name);
    }
  });

  console.log(`Tìm thấy ${baseTables.length} base tables và ${views.length} views.`);

  let sqlDump = "SET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\nSET NAMES utf8mb4;\n\n";

  // 1. Base tables
  for (const tbl of baseTables) {
    console.log(`Dumping schema for table: ${tbl}`);
    const createRes = await queryDb(`SHOW CREATE TABLE \`${tbl}\`;`);
    if (createRes.data && createRes.data[0]) {
      const createSql = createRes.data[0]['Create Table'];
      sqlDump += `DROP TABLE IF EXISTS \`${tbl}\`;\n`;
      sqlDump += `${createSql};\n\n`;
    }

    // Check count and dump data
    const countRes = await queryDb(`SELECT count(*) as cnt FROM \`${tbl}\`;`);
    const count = parseInt(countRes.data?.[0]?.cnt || '0', 10);
    if (count > 0) {
      console.log(`  -> Dumping ${count} rows for ${tbl}...`);
      // Fetch in chunks of 500
      for (let offset = 0; offset < count; offset += 500) {
        const rowsRes = await queryDb(`SELECT * FROM \`${tbl}\` LIMIT 500 OFFSET ${offset};`);
        if (rowsRes.data && rowsRes.data.length > 0) {
          const rows = rowsRes.data;
          const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
          const valuesSql = rows.map(row => {
            const vals = Object.values(row).map(escapeSqlValue).join(', ');
            return `(${vals})`;
          }).join(',\n');

          sqlDump += `INSERT INTO \`${tbl}\` (${cols}) VALUES\n${valuesSql};\n\n`;
        }
      }
    }
  }

  // 2. Views
  for (const v of views) {
    console.log(`Dumping view: ${v}`);
    const createRes = await queryDb(`SHOW CREATE TABLE \`${v}\`;`);
    if (createRes.data && createRes.data[0]) {
      sqlDump += `DROP VIEW IF EXISTS \`${v}\`;\n`;
      // Clean up view definer for portability
      let vSql = createRes.data[0]['Create View'];
      vSql = vSql.replace(/DEFINER=`[^`]+`@`[^`]+`/g, '');
      sqlDump += `${vSql};\n\n`;
    }
  }

  sqlDump += "SET FOREIGN_KEY_CHECKS = 1;\n";

  fs.writeFileSync('scratch/full_db_dump.sql', sqlDump, 'utf8');
  console.log(`=== XUẤT DATABASE THÀNH CÔNG! Kích thước file: ${(sqlDump.length / 1024).toFixed(2)} KB ===`);
}

dumpDatabase().catch(console.error);
