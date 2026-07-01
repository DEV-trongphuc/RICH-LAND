const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '../backend/controllers/ContactController.php'), 'utf8');

let idx = 0;
let occurrences = [];
while ((idx = content.indexOf('pipeline_status', idx)) !== -1) {
  occurrences.push(idx);
  idx += 'pipeline_status'.length;
}

console.log("pipeline_status found in ContactController.php at positions:", occurrences);
if (occurrences.length > 0) {
  occurrences.forEach(pos => {
    console.log("Context around:", content.substring(pos - 100, pos + 100));
  });
}
