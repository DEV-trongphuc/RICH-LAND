const fs = require('fs');
const file = fs.readFileSync('src/pages/DataList.tsx', 'utf8');
const lines = file.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('searchInput') || line.includes('setShowMobileFilterDrawer') || line.includes('setShowAdvancedFilterDrawer')) {
    console.log(`L${idx + 1}: ${line.trim().slice(0, 100)}`);
  }
});
