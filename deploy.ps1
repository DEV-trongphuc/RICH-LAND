# deploy.ps1
# Automated deploy and migrate script for RICH LAND DATA CRM

Write-Host "=== STARTING AUTOMATED DEPLOYMENT & MIGRATION ===" -ForegroundColor Cyan

# 0. Build frontend
Write-Host "0. Building frontend locally..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build frontend." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 1. Compress and Upload all files via single compressed archives for 95% speed speedup
Write-Host "1. Compressing assets..." -ForegroundColor Yellow
tar -czf frontend.tar.gz -C dist .
tar -czf backend.tar.gz -C backend .

Write-Host "1b. Uploading compressed archives via SCP..." -ForegroundColor Yellow
scp -4 -P 2210 -o StrictHostKeyChecking=no frontend.tar.gz backend.tar.gz vhvxoigh@chiefaiofficer.vn:/home/vhvxoigh/open.domation.net/richland/
if ($LASTEXITCODE -ne 0) {
    Remove-Item frontend.tar.gz, backend.tar.gz -ErrorAction SilentlyContinue
    Write-Host "ERROR: Failed to upload compressed archives." -ForegroundColor Red
    exit $LASTEXITCODE
}
Start-Sleep -Seconds 1

Write-Host "1c. Extracting packages on remote server..." -ForegroundColor Yellow
ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn "tar -xzf /home/vhvxoigh/open.domation.net/richland/frontend.tar.gz -C /home/vhvxoigh/open.domation.net/richland/ && tar -xzf /home/vhvxoigh/open.domation.net/richland/backend.tar.gz -C /home/vhvxoigh/open.domation.net/richland/ && rm /home/vhvxoigh/open.domation.net/richland/frontend.tar.gz /home/vhvxoigh/open.domation.net/richland/backend.tar.gz"
if ($LASTEXITCODE -ne 0) {
    Remove-Item frontend.tar.gz, backend.tar.gz -ErrorAction SilentlyContinue
    Write-Host "ERROR: Failed to extract remote packages." -ForegroundColor Red
    exit $LASTEXITCODE
}

# Clean up local temp packages
Remove-Item frontend.tar.gz, backend.tar.gz -ErrorAction SilentlyContinue

# 2. Trigger database migrations
Write-Host "2. Running migrations on remote backend..." -ForegroundColor Yellow
ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn "php /home/vhvxoigh/open.domation.net/richland/run_migrations.php --apply"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to apply database migrations." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Commit and push changes to Git
Write-Host "3. Staging and pushing changes to Git repository..." -ForegroundColor Yellow
git add .
$gitChanges = git status --porcelain
if ($gitChanges) {
    git commit -m "deploy: automated deployment and push"
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to push to Git repository." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} else {
    Write-Host "No pending local changes to push to Git." -ForegroundColor Gray
}

Write-Host "=== DEPLOYMENT, MIGRATIONS & GIT PUSH COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
