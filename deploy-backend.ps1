# deploy-backend.ps1
# Deploy ONLY backend files and run database migrations (No Frontend build, No Git Push)

Write-Host "=== STARTING DEPLOYMENT TO CRM.RICHLAND.CITY ===" -ForegroundColor Cyan
node scripts/deploy_cpanel.cjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "=== DEPLOYMENT COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
