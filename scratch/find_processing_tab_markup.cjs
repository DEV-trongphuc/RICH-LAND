const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '../src/pages/Settings.tsx'), 'utf8');

const index = content.indexOf("Cấu hình Xử lý Fallback");
if (index !== -1) {
  // Let's print from index + 3000 to index + 7000
  console.log(content.substring(index + 3000, index + 7000));
}
