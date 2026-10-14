const { query } = require('./query.cjs');

async function fixNewlines() {
  console.log('1. Checking literal \\n in contacts.notes...');
  const resNotes = await query("SELECT COUNT(*) as count FROM contacts WHERE notes LIKE '%\\\\n%';");
  console.log('Contacts with literal \\n in notes:', resNotes.data);

  console.log('2. Checking literal \\n in contacts.ttl1_data...');
  const resTtl1 = await query("SELECT COUNT(*) as count FROM contacts WHERE ttl1_data LIKE '%\\\\\\\\n%';");
  console.log('Contacts with literal \\\\n in ttl1_data:', resTtl1.data);

  console.log('3. Checking literal \\n in notes.body...');
  const resBody = await query("SELECT COUNT(*) as count FROM notes WHERE body LIKE '%\\\\n%';");
  console.log('Notes with literal \\n in body:', resBody.data);
}

fixNewlines();
