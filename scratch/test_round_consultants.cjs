const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), (res) => {
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
  console.log('=== TEST CONSULTANTS QUERY FOR ROUND 2 ===');
  const sql = `
    SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
           rc.data_per_turn, rc.current_turn_remaining, 0 as skipped_credit,
           c.vacation_mode, c.leave_start, c.leave_end, c.work_start_time, c.work_end_time, c.work_schedule
    FROM round_consultants rc 
    JOIN consultants c ON rc.consultant_id = c.id 
    WHERE rc.round_id = 2
      AND rc.is_active = 1 
      AND (c.status = 'active' OR c.is_active = 1)
  `;
  const res = await query(sql);
  console.log(JSON.stringify(res, null, 2));

  console.log('=== TEST WITH c.status = "active" ONLY ===');
  const sql2 = `
    SELECT c.id, c.name, c.is_active, c.vacation_mode, c.leave_start, c.leave_end
    FROM round_consultants rc 
    JOIN consultants c ON rc.consultant_id = c.id 
    WHERE rc.round_id = 2 
      AND rc.is_active = 1 
      AND c.status = 'active'
  `;
  const res2 = await query(sql2);
  console.log(JSON.stringify(res2, null, 2));

  console.log('=== SYSTEM SETTINGS ===');
  const settings = await query("SELECT * FROM system_settings WHERE setting_key LIKE '%starvation%' OR setting_key LIKE '%round%' OR setting_key LIKE '%working%' OR setting_key LIKE '%recall%'");
  console.log(JSON.stringify(settings, null, 2));
}

main().catch(console.error);
