const https = require('https');

https.get('https://crm.richland.city/backend/api.php?action=get_logs&page=1&pageSize=5&date=all', {
  headers: { 'Authorization': 'Bearer demo_token_12345' }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Status counts:', JSON.stringify(json.status_counts, null, 2));
  });
});
