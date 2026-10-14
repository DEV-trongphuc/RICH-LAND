const fs = require('fs');
const content = fs.readFileSync('backend/api.php', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("'get_activities'") || line.includes('"get_activities"') || line.includes("'get_notes'") || line.includes('"get_notes"')) {
    console.log((idx + 1) + ': ' + line.trim());
  }
});
