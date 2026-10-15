const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('D:/Downloads/AppsheetRLVN.sql', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

let currentTable = null;
const tableDefs = {};

rl.on('line', (line) => {
  const m = line.match(/CREATE\s+TABLE\s+`([^`]+)`/i);
  if (m) {
    currentTable = m[1];
    tableDefs[currentTable] = [];
    return;
  }
  if (currentTable) {
    if (line.trim().startsWith(') ENGINE=') || line.trim().startsWith(');')) {
      currentTable = null;
    } else {
      tableDefs[currentTable].push(line);
    }
  }
});

rl.on('close', () => {
  const rest = ['BOTCALL', 'LOC', 'LS_CSKH', 'LS_GIAODICH', 'THU_HOI_LOGS', 'TRANG_THAI'];
  for (const tbl of rest) {
    console.log('==================================================');
    console.log('TABLE:', tbl);
    if (tableDefs[tbl]) {
      tableDefs[tbl].forEach(col => {
        const trimmed = col.trim();
        if (trimmed.startsWith('`')) {
          console.log('  ' + trimmed.replace(/,$/, ''));
        }
      });
    }
  }
});
