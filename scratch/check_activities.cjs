const { query } = require('./query.cjs');
async function f() {
  const actStats = await query(`
    SELECT COUNT(*) as total_activities, COUNT(DISTINCT related_id) as distinct_contacts
    FROM activities;
  `);
  console.log('activities stats:', actStats.data);

  const sampleAct = await query(`
    SELECT id, type, subject, related_type, related_id, user_id, created_at
    FROM activities
    LIMIT 5;
  `);
  console.log('sample activities:', sampleAct.data);
}
f().catch(console.error);
