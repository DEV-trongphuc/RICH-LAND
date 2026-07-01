const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '../src/pages/Settings.tsx'), 'utf8');

const index = 125327;
console.log(content.substring(index - 100, index + 1500));
