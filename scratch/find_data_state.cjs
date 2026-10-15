const fs = require('fs');
const file = fs.readFileSync('src/pages/SalePortal.tsx', 'utf8');
const lines = file.split('\n');

lines.forEach((line, idx) => {
  if (line.match(/const\s+\[\s*data\s*,/i) || line.match(/setData\(/) || line.match(/data\.leads/)) {
    console.log(`L${idx + 1}: ${line.trim().slice(0, 100)}`);
  }
});
