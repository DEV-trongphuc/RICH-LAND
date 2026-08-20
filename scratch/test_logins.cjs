const https = require('https');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'open.domation.net',
      path: '/richland/' + path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const accounts = [
  { name: 'Ngọc Huyền', email: 'ngochuyen@richland.city', pass: 'Ngochuyen2912@' },
  { name: 'Bá Dương', email: 'baduong@richland.city', pass: '17111997' },
  { name: 'Ngọc Hiển', email: 'ngochien@richland.city', pass: 'ngochien030195' },
  { name: 'Khắc Phú', email: 'khacphu@richland.city', pass: 'Phu@121998' },
  { name: 'Công Hoà', email: 'conghoa@richland.city', pass: 'Conghoa@1995' }
];

async function main() {
  console.log('--- TESTING AUTH LOGIN FOR ALL ACCOUNTS ---');
  for (const acc of accounts) {
    const res = await post('api.php?action=login', { email: acc.email, password: acc.pass });
    const isSuccess = res.data && res.data.success;
    console.log(`Login ${acc.name} (${acc.email}): ${isSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!isSuccess) {
      console.log('Response:', res.data);
    }
  }
}
main();
