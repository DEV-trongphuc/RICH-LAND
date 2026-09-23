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
  
  // Read last 20 lines of access log
  const logUrl = `${token}/execute/Fileman/list_files?dir=%2Fhome%2Fzccqvhhh%2Faccess-logs`;
  const req = https.request({
    hostname: host, port, path: logUrl, method: 'GET',
    headers: { 'Cookie': cookies },
    rejectUnauthorized: false
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('Data:', JSON.stringify(json.data, null, 2));
      } catch (e) {
        console.log('Raw:', data.substring(0, 500));
      }
    });
  });
  req.end();
}
main();
