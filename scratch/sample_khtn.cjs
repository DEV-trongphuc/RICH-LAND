const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

// Find KHTN insert
const khtnMatches = content.match(/INSERT INTO `KHTN`[^;]+;/s);
if (!khtnMatches) {
  console.log('No KHTN insert found');
  process.exit(1);
}

// Split into row lines
const lines = khtnMatches[0].split('\n').filter(l => l.trim().startsWith('('));
console.log(`Total KHTN lines: ${lines.length}`);

// Inspect sample chan_dung
let formCount = 0;
let dateNoteCount = 0;
const sampleForms = [];
const sampleDateNotes = [];

lines.slice(0, 1000).forEach(l => {
  // Regex to extract column 6 (chan_dung)
  // Let's parse columns properly
  const cols = [];
  let inQuote = false;
  let cur = '';
  let escapeNext = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (escapeNext) {
      cur += c;
      escapeNext = false;
    } else if (c === '\\') {
      cur += c;
      escapeNext = true;
    } else if (c === "'") {
      inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur.trim());

  const chanDung = (cols[6] || '').replace(/^'|'$/g, '').replace(/\\'/g, "'").replace(/\\n/g, '\n');
  if (/FORM phản hồi/i.test(chanDung) || /THÔNG TIN LIÊN HỆ/i.test(chanDung) || /NHU CẦU KHÁCH HÀNG/i.test(chanDung)) {
    formCount++;
    if (sampleForms.length < 3) sampleForms.push(chanDung);
  }
  if (/\b\d{1,2}\/\d{1,2}/.test(chanDung)) {
    dateNoteCount++;
    if (sampleDateNotes.length < 3) sampleDateNotes.push(chanDung);
  }
});

console.log(`In first 1000 rows: formCount=${formCount}, dateNoteCount=${dateNoteCount}`);
console.log('\n--- SAMPLE FORM ---');
console.log(sampleForms[0]);
console.log('\n--- SAMPLE DATE NOTE ---');
console.log(sampleDateNotes[0]);
