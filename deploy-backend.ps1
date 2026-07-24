# deploy-backend.ps1
# Deploy ONLY backend files and run database migrations (No Frontend build, No Git Push)

Write-Host "=== STARTING BACKEND-ONLY DEPLOYMENT & MIGRATION ===" -ForegroundColor Cyan

$tempBackend = Join-Path $env:TEMP "richland_backend.tar.gz"

Write-Host "1. Compressing backend files to system temp directory..." -ForegroundColor Yellow
tar -czf "$tempBackend" -C backend .

Write-Host "2. Uploading backend archive and applying remote migrations in a single session..." -ForegroundColor Yellow
cmd /c "ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn ""tar -xzf - -C /home/vhvxoigh/open.domation.net/richland/ && php /home/vhvxoigh/open.domation.net/richland/run_migrations.php --apply"" < ""$tempBackend"""

$sshExit = $LASTEXITCODE

# Clean up local temp package
Remove-Item "$tempBackend" -ErrorAction SilentlyContinue

if ($sshExit -ne 0) {
    Write-Host "ERROR: Backend deployment failed." -ForegroundColor Red
    exit $sshExit
}

Write-Host "=== BACKEND DEPLOYMENT & MIGRATIONS COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
