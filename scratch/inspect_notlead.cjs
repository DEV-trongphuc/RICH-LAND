const fs = require('fs');

const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

// CREATE TABLE `DUYET_NOTLEAD`
let idx = sqlDump.indexOf('CREATE TABLE `DUYET_NOTLEAD`');
if (idx !== -1) {
  console.log('=== CREATE TABLE DUYET_NOTLEAD ===');
  console.log(sqlDump.slice(idx, idx + 1000));
}

// CREATE TABLE `LEADS`
idx = sqlDump.indexOf('CREATE TABLE `LEADS`');
if (idx !== -1) {
  console.log('=== CREATE TABLE LEADS ===');
  console.log(sqlDump.slice(idx, idx + 1000));
}

// Check how many rows in DUYET_NOTLEAD
let count = 0;
let pos = 0;
while (true) {
  const i = sqlDump.indexOf('INSERT INTO `DUYET_NOTLEAD`', pos);
  if (i === -1) break;
  const e = sqlDump.indexOf(';\n', i);
  const block = sqlDump.slice(i, e);
  pos = e + 2;
  // count tuples
  const m = block.match(/\(/g);
  if (m) count += m.length;
}
console.log('Total DUYET_NOTLEAD tuples:', count);
