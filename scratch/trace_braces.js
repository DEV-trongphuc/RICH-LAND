import fs from 'fs';
const content = fs.readFileSync('backend/telegram_webhook.php', 'utf8');

const lines = content.split('\n');
let depth = 0;
let inString = false;
let stringChar = '';

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let newDepth = depth;
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (inString) {
            if (char === stringChar && line[j-1] !== '\\') {
                inString = false;
            }
        } else {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '{') {
                newDepth++;
            } else if (char === '}') {
                newDepth--;
            }
        }
    }
    if (newDepth !== depth) {
        console.log(`Line ${i + 1}: depth ${depth} -> ${newDepth} | ${line.trim().substring(0, 40)}`);
        depth = newDepth;
    }
}
console.log(`Final depth: ${depth}`);
