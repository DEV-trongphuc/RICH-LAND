const fs = require('fs');

const content = fs.readFileSync('src/pages/CustomerProfileDrawer.tsx', 'utf8');
const lines = content.split('\n');

console.log('Searching for notes rendering in CustomerProfileDrawer...');
lines.forEach((line, idx) => {
  if (line.includes('notes.') || line.includes('notes?.')) {
    if (line.includes('map') || line.includes('length') || line.includes('forEach') || line.includes('render')) {
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  }
});
