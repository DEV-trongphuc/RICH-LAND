const fs = require('fs');

const file = fs.readFileSync('src/pages/SalePortal.tsx', 'utf8');
const lines = file.split('\n');

for (let i = 1090; i < 1180; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
