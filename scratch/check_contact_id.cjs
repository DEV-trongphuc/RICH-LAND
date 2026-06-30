const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../backend');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.sql')) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.toLowerCase().includes('contact_id')) {
      console.log(`Found in: ${file}`);
      // Find lines containing contact_id
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('contact_id') && line.toLowerCase().includes('activities')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
