const https = require('https');

const host = 'hf60-22099.azdigihost.com';
const port = 2083;
const username = 'zccqvhhh';
const password = '1Re35Dn3ia';

function loginCpanel() {
  return new Promise((resolve, reject) => {
    const postData = `user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}`;
    const options = {
      hostname: host,
      port: port,
      path: '/login/?login_only=1',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookies: res.headers['set-cookie'],
          body: data
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

loginCpanel().then(res => {
  console.log("Login HTTP Status:", res.status);
  console.log("Body:", res.body);
  console.log("Cookies:", res.cookies);
}).catch(console.error);
