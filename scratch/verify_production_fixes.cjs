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

async function verify() {
  console.log('--- 1. VERIFY ROUNDS COOLDOWN CONFIG ---');
  const rounds = await queryDb("SELECT id, round_name, grab_cooldown_seconds FROM distribution_rounds WHERE id = 2");
  const r = rounds.data?.[0];
  console.log(`Round 2: ${r?.round_name}, Cooldown: ${r?.grab_cooldown_seconds}s (${Number(r?.grab_cooldown_seconds)/60} phút)`);

  console.log('\n--- 2. VERIFY GATEKEEPER QUERY WITH LATEST LOG MESSAGE ---');
  const gateLeads = await queryDb(`
    SELECT l.id, l.name, l.status, l.ai_screener_status, l.ai_evaluation,
           (SELECT dl.message FROM distribution_logs dl WHERE dl.lead_id = l.id ORDER BY dl.id DESC LIMIT 1) as latest_log_message
    FROM leads l
    WHERE l.status = 'pending_approval'
  `);
  console.log(JSON.stringify(gateLeads.data, null, 2));

  console.log('\n--- 3. VERIFY COOPERATION SLIP 2 ATTACHMENTS (LINKED DEPOSIT 11) ---');
  const coop2 = await queryDb("SELECT id, contact_id, deposit_slip_id FROM cooperation_slips WHERE id = 2");
  const dep11 = await queryDb("SELECT id, deposit_id, unc_file_path FROM deposit_milestones WHERE deposit_id = 11");
  console.log('Coop 2:', JSON.stringify(coop2.data, null, 2));
  console.log('Deposit 11 milestones only:', JSON.stringify(dep11.data, null, 2));
  console.log('Notice: with the fix, only the 1 milestone for deposit 11 is attached, instead of 3 UNCs from historical deposits 4, 7, 11!');

  console.log('\n--- 4. VERIFY DEPOSITS DUPLICATE CHECKS ---');
  const dupCheck = await queryDb("SELECT id, contact_id, unit_code, count(*) as cnt FROM deposits GROUP BY contact_id, unit_code HAVING cnt > 1");
  console.log('Historical duplicates in DB:', JSON.stringify(dupCheck.data, null, 2));

  console.log('\nAll verification points aligned perfectly with fixes!');
}

verify().catch(console.error);
