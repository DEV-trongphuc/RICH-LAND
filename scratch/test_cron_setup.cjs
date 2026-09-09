const https = require('https');
const CpanelClient = require('./cpanel_client.cjs');

async function main() {
  const client = new CpanelClient();

  console.log("1. Testing cPanel API 2 for Cron::add_line...");
  // cPanel API 2 syntax: /json-api/cpanel?cpanel_jsonapi_module=Cron&cpanel_jsonapi_func=add_line&...
  const cmd = '/usr/local/bin/ea-php82 /home/zccqvhhh/crm.richland.city/backend/cron_master.php >/dev/null 2>&1';
  
  const queryParams = new URLSearchParams({
    'cpanel_jsonapi_user': 'zccqvhhh',
    'cpanel_jsonapi_apiversion': '2',
    'cpanel_jsonapi_module': 'Cron',
    'cpanel_jsonapi_func': 'add_line',
    'command': cmd,
    'minute': '*',
    'hour': '*',
    'day': '*',
    'month': '*',
    'weekday': '*'
  });

  const api2Res = await client.callApi(`/json-api/cpanel?${queryParams.toString()}`);
  console.log("API 2 Result:", JSON.stringify(api2Res.data || api2Res.raw, null, 2));

  // Also check existing crontab via cPanel API 2 listcron
  const listParams = new URLSearchParams({
    'cpanel_jsonapi_user': 'zccqvhhh',
    'cpanel_jsonapi_apiversion': '2',
    'cpanel_jsonapi_module': 'Cron',
    'cpanel_jsonapi_func': 'listcron'
  });
  const listRes = await client.callApi(`/json-api/cpanel?${listParams.toString()}`);
  console.log("Current crons list:", JSON.stringify(listRes.data || listRes.raw, null, 2));
}

main().catch(console.error);
