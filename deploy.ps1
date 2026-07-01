# deploy.ps1
# Automated deploy and migrate script for RICH LAND DATA CRM

Write-Host "=== STARTING AUTOMATED DEPLOYMENT & MIGRATION ===" -ForegroundColor Cyan

# 1. Upload all backend files
Write-Host "1. Uploading backend files via SCP..." -ForegroundColor Yellow
scp -P 2210 -o StrictHostKeyChecking=no -r backend/* vhvxoigh@chiefaiofficer.vn:/home/vhvxoigh/open.domation.net/richland/

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to upload backend files." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Trigger database migrations
Write-Host "2. Running migrations on remote backend..." -ForegroundColor Yellow
ssh -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn "php /home/vhvxoigh/open.domation.net/richland/run_migrations.php --apply"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to apply database migrations." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "=== DEPLOYMENT AND MIGRATIONS COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
