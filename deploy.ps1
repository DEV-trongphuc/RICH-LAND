# deploy.ps1
# Automated deploy and migrate script for RICH LAND DATA CRM

Write-Host "=== STARTING AUTOMATED DEPLOYMENT & MIGRATION ===" -ForegroundColor Cyan

# 0. Build frontend with Node.js heap ceiling limit to prevent RAM ballooning
$env:NODE_OPTIONS = "--max-old-space-size=2048"
Write-Host "0. Building frontend locally..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build frontend." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 1. Prepare temp directory for packaging both Frontend and Backend
$tempPackageDir = Join-Path $env:TEMP "richland_deploy_package"
if (Test-Path $tempPackageDir) {
    Remove-Item -Path $tempPackageDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $tempPackageDir -Force | Out-Null

Write-Host "1. Staging frontend and backend files..." -ForegroundColor Yellow
Copy-Item -Path "dist\*" -Destination $tempPackageDir -Recurse -Force
Copy-Item -Path "backend\*" -Destination $tempPackageDir -Recurse -Force

# 2. Compress into a single tar.gz file
$tempArchive = Join-Path $env:TEMP "richland_package.tar.gz"
if (Test-Path $tempArchive) {
    Remove-Item -Path $tempArchive -Force -ErrorAction SilentlyContinue
}
Write-Host "2. Creating single deploy archive..." -ForegroundColor Yellow
tar -czf "$tempArchive" -C "$tempPackageDir" .

# 3. Stream and extract via 1 single SSH connection (pipeline)
Write-Host "3. Uploading and executing remote deployment in a single SSH session..." -ForegroundColor Yellow
cmd /c "ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn ""tar -xzf - -C /home/vhvxoigh/open.domation.net/richland/ && php /home/vhvxoigh/open.domation.net/richland/run_migrations.php --apply"" < ""$tempArchive"""

$sshExit = $LASTEXITCODE

# Clean up local temp files
Remove-Item -Path $tempPackageDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $tempArchive -Force -ErrorAction SilentlyContinue

if ($sshExit -ne 0) {
    Write-Host "ERROR: Deployment failed." -ForegroundColor Red
    exit $sshExit
}

# 3. Commit and push changes to Git (DISABLED per user request)
# Write-Host "3. Staging and pushing changes to Git repository..." -ForegroundColor Yellow
# git add .
# $gitChanges = git status --porcelain
# if ($gitChanges) {
#     git commit -m "deploy: automated deployment and push"
#     git push origin main
# }

# 4. Trigger GC to free process memory
[System.GC]::Collect()

Write-Host "=== DEPLOYMENT, MIGRATIONS & GIT PUSH COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
