const fs = require('fs');
const { query } = require('./query.cjs');

async function buildStaffMap() {
  console.log('1. Loading users from live CRM...');
  const usersRes = await query("SELECT id, username, email, full_name, phone, role, status FROM users;");
  const liveUsers = usersRes.data || [];
  console.log(`Live DB has ${liveUsers.length} users.`);

  console.log('2. Parsing NHAN_VIEN from AppSheet dump...');
  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
  
  // Extract all NHAN_VIEN inserts
  const nvMatches = content.match(/INSERT\s+INTO\s+`NHAN_VIEN`[^;]+;/gis);
  const staffRecords = [];

  function splitTupleValues(tupleStr) {
    const vals = [];
    let inQuote = false;
    let quoteChar = '';
    let isEscaped = false;
    let currentVal = '';

    for (let i = 0; i < tupleStr.length; i++) {
      const ch = tupleStr[i];
      if (isEscaped) {
        currentVal += ch;
        isEscaped = false;
        continue;
      }
      if (ch === '\\') {
        isEscaped = true;
        currentVal += ch;
        continue;
      }
      if (!inQuote && (ch === "'" || ch === '"')) {
        inQuote = true;
        quoteChar = ch;
        continue;
      }
      if (inQuote && ch === quoteChar) {
        inQuote = false;
        continue;
      }
      if (!inQuote && ch === ',') {
        vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim().replace(/^'|'$/g, ''));
        currentVal = '';
        continue;
      }
      currentVal += ch;
    }
    vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim().replace(/^'|'$/g, ''));
    return vals;
  }

  function parseSqlTuples(block) {
    const tuples = [];
    let inTuple = false;
    let inQuote = false;
    let quoteChar = '';
    let isEscaped = false;
    let currentTuple = '';

    for (let i = 0; i < block.length; i++) {
      const ch = block[i];
      if (isEscaped) {
        if (inTuple) currentTuple += ch;
        isEscaped = false;
        continue;
      }
      if (ch === '\\') {
        isEscaped = true;
        if (inTuple) currentTuple += ch;
        continue;
      }
      if (!inQuote && (ch === "'" || ch === '"')) {
        inQuote = true;
        quoteChar = ch;
        if (inTuple) currentTuple += ch;
        continue;
      }
      if (inQuote && ch === quoteChar) {
        inQuote = false;
        if (inTuple) currentTuple += ch;
        continue;
      }
      if (!inQuote && ch === '(') {
        inTuple = true;
        currentTuple = '';
        continue;
      }
      if (!inQuote && ch === ')') {
        inTuple = false;
        tuples.push(currentTuple);
        currentTuple = '';
        continue;
      }
      if (inTuple) {
        currentTuple += ch;
      }
    }
    return tuples;
  }

  if (nvMatches) {
    nvMatches.forEach(b => {
      const tuples = parseSqlTuples(b);
      tuples.forEach(t => {
        const p = splitTupleValues(t);
        if (p[0] === '`id`' || p[0] === 'id') return;
        // NHAN_VIEN columns:
        // 0: id, 1: ho_ten, 2: phone, 3: email, ...
        staffRecords.push({
          id: p[0],
          ho_ten: p[1] || '',
          phone: p[2] || '',
          email: p[12] || p[3] || '',
          username: p[10] || ''
        });
      });
    });
  }

  console.log(`Parsed ${staffRecords.length} staff records from AppSheet.`);

  const staffMap = {}; // AppSheet ID -> CRM User ID
  let matchedCount = 0;

  // Find Admin MTP user
  const adminUser = liveUsers.find(u => u.username === 'admin' || u.id === '1003' || u.role === 'admin') || liveUsers[0];
  const defaultOwnerId = adminUser ? parseInt(adminUser.id) : 1003;

  for (const s of staffRecords) {
    const sName = s.ho_ten.trim().toLowerCase().normalize('NFC');
    const sEmail = s.email ? s.email.trim().toLowerCase() : '';
    const sUser = s.username ? s.username.trim().toLowerCase() : '';

    const match = liveUsers.find(u => {
      const uEmail = u.email ? u.email.trim().toLowerCase() : '';
      const uName = u.full_name ? u.full_name.trim().toLowerCase().normalize('NFC') : '';
      const uUser = u.username ? u.username.trim().toLowerCase() : '';

      if (sUser && uEmail && sUser === uEmail) {
        return true;
      }
      if (sEmail && uEmail && sEmail === uEmail && !['phongkinhdoanh.as001@gmail.com', 'phongkinhdoanh.as002@gmail.com', 'hethong@richland.city'].includes(sEmail)) {
        return true;
      }
      if (sUser && uUser && sUser.includes(uUser)) {
        return true;
      }
      if (sName.replace(/òa/g, 'oà') === uName.replace(/òa/g, 'oà')) {
        return true;
      }
      return false;
    });

    if (match) {
      staffMap[s.id] = parseInt(match.id);
      matchedCount++;
    } else {
      console.log(`Unmatched staff: [${s.id}] ${s.ho_ten} | ${s.email} | ${s.username}`);
      staffMap[s.id] = defaultOwnerId;
    }
  }

  // Also handle ADMIN1, ADMIN, UNASSIGNED
  staffMap['ADMIN1'] = defaultOwnerId;
  staffMap['ADMIN'] = defaultOwnerId;
  staffMap['UNASSIGNED'] = defaultOwnerId;

  console.log(`\nMatched ${matchedCount}/${staffRecords.length} staff.`);
  fs.writeFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\staff_map.json', JSON.stringify(staffMap, null, 2));
  console.log('Saved staff_map.json successfully!');
}

buildStaffMap();
