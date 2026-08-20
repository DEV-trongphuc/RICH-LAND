const https = require('https');
const bcrypt = require('bcryptjs');

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

const salesToCreate = [
  {
    name: 'Ngọc Huyền',
    username: 'ngochuyen@richland.city',
    email: 'ngochuyen@richland.city',
    password: 'Ngochuyen2912@'
  },
  {
    name: 'Bá Dương',
    username: 'baduong@richland.city',
    email: 'baduong@richland.city',
    password: '17111997'
  },
  {
    name: 'Ngọc Hiển',
    username: 'ngochien@richland.city',
    email: 'ngochien@richland.city',
    password: 'ngochien030195'
  },
  {
    name: 'Khắc Phú',
    username: 'khacphu@richland.city',
    email: 'khacphu@richland.city',
    password: 'Phu@121998'
  },
  {
    name: 'Công Hoà',
    username: 'conghoa@richland.city',
    email: 'conghoa@richland.city',
    password: 'Conghoa@1995'
  }
];

async function main() {
  console.log('1. Checking existing users...');
  const existing = await query("SELECT id, username, email, full_name, role FROM users");
  console.log('Current users:', existing);

  for (const s of salesToCreate) {
    const salt = bcrypt.genSaltSync(10);
    // Standard bcrypt hash compatible with PHP password_verify
    const hash = bcrypt.hashSync(s.password, salt).replace(/^\$2a\$/, '$2y$').replace(/^\$2b\$/, '$2y$');
    s.hash = hash;
    
    // Check if user already exists
    const exists = existing.data && existing.data.find(u => u.email === s.email || u.username === s.username);
    if (exists) {
      console.log(`User ${s.email} already exists with ID ${exists.id}. Updating password...`);
      const updateSql = `UPDATE users SET password_hash = '${hash}', full_name = '${s.name}', role = 'sales', is_active = 1, is_confirmed = 1 WHERE id = ${exists.id}`;
      const res = await query(updateSql);
      console.log(`Update result for ${s.email}:`, res);
    } else {
      console.log(`Inserting new user ${s.name} (${s.email})...`);
      const insertSql = `INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, is_active, status, is_confirmed, team_id, work_start_time, work_end_time) VALUES (1, '${s.username}', '${s.email}', '${hash}', '${s.name}', 'sales', 1, 'active', 1, 1, '08:00', '17:30')`;
      const res = await query(insertSql);
      console.log(`Insert result for ${s.email}:`, res);
    }
  }

  console.log('\n2. Verifying users in database:');
  const verifyUsers = await query("SELECT id, tenant_id, username, email, full_name, role, status, is_active, is_confirmed, team_id FROM users");
  console.log(JSON.stringify(verifyUsers, null, 2));

  console.log('\n3. Verifying consultants view:');
  const verifyConsultants = await query("SELECT id, name, email, role, status, is_active, team_id FROM consultants");
  console.log(JSON.stringify(verifyConsultants, null, 2));
}

main().catch(console.error);
