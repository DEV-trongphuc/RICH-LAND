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
  console.log('=== NIGHT SHIFT REGISTRATIONS ===');
  const nsr = await query('SELECT * FROM night_shift_registrations');
  console.log(JSON.stringify(nsr, null, 2));

  console.log('=== SYSTEM SETTINGS FOR NIGHT SHIFT ===');
  const ss = await query("SELECT * FROM system_settings WHERE setting_key IN ('night_shift_start_time', 'night_shift_end_time', 'auto_approve_night_shift', 'global_work_start_time', 'global_work_end_time')");
  console.log(JSON.stringify(ss, null, 2));

  console.log('=== CONSULTANTS IN ROUND 2 ===');
  const c = await query("SELECT c.id, c.name, c.email, c.is_active, c.work_start_time, c.work_end_time FROM round_consultants rc JOIN consultants c ON rc.consultant_id = c.id WHERE rc.round_id = 2");
  console.log(JSON.stringify(c, null, 2));
}

main().catch(console.error);
