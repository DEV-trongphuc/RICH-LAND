import https from 'https';

const host = 'hf60-22099.azdigihost.com';
const port = 2083;
const user = 'zccqvhhh';
const pass = '1Re35Dn3ia';

function login() {
  const postData = `user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, port, path: '/login/?login_only=1', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        const cookieHeaders = res.headers['set-cookie'] || [];
        const cookies = cookieHeaders.map(c => c.split(';')[0]).join('; ');
        resolve({ token: parsed.security_token, cookies });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const { token, cookies } = await login();
  console.log('Logged in, token:', token);
  
  // List cron jobs
  const cronUrl = `${token}/json-api/cpanel?cpanel_jsonapi_user=${user}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Cron&cpanel_jsonapi_func=listcron`;
  const req = https.request({
    hostname: host, port, path: cronUrl, method: 'GET',
    headers: { 'Cookie': cookies },
    rejectUnauthorized: false
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('CRON LIST:', data);
    });
  });
  req.end();
}
main();
