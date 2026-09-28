const https = require('https');

function execQuery(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Fetching all users...');
  const res = await execQuery('SELECT id, username, full_name, extra_fields_json FROM users');
  if (!res.data) {
    console.error('Failed to get users:', res);
    return;
  }

  console.log(`Found ${res.data.length} users. Migrating workspace_settings to RichLand black wallpaper...`);
  const targetBg = '/imgs/myerp_dark_brand_wallpaper.jpg';
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  let updatedCount = 0;
  for (const user of res.data) {
    let extra = {};
    if (user.extra_fields_json) {
      try {
        extra = JSON.parse(user.extra_fields_json);
      } catch (e) {
        extra = {};
      }
    }
    if (!extra || typeof extra !== 'object') extra = {};

    extra.workspace_settings = {
      ...(extra.workspace_settings || {}),
      bg: targetBg,
      cols: (extra.workspace_settings && extra.workspace_settings.cols) || 4,
      overlay: (extra.workspace_settings && extra.workspace_settings.overlay !== undefined) ? extra.workspace_settings.overlay : 0,
      updated_at: now
    };

    const newJson = JSON.stringify(extra);
    // Escape single quotes for SQL
    const escapedJson = newJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const updateSql = `UPDATE users SET extra_fields_json = '${escapedJson}' WHERE id = ${user.id}`;
    
    const updateRes = await execQuery(updateSql);
    if (updateRes.status === 'success') {
      updatedCount++;
    } else {
      console.error(`Failed to update user ${user.id} (${user.username}):`, updateRes);
    }
  }

  console.log(`Successfully migrated ${updatedCount}/${res.data.length} users!`);

  // Verification step
  console.log('\nVerifying migration...');
  const verifyRes = await execQuery("SELECT id, username, JSON_UNQUOTE(JSON_EXTRACT(extra_fields_json, '$.workspace_settings.bg')) as bg FROM users");
  const missing = verifyRes.data?.filter(u => u.bg !== targetBg) || [];
  if (missing.length === 0) {
    console.log(`All ${verifyRes.data.length} users successfully have bg = '${targetBg}'!`);
  } else {
    console.warn(`Warning: ${missing.length} users do not have the expected bg:`, missing);
  }
}

run().catch(console.error);
