const fs = require('fs');

const details = JSON.parse(fs.readFileSync('scratch/appsheet_schema_details.json', 'utf8'));

console.log('=== COLUMNS OF KEY TABLES ===');
const keyTables = ['KHTN', 'LS_CSKH', 'LS_CSKH_bangphu', 'DUYET_NOTLEAD', 'NHAN_VIEN', 'THU_HOI_LOGS'];

keyTables.forEach(tableName => {
  const t = details.find(x => x.name.toLowerCase() === tableName.toLowerCase());
  if (t) {
    console.log(`\nTable [${t.name}]:`);
    t.cols.forEach((c, idx) => {
      const isSpecial = /ttl|r3|rank|phan_loai|loai|trang_thai|nhan_vien|sale|cskh|ngay/i.test(c.name);
      console.log(`  ${idx + 1}. ${c.name} (${c.type}) ${isSpecial ? '⭐' : ''}`);
    });
  }
});
