const fs = require('fs');

const content = fs.readFileSync('D:\\Downloads\\AppsheetRLVN.sql', 'utf8');
const match = content.match(/CREATE TABLE [`"]?LEADS[`"]?\s*\(([\s\S]*?)\)\s*ENGINE/i);
if (match) {
  console.log('Columns of LEADS table in AppsheetRLVN.sql:');
  const lines = match[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('PRIMARY') && !l.startsWith('KEY'));
  lines.forEach((l, idx) => console.log(`  ${idx + 1}. ${l}`));
} else {
  console.log('Table LEADS not found in AppsheetRLVN.sql');
}
