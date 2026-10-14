const { query } = require('./query.cjs');

async function checkReattribution() {
  console.log('Checking how many contacts with owner_id = 1003 have notes from real sales reps...');
  const res = await query(`
    SELECT c.id, c.owner_id, 
           (SELECT n.user_id FROM notes n WHERE n.entity_type = 'contact' AND n.entity_id = c.id AND n.user_id != 1003 ORDER BY n.id DESC LIMIT 1) as real_rep_id
    FROM contacts c
    WHERE c.owner_id = 1003
    HAVING real_rep_id IS NOT NULL;
  `);

  console.log(`Found ${res.count || (res.data ? res.data.length : 0)} contacts that can be immediately re-attributed to their real sales reps!`);
  if (res.data && res.data.length > 0) {
    console.log('Sample re-attributions:', res.data.slice(0, 5));
  }
}

checkReattribution();
