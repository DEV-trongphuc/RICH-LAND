# deploy-backend.ps1
# Deploy ONLY backend files and run database migrations (No Frontend build, No Git Push)

Write-Host "=== STARTING BACKEND-ONLY DEPLOYMENT & MIGRATION ===" -ForegroundColor Cyan

$tempBackend = Join-Path $env:TEMP "richland_backend.tar.gz"

Write-Host "1. Compressing backend files to system temp directory..." -ForegroundColor Yellow
tar -czf "$tempBackend" -C backend .

Write-Host "2. Uploading compressed backend archive via SCP..." -ForegroundColor Yellow
scp -4 -P 2210 -o StrictHostKeyChecking=no "$tempBackend" vhvxoigh@chiefaiofficer.vn:/home/vhvxoigh/open.domation.net/richland/
if ($LASTEXITCODE -ne 0) {
    Remove-Item "$tempBackend" -ErrorAction SilentlyContinue
    Write-Host "ERROR: Failed to upload backend archive." -ForegroundColor Red
    exit $LASTEXITCODE
}
Start-Sleep -Seconds 1

Write-Host "3. Extracting backend package on remote server..." -ForegroundColor Yellow
ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn "tar -xzf /home/vhvxoigh/open.domation.net/richland/richland_backend.tar.gz -C /home/vhvxoigh/open.domation.net/richland/ && rm /home/vhvxoigh/open.domation.net/richland/richland_backend.tar.gz"
if ($LASTEXITCODE -ne 0) {
    Remove-Item "$tempBackend" -ErrorAction SilentlyContinue
    Write-Host "ERROR: Failed to extract backend package." -ForegroundColor Red
    exit $LASTEXITCODE
}

# Clean up local temp package
Remove-Item "$tempBackend" -ErrorAction SilentlyContinue

# 4. Trigger database migrations
Write-Host "4. Running migrations on remote backend..." -ForegroundColor Yellow
ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn "php /home/vhvxoigh/open.domation.net/richland/run_migrations.php --apply"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to apply database migrations." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "=== BACKEND DEPLOYMENT & MIGRATIONS COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
