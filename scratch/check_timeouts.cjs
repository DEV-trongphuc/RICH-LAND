const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  const s = await query("SELECT setting_key, setting_value, description FROM system_settings WHERE setting_key LIKE '%timeout%' OR setting_key LIKE '%recall%' OR setting_key LIKE '%response%' OR setting_key LIKE '%grab%'");
  console.log("--- SYSTEM SETTINGS ---");
  console.log(s.data);

  const sc = await query("SELECT id, sheet_name, lead_recall_minutes FROM sheet_connections");
  console.log("--- SHEET CONNECTIONS ---");
  console.log(sc.data);

  const dr = await query("SELECT id, round_name, round_type, grab_countdown_seconds, grab_cooldown_seconds, grab_fallback_to_databank FROM distribution_rounds");
  console.log("--- DISTRIBUTION ROUNDS ---");
  console.log(dr.data);
}

main();
