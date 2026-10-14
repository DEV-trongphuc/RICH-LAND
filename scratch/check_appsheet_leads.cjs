const fs = require('fs');

const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

// Parse LEADS ids
let pos = 0;
const leadIds = new Set();
while (true) {
  const i = sqlDump.indexOf('INSERT INTO `LEADS`', pos);
  if (i === -1) break;
  const e = sqlDump.indexOf(';\n', i);
  const block = sqlDump.slice(i, e);
  pos = e + 2;
  const matches = block.matchAll(/\('([^']+)'/g);
  for (const m of matches) {
    leadIds.add(m[1]);
  }
}

console.log('Total LEADS ids in AppsheetRLVN.sql:', leadIds.size);

// Parse DUYET_NOTLEAD lead_ids
pos = 0;
let approvedLeadIds = 0;
let matched = 0;
while (true) {
  const i = sqlDump.indexOf('INSERT INTO `DUYET_NOTLEAD`', pos);
  if (i === -1) break;
  const e = sqlDump.indexOf(';\n', i);
  const block = sqlDump.slice(i, e);
  pos = e + 2;
  const matches = block.matchAll(/\('[^']+',\s*'([^']+)',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'Đã duyệt'/g);
  for (const m of matches) {
    approvedLeadIds++;
    if (leadIds.has(m[1])) matched++;
  }
}

console.log('Approved DUYET_NOTLEAD rows:', approvedLeadIds);
console.log('Matched against Appsheet LEADS.id:', matched);
