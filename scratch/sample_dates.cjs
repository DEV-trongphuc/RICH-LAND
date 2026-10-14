const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

const sampleDates = new Set();
const matches = content.matchAll(/\('KHTN\d+.*?,\s*'([^']*)',\s*'([^']*)',\s*'(\d{1,2}\/\d{1,2}\/\d{4}[^']*)'/g);
for (const m of matches) {
  sampleDates.add(m[3]);
  if (sampleDates.size >= 10) break;
}
console.log('Sample date strings:', Array.from(sampleDates));
