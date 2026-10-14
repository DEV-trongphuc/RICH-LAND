const { query } = require('./query.cjs');

async function testReplace() {
  const test1 = await query("SELECT REPLACE('line1\\\\nline2', '\\\\n', CHAR(10)) as res;");
  console.log('Test 1 (\\\\\\\\n):', JSON.stringify(test1));

  const test2 = await query("SELECT REPLACE('line1\\\\nline2', '\\\\n', '\n') as res;");
  console.log('Test 2 (\\\\\\\\n with LF):', JSON.stringify(test2));

  // Now test against contact 10830
  const sampleBefore = await query("SELECT notes FROM contacts WHERE id = 10830;");
  console.log('Contact 10830 notes before:', JSON.stringify(sampleBefore.data[0]?.notes));

  const testOnCol = await query("SELECT REPLACE(notes, '\\\\n', CHAR(10)) as cleaned FROM contacts WHERE id = 10830;");
  console.log('Contact 10830 notes after REPLACE:', JSON.stringify(testOnCol.data[0]?.cleaned));
}

testReplace();
