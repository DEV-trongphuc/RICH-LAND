const fs = require('fs');
const content = fs.readFileSync('backend/api.php', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('last_interaction_date') || line.includes('contact_last_contact')) {
    console.log((idx + 1) + ': ' + line.trim());
  }
});
