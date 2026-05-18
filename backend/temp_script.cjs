const fs = require('fs');
let txt = fs.readFileSync('src/pages/Rounds.tsx', 'utf8');
const newForm = fs.readFileSync('backend/temp_form.tsx', 'utf8');
const startIdx = txt.indexOf('            <form onSubmit={handleSave}');
const endIdx = txt.indexOf('            </form>') + 19;
txt = txt.substring(0, startIdx) + '            ' + newForm + txt.substring(endIdx);
txt = txt.replace('maxWidth: 540', 'maxWidth: 1000').replace('minHeight: 650', "minHeight: 500, maxHeight: '90vh'");
fs.writeFileSync('src/pages/Rounds.tsx', txt);
