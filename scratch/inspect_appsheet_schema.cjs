const fs = require('fs');

const sqlPath = 'D:\\Downloads\\AppsheetRLVN.sql';
console.log('Reading file:', sqlPath);

const content = fs.readFileSync(sqlPath, 'utf8');

const tables = [];
const regex = /CREATE TABLE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(([\s\S]*?)\)\s*ENGINE/gi;
let match;
while ((match = regex.exec(content)) !== null) {
  const tableName = match[1];
  const body = match[2];
  const cols = [];
  const bodyLines = body.split('\n');
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('PRIMARY') && !trimmed.startsWith('KEY') && !trimmed.startsWith('UNIQUE') && !trimmed.startsWith('CONSTRAINT')) {
      const colMatch = trimmed.match(/^[`"]?([a-zA-Z0-9_]+)[`"]?\s+(.*)/);
      if (colMatch) {
        cols.push({ name: colMatch[1], type: colMatch[2].replace(/,$/, '') });
      }
    }
  }
  
  // Count INSERT statements for this table
  const insertRegex = new RegExp(`INSERT INTO [\`"]?${tableName}[\`"]?`, 'gi');
  const insertMatches = content.match(insertRegex);
  const insertCount = insertMatches ? insertMatches.length : 0;

  tables.push({ name: tableName, cols, insertCount });
}

console.log('=== TABLES IN APPSHEET DUMP ===');
tables.forEach(t => {
  console.log(`- ${t.name}: ${t.cols.length} columns, ${t.insertCount} INSERT statements`);
});

// Write full schema details to scratch/appsheet_schema_details.json
fs.writeFileSync('scratch/appsheet_schema_details.json', JSON.stringify(tables, null, 2), 'utf8');
console.log('Saved schema details to scratch/appsheet_schema_details.json');
