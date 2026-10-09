const fs = require('fs');

const content = fs.readFileSync('DATABASE_ERD_FULL.md', 'utf8');
const schema = JSON.parse(fs.readFileSync('backend/db_schema_full_live.json', 'utf8'));
const tables = Object.keys(schema.tables);

console.log('Total tables in schema:', tables.length);

const missingInDoc = [];
for (const t of tables) {
  if (!content.includes(`id="table-${t}"`)) {
    missingInDoc.push(t);
  }
}
console.log('Missing tables in document:', missingInDoc.length === 0 ? 'NONE! 100% Covered' : missingInDoc);

const mermaidBlocks = content.match(/```mermaid/g) || [];
console.log('Total Mermaid diagram blocks:', mermaidBlocks.length);

console.log('Document total length (characters):', content.length);
console.log('Document total lines:', content.split('\n').length);
