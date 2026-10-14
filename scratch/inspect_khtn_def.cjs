const fs = require('fs');

const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

// Find CREATE TABLE `KHTN`
const createIdx = sqlDump.indexOf('CREATE TABLE `KHTN`');
if (createIdx !== -1) {
  console.log(sqlDump.slice(createIdx, createIdx + 1500));
} else {
  // Let's find columns from INSERT INTO `KHTN`
  const insertIdx = sqlDump.indexOf('INSERT INTO `KHTN`');
  console.log(sqlDump.slice(insertIdx, insertIdx + 500));
}
