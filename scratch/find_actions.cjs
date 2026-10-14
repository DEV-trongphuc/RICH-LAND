const fs = require('fs');
const content = fs.readFileSync('backend/api.php', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("case 'activities':") || line.includes("case 'notes':") || line.includes("case 'contact_notes':")) {
    console.log((idx + 1) + ': ' + line.trim());
  }
});
