const { query } = require('./query.cjs');

async function cleanAllNewlines() {
  console.log('1. Fixing literal \\n in contacts.notes...');
  const res1 = await query("UPDATE contacts SET notes = REPLACE(notes, '\\\\n', '\n') WHERE notes LIKE '%\\\\n%';");
  console.log('Fixed contacts.notes:', res1);

  console.log('2. Fixing literal \\n in notes.body...');
  const res2 = await query("UPDATE notes SET body = REPLACE(body, '\\\\n', '\n') WHERE body LIKE '%\\\\n%';");
  console.log('Fixed notes.body:', res2);

  console.log('3. Fixing literal \\n in notes.client_feedback...');
  const res3 = await query("UPDATE notes SET client_feedback = REPLACE(client_feedback, '\\\\n', '\n') WHERE client_feedback LIKE '%\\\\n%';");
  console.log('Fixed notes.client_feedback:', res3);

  console.log('4. Fixing literal \\n in contacts.ttl1_data...');
  // In ttl1_data (JSON), we need to replace '\\\\n' with '\n'
  const res4 = await query("UPDATE contacts SET ttl1_data = REPLACE(ttl1_data, '\\\\n', '\\n') WHERE ttl1_data LIKE '%\\\\\\\\n%';");
  console.log('Fixed contacts.ttl1_data:', res4);

  console.log('5. Re-checking remaining literal \\n...');
  const checkNotes = await query("SELECT COUNT(*) as count FROM contacts WHERE notes LIKE '%\\\\n%';");
  const checkBody = await query("SELECT COUNT(*) as count FROM notes WHERE body LIKE '%\\\\n%';");
  const checkTtl1 = await query("SELECT COUNT(*) as count FROM contacts WHERE ttl1_data LIKE '%\\\\\\\\n%';");
  console.log('Remaining in contacts.notes:', checkNotes.data);
  console.log('Remaining in notes.body:', checkBody.data);
  console.log('Remaining in contacts.ttl1_data:', checkTtl1.data);
}

cleanAllNewlines();
