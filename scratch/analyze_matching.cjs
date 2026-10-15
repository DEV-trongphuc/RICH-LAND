const fs = require('fs');
const readline = require('readline');
const https = require('https');

function queryProd(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

function normalizePhone(p) {
  if (!p) return '';
  let clean = p.replace(/\D/g, '');
  if (clean.startsWith('84') && clean.length >= 11) {
    clean = clean.substring(2);
  }
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  return clean;
}

async function main() {
  console.log('Fetching phones from production leads...');
  // Get all phones from leads table
  const prodLeads = await queryProd("SELECT id, phone, raw_payload FROM leads");
  console.log('Total prod leads:', prodLeads.data?.length);

  const phoneMap = new Map();
  const appsheetIdMap = new Map();

  for (const row of prodLeads.data || []) {
    const norm = normalizePhone(row.phone);
    if (norm) {
      if (!phoneMap.has(norm)) phoneMap.set(norm, []);
      phoneMap.get(norm).push(row.id);
    }
    if (row.raw_payload) {
      try {
        const p = JSON.parse(row.raw_payload);
        if (p.appsheet_id) {
          appsheetIdMap.set(String(p.appsheet_id), row.id);
        }
      } catch (e) {}
    }
  }

  console.log('Unique normalized phones in prod leads:', phoneMap.size);
  console.log('Appsheet IDs found in prod leads raw_payload:', appsheetIdMap.size);

  // Read Appsheet file and count matches
  console.log('Scanning AppsheetRLVN.sql...');
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Downloads/AppsheetRLVN.sql', { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  let inLeads = false;
  let appsheetRows = 0;
  let matchedByAppsheetId = 0;
  let matchedByPhone = 0;

  rl.on('line', (line) => {
    if (line.includes('INSERT INTO `LEADS`')) {
      inLeads = true;
      return;
    }
    if (inLeads) {
      const trimmed = line.trim();
      if (trimmed.startsWith('(')) {
        appsheetRows++;
        // Quick extract id and phone
        // ('id', 'create_time', 'fullname', 'email', 'phone', ...
        const parts = trimmed.split("', '");
        if (parts.length >= 5) {
          const id = parts[0].replace(/^\('/, '').trim();
          const phone = parts[4].replace(/'/g, '').trim();
          const normP = normalizePhone(phone);

          if (appsheetIdMap.has(id)) {
            matchedByAppsheetId++;
          }
          if (normP && phoneMap.has(normP)) {
            matchedByPhone++;
          }
        }
      }
      if (trimmed.endsWith(';')) inLeads = false;
    }
  });

  rl.on('close', () => {
    console.log('--- SCAN COMPLETE ---');
    console.log('Total AppSheet LEADS rows:', appsheetRows);
    console.log('Matched by Appsheet ID:', matchedByAppsheetId);
    console.log('Matched by Phone:', matchedByPhone);
  });
}

main().catch(console.error);
