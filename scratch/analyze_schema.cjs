const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../backend/db_schema.json');
const raw = fs.readFileSync(schemaPath, 'utf8');
const data = JSON.parse(raw);
const schema = data.schema;

console.log("Total tables in db_schema.json:", Object.keys(schema).length);

const keyTables = [
  'leads', 'contacts', 'deals', 'deposits', 'cooperation_slips',
  'activities', 'activity_comments', 'notes', 'note_mentions',
  'tags', 'entity_tags', 'pipeline_stages', 'persons',
  'distribution_rounds', 'distribution_logs', 'round_consultants',
  'capi_logs', 'communication_logs', 'system_settings',
  'users', 'teams', 'tenants', 'notifications', 'telegram_queue',
  'mail_queue', 'zalo_queue', 'user_notification_settings'
];

console.log("\n=== KEY TABLES AUDIT ===");
for (const t of keyTables) {
  if (schema[t]) {
    const cols = schema[t].map(c => `${c.field} (${c.type})`);
    console.log(`\nTable [${t}] - ${cols.length} cols:`);
    console.log("  " + cols.join(', '));
  } else {
    console.log(`\nTable [${t}] - MISSING!`);
  }
}
