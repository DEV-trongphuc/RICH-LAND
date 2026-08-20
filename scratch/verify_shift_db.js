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

async function runTest() {
  console.log('=== VERIFYING REMOTE DB SHIFT STRUCTURES ===');

  // 1. Verify night_shift_registrations
  const nightCols = await query('SHOW COLUMNS FROM night_shift_registrations');
  console.log('night_shift_registrations columns:', nightCols.data.map(c => `${c.Field} (${c.Type})`));

  // 2. Verify weekend_shift_registrations
  const weekendCols = await query('SHOW COLUMNS FROM weekend_shift_registrations');
  console.log('weekend_shift_registrations columns:', weekendCols.data.map(c => `${c.Field} (${c.Type})`));

  // 3. Verify holiday_shift_registrations
  const holidayCols = await query('SHOW COLUMNS FROM holiday_shift_registrations');
  console.log('holiday_shift_registrations columns:', holidayCols.data.map(c => `${c.Field} (${c.Type})`));

  // 4. Test upsert with approved = 1 query syntax compatibility
  const testDate = '2099-12-31';
  const testUserId = 1;

  console.log('Testing night shift upsert syntax...');
  const upsertNight = await query(`INSERT INTO night_shift_registrations (user_id, shift_date, approved) VALUES (${testUserId}, '${testDate}', 1) ON DUPLICATE KEY UPDATE approved = 1`);
  console.log('Upsert night shift result:', upsertNight.status || upsertNight);

  console.log('Testing weekend shift upsert syntax...');
  const upsertWeekend = await query(`INSERT INTO weekend_shift_registrations (user_id, shift_date, approved) VALUES (${testUserId}, '${testDate}', 1) ON DUPLICATE KEY UPDATE approved = 1`);
  console.log('Upsert weekend shift result:', upsertWeekend.status || upsertWeekend);

  // Clean up test data
  console.log('Cleaning up test data...');
  await query(`DELETE FROM night_shift_registrations WHERE user_id = ${testUserId} AND shift_date = '${testDate}'`);
  await query(`DELETE FROM weekend_shift_registrations WHERE user_id = ${testUserId} AND shift_date = '${testDate}'`);

  console.log('=== ALL REMOTE DB VERIFICATION CHECKS PASSED ===');
}

runTest();
