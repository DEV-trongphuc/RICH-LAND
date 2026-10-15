const fs = require('fs');

const file = fs.readFileSync('src/pages/SalePortal.tsx', 'utf8');
const lines = file.split('\n');

console.log('Total lines:', lines.length);

lines.forEach((line, idx) => {
  if (line.includes('SalePortal') || line.includes('fetchLeads') || line.includes('api_leads') || line.includes('action=get_leads') || line.includes('action=leads')) {
    console.log(`L${idx + 1}: ${line.trim().slice(0, 120)}`);
  }
});
