const https = require('https');

https.get('https://crm.richland.city/backend/api.php?action=activities&related_type=contact&related_id=10797', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(d);
      console.log('Result:', JSON.stringify(parsed, null, 2).slice(0, 1000));
    } catch (e) {
      console.log('Raw:', d.slice(0, 500));
    }
  });
});
