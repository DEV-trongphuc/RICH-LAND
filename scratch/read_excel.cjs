const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = 'D:\\Downloads\\Danh sách vấn đề CRM.xlsx';
console.log('Exists:', fs.existsSync(filePath));

const wb = xlsx.readFile(filePath);
console.log('Sheets:', wb.SheetNames);

wb.SheetNames.forEach(name => {
  console.log(`\n=== SHEET: ${name} ===`);
  const sheet = wb.Sheets[name];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  data.forEach((row, i) => {
    if (row.some(c => String(c).trim() !== '')) {
      console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
    }
  });
});
