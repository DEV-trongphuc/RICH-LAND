const https = require('https');
const fs = require('fs');
const path = require('path');

const host = 'hf60-22099.azdigihost.com';
const port = 2083;
const username = 'zccqvhhh';
const password = '1Re35Dn3ia';

class CpanelClient {
  constructor() {
    this.cookies = '';
    this.securityToken = '';
  }

  async login() {
    const postData = `user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}`;
    return new Promise((resolve, reject) => {
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
          try {
            const parsed = JSON.parse(data);
            if (parsed.status === 1) {
              this.securityToken = parsed.security_token; // e.g. /cpsess7755852129
              const cookieHeaders = res.headers['set-cookie'] || [];
              this.cookies = cookieHeaders.map(c => c.split(';')[0]).join('; ');
              console.log("Logged in to cPanel. Token:", this.securityToken);
              resolve(parsed);
            } else {
              reject(new Error("Login failed: " + data));
            }
          } catch (e) {
            reject(new Error("Parse error: " + e.message + " - " + data));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async callApi(apiPath, method = 'GET', postData = null, extraHeaders = {}) {
    if (!this.securityToken) await this.login();

    return new Promise((resolve, reject) => {
      const fullPath = `${this.securityToken}${apiPath}`;
      const headers = {
        'Cookie': this.cookies,
        'User-Agent': 'Mozilla/5.0',
        ...extraHeaders
      };
      if (postData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const options = {
        hostname: host,
        port: port,
        path: fullPath,
        method: method,
        headers: headers,
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: data });
          }
        });
      });

      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  async listFiles(dir = 'crm.richland.city') {
    return this.callApi(`/execute/Fileman/list_files?dir=${encodeURIComponent(dir)}`);
  }

  async uploadFile(targetDir, fileName, fileBuffer) {
    if (!this.securityToken) await this.login();

    return new Promise((resolve, reject) => {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const fullPath = `${this.securityToken}/execute/Fileman/upload_files`;

      const header = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="dir"\r\n\r\n` +
        `${targetDir}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="overwrite"\r\n\r\n` +
        `1\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file-1"; filename="${fileName}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const payload = Buffer.concat([header, fileBuffer, footer]);

      const options = {
        hostname: host,
        port: port,
        path: fullPath,
        method: 'POST',
        headers: {
          'Cookie': this.cookies,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
          'User-Agent': 'Mozilla/5.0'
        },
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async extractFile(dir, fileName) {
    const postData = `dir=${encodeURIComponent(dir)}&file=${encodeURIComponent(fileName)}`;
    return this.callApi('/execute/Fileman/extract_files', 'POST', postData);
  }
}

module.exports = CpanelClient;

if (require.main === module) {
  const client = new CpanelClient();
  client.listFiles('crm.richland.city').then(res => {
    console.log("List files in crm.richland.city:", JSON.stringify(res.data || res.raw, null, 2));
  }).catch(console.error);
}
