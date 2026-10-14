const fs = require('fs');

console.log("Reading AppsheetRLVN.sql...");
const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

// Parse LEADS_KHOCHUNG
console.log("Parsing LEADS_KHOCHUNG...");
const databankLeadIds = new Set();
const khoMatches = content.matchAll(/\('[^']*',\s*'[^']*',\s*'([^']*)'/g);
for (const m of khoMatches) {
  if (m[1]) databankLeadIds.add(m[1].trim());
}
console.log(`Captured ${databankLeadIds.size} distinct lead IDs in LEADS_KHOCHUNG.`);

// Parse LEADS
console.log("Parsing LEADS...");
const mLeads = content.match(/INSERT INTO `LEADS` [^;]+;/gs);
console.log(`Found ${mLeads ? mLeads.length : 0} LEADS insert blocks.`);

let totalLeads = 0;
const leadsSample = [];
if (mLeads) {
  for (const block of mLeads) {
    const lines = block.split('\n').filter(l => l.trim().startsWith('('));
    totalLeads += lines.length;
    if (leadsSample.length < 3 && lines.length > 0) {
      leadsSample.push(lines[0]);
    }
  }
}
console.log(`Total LEADS rows parsed: ${totalLeads}`);
console.log("Sample row 1:", leadsSample[0] ? leadsSample[0].slice(0, 150) : 'none');
