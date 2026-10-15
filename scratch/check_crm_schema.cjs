const fs = require('fs');
const content = fs.readFileSync('backend/unified_schema.sql', 'utf8');
const tables = ['leads', 'distribution_logs', 'contacts'];
tables.forEach(t => {
  const reg = new RegExp('CREATE TABLE [^`]*`?' + t + '`?\\s*\\(([\\s\\S]+?)\\)\\s*ENGINE', 'i');
  const m = content.match(reg);
  if (m) {
    console.log('=== TABLE ' + t + ' ===');
    const cols = m[1].split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('`'))
      .map(l => l.split(' ')[0]);
    console.log(cols.join(', '));
  }
});
