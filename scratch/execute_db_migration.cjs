const fs = require('fs');
const https = require('https');
const CpanelClient = require('./cpanel_client.cjs');

async function main() {
  const client = new CpanelClient();

  console.log("1. Uploading scratch/full_db_dump.sql to crm.richland.city...");
  const sqlBuf = fs.readFileSync('scratch/full_db_dump.sql');
  const upSql = await client.uploadFile('crm.richland.city', 'full_db_dump.sql', sqlBuf);
  console.log("SQL Upload Result:", upSql.status, upSql.data?.status === 1 ? "OK" : upSql.data);

  console.log("2. Uploading scratch/import_db.php to crm.richland.city...");
  const phpBuf = fs.readFileSync('scratch/import_db.php');
  const upPhp = await client.uploadFile('crm.richland.city', 'import_db.php', phpBuf);
  console.log("PHP Upload Result:", upPhp.status, upPhp.data?.status === 1 ? "OK" : upPhp.data);

  console.log("3. Executing import via https://crm.richland.city/import_db.php?key=richland2026 ...");
  const req = https.get('https://crm.richland.city/import_db.php?key=richland2026', { rejectUnauthorized: false }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log("HTTP Status:", res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log("Import Result Status:", json.status);
        console.log("Total tables created:", json.total_tables_created);
        console.log("Users count:", json.users_count);
        console.log("Settings count:", json.settings_count);
        console.log("Projects count:", json.projects_count);
        if (json.errors && json.errors.length > 0) {
          console.error("Errors during import:", json.errors);
        }
      } catch (e) {
        console.log("Raw Response:", data);
      }
    });
  });
  req.on('error', console.error);
}

main().catch(console.error);
