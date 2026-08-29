const https = require('https');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== 1. DISTRIBUTION ROUNDS ===');
  const rounds = await queryDb("SELECT id, round_name, round_type, grab_countdown_seconds, grab_cooldown_seconds, grab_fallback_to_databank, grab_max_attempts FROM distribution_rounds");
  console.log(JSON.stringify(rounds, null, 2));

  console.log('\n=== 2. LEAD HA LUC ===');
  const leads = await queryDb("SELECT id, name, phone, status, target_round_id, assigned_to, ai_screener_status, ai_evaluation, created_at FROM leads WHERE name LIKE '%Hà Lực%' OR phone LIKE '%011%'");
  console.log(JSON.stringify(leads, null, 2));

  if (leads.data && leads.data.length > 0) {
    const leadId = leads.data[0].id;
    const logs = await queryDb(`SELECT * FROM distribution_logs WHERE lead_id = ${leadId} ORDER BY id DESC`);
    console.log('Lead logs:', JSON.stringify(logs, null, 2));
  }

  console.log('\n=== 3. DEPOSITS & DUPLICATES ===');
  const deposits = await queryDb("SELECT id, contact_id, project_id, unit_code, price, expected_commission, status, created_at, created_by FROM deposits ORDER BY id DESC LIMIT 15");
  console.log(JSON.stringify(deposits, null, 2));

  console.log('\n=== 4. COOPERATION SLIPS ===');
  const slips = await queryDb("SELECT id, contact_id, deposit_slip_id, attachment_url, status, created_at FROM cooperation_slips ORDER BY id DESC LIMIT 10");
  console.log(JSON.stringify(slips, null, 2));

  console.log('\n=== 5. SYSTEM SETTINGS (AI Screener / Gatekeeper) ===');
  const settings = await queryDb("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%ai_screener%' OR setting_key LIKE '%gatekeeper%' OR setting_key LIKE '%grab%'");
  console.log(JSON.stringify(settings, null, 2));
}

main().catch(console.error);
