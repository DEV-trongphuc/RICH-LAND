const fs = require('fs');
const file = fs.readFileSync('src/pages/DataList.tsx', 'utf8');

const vars = [
  'projectFilter',
  'projectsList',
  'leadPhanLoaiFilter',
  'availableLeadPhanLoai',
  'donviChayFilter',
  'availableDonviChay',
  'showAdvancedFilterDrawer',
  'setShowAdvancedFilterDrawer'
];

vars.forEach(v => {
  console.log(`${v}: ${file.includes(v) ? 'EXISTS' : 'NOT FOUND'}`);
});
