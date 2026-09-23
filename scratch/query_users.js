const https = require('https');
const sql = 'SELECT id, full_name, email, role, team_id FROM users';
https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), { rejectUnauthorized: false }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(d));
});
