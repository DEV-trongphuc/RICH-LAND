const fs = require('fs');
const file = fs.readFileSync('backend/cron_sync.php', 'utf8');
const lines = file.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('UPDATE leads SET')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
