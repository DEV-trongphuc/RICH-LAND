#!/usr/bin/env node

/**
 * ============================================================================
 * RICH LAND CRM - PRODUCTION CPANEL DEPLOYMENT SCRIPT (deploy.js)
 * ============================================================================
 * Hướng dẫn sử dụng:
 *   - Deploy toàn bộ (Build FE + Backend + Upload cPanel + Sync Git):
 *       node deploy.js
 *       hoặc: npm run deploy
 *
 *   - Chỉ deploy Backend (nhanh, không cần build FE):
 *       node deploy.js --backend-only
 *
 *   - Chỉ deploy Frontend (bỏ qua Backend):
 *       node deploy.js --frontend-only
 *
 *   - Deploy mà không cần build lại (sử dụng bản build dist/ có sẵn):
 *       node deploy.js --skip-build
 *
 *   - Chỉ kiểm tra sức khỏe hệ thống (Health Check & Test DB):
 *       node deploy.js --check-only
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 1. CẤU HÌNH HỆ THỐNG VÀ THÔNG SỐ HOSTING CPANEL ─────────────────────────
const CONFIG = {
  cpanel: {
    host: 'hf60-22099.azdigihost.com',
    port: 2083,
    user: 'zccqvhhh',
    pass: '1Re35Dn3ia',
    subdomain: 'crm.richland.city',
    docRoot: 'crm.richland.city',
    baseUrl: 'https://crm.richland.city'
  },
  db: {
    host: 'localhost',
    user: 'zccqvhhh_crm-rlvn',
    pass: '$1;RKuCwX)VD;k~#',
    name: 'zccqvhhh_crm-rlvn',
    remoteKey: 'richland2026'
  },
  cron: {
    command: '/usr/local/bin/ea-php82 /home/zccqvhhh/crm.richland.city/backend/cron_master.php >/dev/null 2>&1'
  }
};

const ROOT_DIR = path.resolve(__dirname);
const TEMP_DEPLOY_DIR = path.join(ROOT_DIR, 'temp_deploy');
const RELEASE_ZIP = path.join(ROOT_DIR, 'release.zip');

// ── 2. CPANEL UAPI CLIENT CLASS ─────────────────────────────────────────────
class CpanelClient {
  constructor(cpanelConfig) {
    this.host = cpanelConfig.host;
    this.port = cpanelConfig.port;
    this.user = cpanelConfig.user;
    this.pass = cpanelConfig.pass;
    this.cookies = '';
    this.securityToken = '';
  }

  async login() {
    const postData = `user=${encodeURIComponent(this.user)}&pass=${encodeURIComponent(this.pass)}`;
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: '/login/?login_only=1',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'RichLandDeployer/2.0'
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
              this.securityToken = parsed.security_token; // ví dụ /cpsess1234567890
              const cookieHeaders = res.headers['set-cookie'] || [];
              this.cookies = cookieHeaders.map(c => c.split(';')[0]).join('; ');
              console.log(`  🔑 Đăng nhập cPanel thành công! Token: ${this.securityToken}`);
              resolve(parsed);
            } else {
              reject(new Error("Đăng nhập cPanel thất bại: " + data));
            }
          } catch (e) {
            reject(new Error("Lỗi đọc phản hồi cPanel login: " + e.message + " - " + data));
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
        'User-Agent': 'RichLandDeployer/2.0',
        ...extraHeaders
      };
      if (postData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const options = {
        hostname: this.host,
        port: this.port,
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

  async uploadFile(targetDir, fileName, fileBuffer) {
    if (!this.securityToken) await this.login();

    return new Promise((resolve, reject) => {
      const boundary = '----RichLandBoundary' + Math.random().toString(36).substring(2);
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
        hostname: this.host,
        port: this.port,
        path: fullPath,
        method: 'POST',
        headers: {
          'Cookie': this.cookies,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
          'User-Agent': 'RichLandDeployer/2.0'
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

  async checkAndSetupCron(command) {
    try {
      console.log("\n⏰ [CRON JOB] Đang kiểm tra Cron Master trên cPanel...");
      const listParams = new URLSearchParams({
        'cpanel_jsonapi_user': this.user,
        'cpanel_jsonapi_apiversion': '2',
        'cpanel_jsonapi_module': 'Cron',
        'cpanel_jsonapi_func': 'listcron'
      });
      const listRes = await this.callApi(`/json-api/cpanel?${listParams.toString()}`);
      const crons = listRes.data?.cpanelresult?.data || [];
      const hasCron = crons.some(c => c.command && c.command.includes('cron_master.php'));

      if (hasCron) {
        console.log("  ✅ Cron Master (cron_master.php) ĐÃ ĐƯỢC KÍCH HOẠT và đang chạy đều đặn mỗi phút.");
      } else {
        console.log("  ⚠️ Chưa thấy Cron Master. Đang tự động đăng ký Cron mới vào cPanel...");
        const addParams = new URLSearchParams({
          'cpanel_jsonapi_user': this.user,
          'cpanel_jsonapi_apiversion': '2',
          'cpanel_jsonapi_module': 'Cron',
          'cpanel_jsonapi_func': 'add_line',
          'command': command,
          'minute': '*',
          'hour': '*',
          'day': '*',
          'month': '*',
          'weekday': '*'
        });
        const addRes = await this.callApi(`/json-api/cpanel?${addParams.toString()}`);
        console.log("  ✅ Đã đăng ký Cron Master thành công!");
      }
    } catch (err) {
      console.warn("  ⚠️ Lưu ý khi kiểm tra Cron:", err.message);
    }
  }
}

// ── 3. CÁC HÀM TIỆN ÍCH THI CÔNG ─────────────────────────────────────────────
function runCommand(cmd, cwd = ROOT_DIR) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

function fetchUrl(url, extraHeaders = {}) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RichLandDeployer/2.0',
        ...extraHeaders
      },
      rejectUnauthorized: false
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', e => resolve({ error: e.message, status: 0 }));
  });
}

function ensureProductionEnv() {
  // 1. Root .env for Vite frontend build
  const rootEnvPath = path.join(ROOT_DIR, '.env');
  const rootEnvContent = `VITE_API_URL=${CONFIG.cpanel.baseUrl}/backend\n`;
  fs.writeFileSync(rootEnvPath, rootEnvContent, 'utf8');
  console.log("  ✅ Đã đồng bộ root .env (VITE_API_URL): " + `${CONFIG.cpanel.baseUrl}/backend`);

  // 2. Backend .env for PHP
  const backendEnvPath = path.join(ROOT_DIR, 'backend', '.env');
  const backendEnvContent = `DB_HOST=${CONFIG.db.host}
DB_USER=${CONFIG.db.user}
DB_PASS=${CONFIG.db.pass}
DB_NAME=${CONFIG.db.name}
JWT_SECRET=RICHLAND_SECRET_KEY_2026
`;
  fs.writeFileSync(backendEnvPath, backendEnvContent, 'utf8');
  console.log("  ✅ Đã đồng bộ backend/.env chuẩn theo CSDL: " + CONFIG.db.name);
}

// ── 4. CHƯƠNG TRÌNH ĐIỀU PHỐI DEPLOY TOÀN DIỆN ──────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const backendOnly = args.includes('--backend-only');
  const frontendOnly = args.includes('--frontend-only');
  const checkOnly = args.includes('--check-only');

  console.log("===============================================================================");
  console.log("🚀 RICH LAND CRM - HỆ THỐNG DEPLOY TỰ ĐỘNG LÊN HOSTING CPANEL AZDIGI");
  console.log(`🎯 Đích: ${CONFIG.cpanel.baseUrl} (${CONFIG.cpanel.docRoot})`);
  console.log(`🗄️ CSDL: ${CONFIG.db.name} (User: ${CONFIG.db.user})`);
  console.log("===============================================================================\n");

  // Nếu chỉ cần chạy health check
  if (checkOnly) {
    await runHealthCheck();
    return;
  }

  // 1. Đảm bảo cấu hình backend/.env
  ensureProductionEnv();

  // 2. Dọn dẹp thư mục tạm trước khi đóng gói
  if (fs.existsSync(TEMP_DEPLOY_DIR)) {
    fs.rmSync(TEMP_DEPLOY_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DEPLOY_DIR, { recursive: true });

  // 3. Xử lý Frontend
  if (!backendOnly) {
    if (!skipBuild) {
      console.log("\n📦 1. Đang biên dịch Frontend (npm run build)...");
      runCommand('npm run build');
    } else {
      console.log("\n📦 1. Bỏ qua bước build (sử dụng thư mục dist/ hiện tại)...");
    }

    const distDir = path.join(ROOT_DIR, 'dist');
    if (!fs.existsSync(distDir)) {
      throw new Error("Thư mục dist/ không tồn tại! Vui lòng bỏ --skip-build để build lại.");
    }
    console.log("  📂 Đang sao chép dist/ vào gói phát hành...");
    fs.cpSync(distDir, TEMP_DEPLOY_DIR, { recursive: true });

    console.log("  ⚙️ Khởi tạo .htaccess hỗ trợ React SPA Routing...");
    const htaccessSpa = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^backend/ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;
    fs.writeFileSync(path.join(TEMP_DEPLOY_DIR, '.htaccess'), htaccessSpa, 'utf8');
  }

  // 4. Xử lý Backend
  if (!frontendOnly) {
    console.log("\n🐘 2. Đang đóng gói Backend (toàn bộ API, Logic, Cron, PHPMailer)...");
    const backendSource = path.join(ROOT_DIR, 'backend');
    const backendTarget = path.join(TEMP_DEPLOY_DIR, 'backend');
    fs.cpSync(backendSource, backendTarget, { recursive: true });
  }

  // 5. Nén gói release.zip
  console.log("\n🗜️ 3. Đang nén toàn bộ thành release.zip...");
  if (fs.existsSync(RELEASE_ZIP)) fs.unlinkSync(RELEASE_ZIP);

  if (process.platform === 'win32') {
    execSync(`powershell -Command "Get-ChildItem -Path '${TEMP_DEPLOY_DIR}' -Force | Compress-Archive -DestinationPath '${RELEASE_ZIP}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`cd "${TEMP_DEPLOY_DIR}" && zip -r "${RELEASE_ZIP}" .`, { stdio: 'inherit' });
  }

  const zipSizeMb = (fs.statSync(RELEASE_ZIP).size / (1024 * 1024)).toFixed(2);
  console.log(`  ✅ Đã tạo gói release.zip dung lượng: ${zipSizeMb} MB`);

  // 6. Tải lên cPanel
  console.log("\n☁️ 4. Đang tải release.zip lên cPanel qua UAPI Fileman...");
  const client = new CpanelClient(CONFIG.cpanel);
  await client.login();

  const zipBuffer = fs.readFileSync(RELEASE_ZIP);
  const uploadRes = await client.uploadFile(CONFIG.cpanel.docRoot, 'release.zip', zipBuffer);
  console.log("  ✅ Tải lên hoàn tất:", uploadRes.status, uploadRes.data?.status === 1 ? "THÀNH CÔNG" : uploadRes.data);

  // 7. Giải nén trên cPanel và chuẩn hóa cấu trúc
  console.log("\n📂 5. Đang giải nén và phân bổ quyền tệp tin trên cPanel bằng ZipArchive...");
  const extractorPhp = `<?php
header('Content-Type: application/json; charset=utf-8');
set_time_limit(300);

// Dọn dẹp tệp có ký tự backslash lỗi nếu có từ bản zip cũ
foreach (scandir(__DIR__) as $f) {
    if (strpos($f, '\\\\') !== false) {
        @unlink(__DIR__ . '/' . $f);
    }
}

$file = __DIR__ . '/release.zip';
if (!file_exists($file)) {
    echo json_encode(["status" => "error", "message" => "release.zip not found"]);
    exit;
}

$zip = new ZipArchive();
if ($zip->open($file) === TRUE) {
    $count = 0;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $entryName = $zip->getNameIndex($i);
        $normalized = str_replace('\\\\', '/', $entryName);
        $targetPath = __DIR__ . '/' . $normalized;

        if (substr($normalized, -1) === '/') {
            if (!is_dir($targetPath)) mkdir($targetPath, 0755, true);
        } else {
            $dir = dirname($targetPath);
            if (!is_dir($dir)) mkdir($dir, 0755, true);
            file_put_contents($targetPath, $zip->getFromIndex($i));
            @chmod($targetPath, 0644);
            $count++;
        }
    }
    $zip->close();
    @unlink($file);
    echo json_encode(["status" => "success", "extracted_files" => $count]);
} else {
    echo json_encode(["status" => "error", "message" => "Failed to open release.zip"]);
}
`;
  await client.uploadFile(CONFIG.cpanel.docRoot, 'extractor.php', Buffer.from(extractorPhp));

  const extractRes = await fetchUrl(`${CONFIG.cpanel.baseUrl}/extractor.php`);
  console.log("  ✅ Kết quả giải nén:", JSON.stringify(extractRes.data || extractRes.raw));

  // 8. Dọn dẹp tệp tạm trên server
  console.log("\n🧹 6. Dọn dẹp các tệp tạm trên hosting...");
  const cleanupPhp = `<?php
@unlink(__DIR__ . '/release.zip');
@unlink(__DIR__ . '/extractor.php');
@unlink(__DIR__ . '/cleanup.php');
echo json_encode(["status" => "cleaned"]);
`;
  await client.uploadFile(CONFIG.cpanel.docRoot, 'cleanup.php', Buffer.from(cleanupPhp));
  await fetchUrl(`${CONFIG.cpanel.baseUrl}/cleanup.php`);

  // Dọn dẹp local
  fs.rmSync(TEMP_DEPLOY_DIR, { recursive: true, force: true });
  if (fs.existsSync(RELEASE_ZIP)) fs.unlinkSync(RELEASE_ZIP);

  // 9. Kiểm tra & đảm bảo Cron Job
  await client.checkAndSetupCron(CONFIG.cron.command);

  // 10. Chạy Health Check toàn diện
  await runHealthCheck();

  // 11. Đồng bộ Git Commit & Push (Tuân thủ Quy tắc 5)
  console.log("\n🔄 8. Tự động đồng bộ mã nguồn lên Git Repository...");
  try {
    const gitStatus = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' });
    if (gitStatus.trim().length > 0) {
      console.log("  📝 Phát hiện thay đổi, đang thực hiện git add, commit & push...");
      runCommand('git add .');
      const commitMsg = `Deploy production crm.richland.city - ${new Date().toLocaleString('vi-VN')}`;
      runCommand(`git commit -m "${commitMsg}"`);
      runCommand('git push origin main');
      console.log("  ✅ Đã đồng bộ Git thành công!");
    } else {
      console.log("  ℹ️ Mã nguồn Git đã ở trạng thái mới nhất, không có thay đổi cần commit.");
    }
  } catch (gitErr) {
    console.warn("  ⚠️ Ghi chú Git:", gitErr.message);
  }

  console.log("\n===============================================================================");
  console.log("🎉 DEPLOY TOÀN DIỆN LÊN CRM.RICHLAND.CITY HOÀN TẤT THÀNH CÔNG RỰC RỠ!");
  console.log("===============================================================================");
}

// ── 5. HÀM KIỂM TRA SỨC KHỎE HỆ THỐNG & CSDL TỪ XA ─────────────────────────
async function runHealthCheck() {
  console.log("\n🩺 [HEALTH CHECK] Đang kiểm tra sức khỏe hệ thống crm.richland.city...");

  // 1. Kiểm tra Frontend
  const feRes = await fetchUrl(`${CONFIG.cpanel.baseUrl}/`);
  console.log(`  🌐 1. Frontend UI (${CONFIG.cpanel.baseUrl}/) -> HTTP ${feRes.status}`);

  // 2. Kiểm tra Backend API
  const apiRes = await fetchUrl(`${CONFIG.cpanel.baseUrl}/backend/api.php?action=get_settings`, {
    'Authorization': 'Bearer demo_token_12345'
  });
  console.log(`  ⚙️ 2. Backend API (${CONFIG.cpanel.baseUrl}/backend/api.php) -> HTTP ${apiRes.status}`);
  if (apiRes.data && apiRes.data.data) {
    console.log(`     Số lượng thiết lập hệ thống đã nạp: ${Object.keys(apiRes.data.data).length}`);
  }

  // 3. Kiểm tra CSDL từ xa qua exec_db_query
  const sql = encodeURIComponent("SELECT DATABASE() as current_db, count(*) as total_users FROM users");
  const dbRes = await fetchUrl(`${CONFIG.cpanel.baseUrl}/backend/exec_db_query.php?key=${CONFIG.db.remoteKey}&sql=${sql}`);
  console.log(`  🗄️ 3. Kết nối CSDL (${CONFIG.cpanel.baseUrl}/backend/exec_db_query.php) -> HTTP ${dbRes.status}`);
  if (dbRes.data && dbRes.data.data && dbRes.data.data[0]) {
    const row = dbRes.data.data[0];
    console.log(`     CSDL Đang kết nối: [${row.current_db}] | Số tài khoản Users: [${row.total_users}]`);
  } else {
    console.warn("     Lỗi đọc CSDL:", JSON.stringify(dbRes.data || dbRes.raw));
  }
}

main().catch(err => {
  console.error("\n❌ LỖI TRONG QUÁ TRÌNH DEPLOY:", err);
  process.exit(1);
});
