# Deploy Upper Room DFW to Amplify WEB_COMPUTE (Express Node server)
# Usage: .\deploy\amplify-deploy.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AppId = "dbtc2f3y8pyam"
$Branch = "main"
$Region = "us-east-2"
$ZipPath = Join-Path $env:TEMP "upper-room-dfw-deploy.zip"

Write-Host "Building..."
Set-Location $Root
npm run build

Write-Host "Creating zip (excluding node_modules, .env, db)..."
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
$exclude = @("node_modules", ".git", ".env", "server\data", "*.db", "*.db-shm", "*.db-wal")
# Use tar if available, else Compress-Archive
$items = Get-ChildItem $Root -Force | Where-Object { $_.Name -notin @("node_modules", ".git") }
Compress-Archive -Path (Join-Path $Root "*") -DestinationPath $ZipPath -Force

Write-Host "Creating Amplify deployment job..."
$deploy = aws amplify create-deployment --app-id $AppId --branch-name $Branch --region $Region --output json | ConvertFrom-Json
$jobId = $deploy.jobId
$uploadUrl = $deploy.zipUploadUrl

Write-Host "Uploading zip to Amplify (job $jobId)..."
Invoke-WebRequest -Uri $uploadUrl -Method PUT -InFile $ZipPath -ContentType "application/zip"

Write-Host "Starting deployment..."
aws amplify start-deployment --app-id $AppId --branch-name $Branch --job-id $jobId --region $Region --output json

Write-Host "Done. App URL: https://$Branch.$AppId.amplifyapp.com"