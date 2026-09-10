const https = require('https');
const fs = require('fs');
const path = require('path');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    }).on('error', reject);
  });
}

async function runAudit() {
  console.log("==================================================");
  console.log("   AUDIT 1: TELEGRAM & NOTIFICATION SETTINGS      ");
  console.log("==================================================");

  const settings = await queryDb("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%telegram%' OR setting_key LIKE '%zalo%' OR setting_key LIKE '%bot%' OR setting_key LIKE '%capi%' OR setting_key LIKE '%notify%' ORDER BY setting_key ASC");
  console.log("System Settings:", JSON.stringify(settings.data, null, 2));

  console.log("\n==================================================");
  console.log("   AUDIT 2: USERS TELEGRAM & ZALO LINKAGE         ");
  console.log("==================================================");
  const userLinks = await queryDb("SELECT id, username, full_name, role, status, telegram_chat_id, zalo_chat_id, email FROM users WHERE status = 'active' LIMIT 30");
  console.log("Active Users Notification Bindings:", JSON.stringify(userLinks.data, null, 2));

  console.log("\n==================================================");
  console.log("   AUDIT 3: TELEGRAM & NOTIFICATION QUEUE/LOGS   ");
  console.log("==================================================");
  const tgQueue = await queryDb("SELECT COUNT(*) AS total_tg_queue FROM telegram_queue");
  console.log("Telegram Queue Count:", tgQueue.data);
  const commLogs = await queryDb("SELECT type, status, COUNT(*) as cnt FROM communication_logs GROUP BY type, status");
  console.log("Communication Logs Stats:", commLogs.data);

  console.log("\n==================================================");
  console.log("   AUDIT 4: KEY TABLE SCHEMAS (COLUMNS CHECK)    ");
  console.log("==================================================");
  const tablesToCheck = [
    'leads', 'contacts', 'deals', 'deposits', 'cooperation_slips', 
    'activities', 'activity_comments', 'notes', 'note_mentions', 
    'tags', 'entity_tags', 'pipelines', 'pipeline_stages', 
    'distribution_rounds', 'distribution_logs', 'capi_logs'
  ];

  for (const tbl of tablesToCheck) {
    const desc = await queryDb(`DESCRIBE \`${tbl}\``);
    if (desc.data) {
      console.log(`Table \`${tbl}\`: ${desc.data.length} columns (e.g. ${desc.data.slice(0, 8).map(c => c.Field).join(', ')}...)`);
    } else {
      console.log(`Table \`${tbl}\`: ERROR or MISSING:`, desc);
    }
  }

  console.log("\n==================================================");
  console.log("   AUDIT 5: NOTE MENTIONS & COMMENTS SAMPLES      ");
  console.log("==================================================");
  const noteMentions = await queryDb("SELECT * FROM note_mentions LIMIT 10");
  console.log("Note mentions count/samples:", noteMentions);

  const actComments = await queryDb("SELECT * FROM activity_comments LIMIT 10");
  console.log("Activity comments count/samples:", actComments);

  console.log("\n==================================================");
  console.log("   AUDIT 6: DEPOSIT CANCELLATIONS (BỂ CỌC) DATA   ");
  console.log("==================================================");
  const depositsData = await queryDb("SELECT id, contact_id, status, price, expected_commission, actual_commission, cancellation_reason, created_at, updated_at FROM deposits WHERE status IN ('cancelled', 'failed', 'refunded') LIMIT 10");
  console.log("Cancelled deposits sample:", depositsData.data);

  console.log("\n==================================================");
  console.log("   AUDIT 7: CAPI LOGS SAMPLE                      ");
  console.log("==================================================");
  const capiLogs = await queryDb("SELECT * FROM capi_logs ORDER BY id DESC LIMIT 10");
  console.log("CAPI logs sample:", capiLogs.data);

  console.log("\n==================================================");
  console.log("   AUDIT 8: PIPELINES & STAGES                    ");
  console.log("==================================================");
  const pipelines = await queryDb("SELECT * FROM pipelines");
  console.log("Pipelines:", pipelines.data);
  const stages = await queryDb("SELECT id, pipeline_id, name, stage_order, color, is_won, is_lost FROM pipeline_stages ORDER BY pipeline_id, stage_order ASC");
  console.log("Pipeline stages count:", stages.data ? stages.data.length : 0);

  console.log("\n==================================================");
  console.log("   AUDIT 9: LEAD SOURCES & TAGS                   ");
  console.log("==================================================");
  const sources = await queryDb("SELECT DISTINCT source, COUNT(*) as cnt FROM leads GROUP BY source ORDER BY cnt DESC LIMIT 15");
  console.log("Leads by Source:", sources.data);
  const tags = await queryDb("SELECT id, name, color FROM tags LIMIT 20");
  console.log("Tags:", tags.data);
}

runAudit().catch(console.error);
