const https = require('https');

async function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function main() {
  console.log('--- TABLES ---');
  console.log(await runQuery("SHOW TABLES LIKE '%shift%'"));
  console.log('--- SYSTEM SETTINGS FOR SHIFTS ---');
  console.log(await runQuery("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%shift%' OR setting_key LIKE '%night%' OR setting_key LIKE '%weekend%'"));
  console.log('--- USERS vs ACCOUNTS vs CONSULTANTS ---');
  console.log(await runQuery("DESCRIBE night_shift_registrations"));
  console.log(await runQuery("DESCRIBE weekend_shift_registrations"));
  console.log(await runQuery("DESCRIBE holiday_shift_registrations"));
}

main().catch(console.error);
