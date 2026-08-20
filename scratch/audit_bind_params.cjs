const fs = require('fs');
const path = require('path');

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const bindRegex = /\$([a-zA-Z0-9_]+)->bind_param\s*\(\s*(['"])([a-zA-Z]+)\2\s*,\s*(.+?)\);/g;
  
  let match;
  let errorCount = 0;
  
  while ((match = bindRegex.exec(content)) !== null) {
    const stmtVar = match[1];
    const typeStr = match[3];
    const argsStr = match[4];
    
    // Split arguments carefully (ignoring commas inside parentheses/brackets)
    let args = [];
    let cur = '';
    let depth = 0;
    for (let i = 0; i < argsStr.length; i++) {
      const c = argsStr[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) {
        args.push(cur.trim());
        cur = '';
        continue;
      }
      cur += c;
    }
    if (cur.trim()) args.push(cur.trim());
    
    // Check if arguments contain spread operator ...$params
    const hasSpread = args.some(a => a.startsWith('...'));
    if (hasSpread) continue;
    
    if (typeStr.length !== args.length) {
      // Find line number
      const lineNo = content.substring(0, match.index).split('\n').length;
      console.log(`❌ MISMATCH in ${path.basename(filePath)}:${lineNo}`);
      console.log(`   Type String: "${typeStr}" (length: ${typeStr.length})`);
      console.log(`   Arguments:   ${args.length} vars -> [${args.join(', ')}]`);
      console.log(`   Code:        ${match[0]}\n`);
      errorCount++;
    }
  }
  
  return errorCount;
}

const files = fs.readdirSync('backend')
  .filter(f => f.endsWith('.php'))
  .map(f => path.join('backend', f));

let totalErrors = 0;
for (const file of files) {
  totalErrors += auditFile(file);
}

if (totalErrors === 0) {
  console.log('✅ ALL bind_param calls across backend PHP files have MATCHING type definitions and variable counts!');
} else {
  console.log(`Found ${totalErrors} mismatches.`);
}
