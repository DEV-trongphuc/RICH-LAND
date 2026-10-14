const fs = require('fs');

const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

const regex = /CREATE TABLE `([^`]+)`/g;
let m;
const tables = [];
while ((m = regex.exec(sqlDump)) !== null) {
  tables.push(m[1]);
}

console.log('Tables in AppsheetRLVN.sql:', tables);
