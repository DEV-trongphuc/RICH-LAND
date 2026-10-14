const { query } = require('./query.cjs');

async function check() {
  const contactId = 10797;
  
  // 1. Check notes for contact 10797
  const notes = await query(`
    SELECT id, body, created_at, user_id 
    FROM notes 
    WHERE entity_type = 'contact' AND entity_id = ${contactId}
    ORDER BY created_at DESC;
  `);
  console.log(`Contact ${contactId} has ${notes.data?.length} notes in 'notes' table:`, notes.data);

  // 2. Check activities for contact 10797
  const acts = await query(`
    SELECT id, subject, body, type, created_at 
    FROM activities 
    WHERE related_type = 'contact' AND related_id = ${contactId}
    ORDER BY created_at DESC;
  `);
  console.log(`Contact ${contactId} has ${acts.data?.length} activities in 'activities' table:`, acts.data);
}

check();
