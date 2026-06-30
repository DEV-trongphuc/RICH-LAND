const fs = require('fs');
const path = require('path');

const unifiedContent = fs.readFileSync(path.join(__dirname, '../backend/unified_schema.sql'), 'utf8');

function getTableDDL(content, tableName) {
  const regex = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?\`?${tableName}\`?[^;]+;`, 'i');
  const match = regex.exec(content);
  return match ? match[0] : `Table ${tableName} not found`;
}

console.log("=== activities DDL in unified_schema.sql ===");
console.log(getTableDDL(unifiedContent, 'activities'));
