const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('D:/Downloads/AppsheetRLVN.sql', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

let inLeadsInsert = false;
let insertHeader = '';
let sampleRows = [];

rl.on('line', (line) => {
  if (line.startsWith('INSERT INTO `LEADS`')) {
    inLeadsInsert = true;
    insertHeader = line;
    return;
  }
  if (inLeadsInsert) {
    if (sampleRows.length < 3 && line.trim().startsWith('(')) {
      sampleRows.push(line.trim());
    }
    if (line.trim().endsWith(';')) {
      inLeadsInsert = false;
    }
  }
});

rl.on('close', () => {
  console.log('INSERT HEADER:');
  console.log(insertHeader);
  console.log('\nSAMPLE ROWS:');
  sampleRows.forEach((r, idx) => {
    console.log(`\n--- ROW ${idx + 1} ---`);
    console.log(r.substring(0, 1000));
  });
});
