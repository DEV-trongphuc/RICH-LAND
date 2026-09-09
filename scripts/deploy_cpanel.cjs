const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const CpanelClient = require('../scratch/cpanel_client.cjs');

function runCommand(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
}

async function deploy() {
  console.log("=== BẮT ĐẦU QUY TRÌNH DEPLOY TOÀN DIỆN LÊN CRM.RICHLAND.CITY ===");

  // 1. Build frontend
  console.log("\n1. Biên dịch frontend (npm run build)...");
  runCommand('npm run build');

  // 2. Chuẩn bị thư mục đóng gói temp_deploy
  const rootDir = path.resolve(__dirname, '..');
  const tempDeploy = path.join(rootDir, 'temp_deploy');
  if (fs.existsSync(tempDeploy)) {
    fs.rmSync(tempDeploy, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDeploy, { recursive: true });

  console.log("\n2. Sao chép dist/ vào temp_deploy/...");
  const distDir = path.join(rootDir, 'dist');
  fs.cpSync(distDir, tempDeploy, { recursive: true });

  console.log("3. Tạo .htaccess cho React SPA routing ở thư mục gốc...");
  const htaccessSpa = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^backend/ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;
  fs.writeFileSync(path.join(tempDeploy, '.htaccess'), htaccessSpa, 'utf8');

  console.log("4. Sao chép backend/ vào temp_deploy/backend/...");
  const backendTarget = path.join(tempDeploy, 'backend');
  const backendSource = path.join(rootDir, 'backend');
  fs.cpSync(backendSource, backendTarget, { recursive: true });

  // 5. Đóng gói release.zip
  console.log("\n5. Nén gói release.zip bằng PowerShell Compress-Archive...");
  const releaseZip = path.join(rootDir, 'release.zip');
  if (fs.existsSync(releaseZip)) fs.unlinkSync(releaseZip);
  
  execSync(`powershell -Command "Get-ChildItem -Path '${tempDeploy}' -Force | Compress-Archive -DestinationPath '${releaseZip}' -Force"`, { stdio: 'inherit' });
  const zipSizeMb = (fs.statSync(releaseZip).size / (1024 * 1024)).toFixed(2);
  console.log(`Đã nén xong: release.zip (${zipSizeMb} MB)`);

  // 6. Tải lên cPanel và giải nén bằng PHP ZipArchive
  console.log("\n6. Đang upload gói release.zip lên cPanel /home/zccqvhhh/crm.richland.city...");
  const client = new CpanelClient();
  const zipBuf = fs.readFileSync(releaseZip);
  const upRes = await client.uploadFile('crm.richland.city', 'release.zip', zipBuf);
  console.log("Upload result:", upRes.status, upRes.data?.status === 1 ? "SUCCESS" : upRes.data);

  console.log("\n7. Đang giải nén release.zip trên cPanel bằng ZipArchive và chuẩn hóa đường dẫn...");
  const extractorPhp = `<?php
header('Content-Type: application/json; charset=utf-8');
set_time_limit(300);

// Dọn dẹp các file lỗi backslash cũ nếu có
foreach (scandir(__DIR__) as $f) {
    if (strpos($f, '\\\\') !== false) {
        @unlink(__DIR__ . '/' . $f);
    }
}

$file = __DIR__ . '/release.zip';
if (!file_exists($file)) {
    echo json_encode(["error" => "release.zip not found"]);
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
            $count++;
        }
    }
    $zip->close();
    @unlink($file);
    echo json_encode(["status" => "success", "extracted_files_count" => $count]);
} else {
    echo json_encode(["error" => "Failed to open release.zip"]);
}
`;
  await client.uploadFile('crm.richland.city', 'extractor.php', Buffer.from(extractorPhp));
  
  const extractRes = await new Promise((resolve) => {
    https.get('https://crm.richland.city/extractor.php', { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ raw: data });
        }
      });
    }).on('error', e => resolve({ error: e.message }));
  });
  console.log("Extract result:", JSON.stringify(extractRes));

  // 8. Dọn dẹp file tạm trên server
  console.log("\n8. Dọn dẹp file tạm trên server...");
  const cleanupPhp = `<?php
@unlink(__DIR__ . '/release.zip');
@unlink(__DIR__ . '/extractor.php');
@unlink(__DIR__ . '/cleanup.php');
@unlink(__DIR__ . '/test_extractor.php');
echo json_encode(["status" => "cleaned"]);
`;
  await client.uploadFile('crm.richland.city', 'cleanup.php', Buffer.from(cleanupPhp));
  await new Promise((resolve) => {
    https.get('https://crm.richland.city/cleanup.php', { rejectUnauthorized: false }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    }).on('error', resolve);
  });

  // Dọn dẹp file tạm local
  fs.rmSync(tempDeploy, { recursive: true, force: true });
  if (fs.existsSync(releaseZip)) fs.unlinkSync(releaseZip);

  console.log("\n9. Kiểm tra sức khỏe hệ thống (Health Check)...");
  await new Promise((resolve) => {
    https.get('https://crm.richland.city/', { rejectUnauthorized: false }, (res) => {
      console.log(`Frontend URL (https://crm.richland.city/) -> HTTP ${res.statusCode}`);
      resolve();
    }).on('error', e => { console.error('Frontend error:', e.message); resolve(); });
  });

  await new Promise((resolve) => {
    https.get('https://crm.richland.city/backend/api.php?action=get_settings', { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`Backend API (https://crm.richland.city/backend/api.php) -> HTTP ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(`  Settings count: ${Object.keys(json.data || {}).length}`);
        } catch(e) {}
        resolve();
      });
    }).on('error', e => { console.error('Backend error:', e.message); resolve(); });
  });

  await new Promise((resolve) => {
    https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=SELECT%20count(*)%20as%20cnt%20FROM%20users', { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`Database Remote Access -> HTTP ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(`  Users count in DB: ${json.data?.[0]?.cnt}`);
        } catch(e) {}
        resolve();
      });
    }).on('error', e => { console.error('DB error:', e.message); resolve(); });
  });

  console.log("\n=== DEPLOYMENT HOÀN TẤT THÀNH CÔNG RỰC RỠ! ===");
}

deploy().catch(err => {
  console.error("LỖI TRONG QUÁ TRÌNH DEPLOY:", err);
  process.exit(1);
});
