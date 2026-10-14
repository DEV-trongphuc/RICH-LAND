const { query } = require('./query.cjs');

async function addIndexes() {
  console.log('Adding indexes...');
  let res = await query('ALTER TABLE distribution_logs ADD INDEX idx_dist_logs_received_at (received_at);');
  console.log('distribution_logs(received_at):', res);

  res = await query('ALTER TABLE distribution_logs ADD INDEX idx_dist_logs_lead_id_id (lead_id, id);');
  console.log('distribution_logs(lead_id, id):', res);

  res = await query('ALTER TABLE contacts ADD INDEX idx_contacts_person_pipe_del (person_id, pipeline_status, deleted_at);');
  console.log('contacts(person_id, pipeline_status, deleted_at):', res);
}

addIndexes();
