# Veil Social - Azure Deployment (PowerShell, corrected)
# Usage: .\deploy-azure.ps1
# Prereqs: Azure CLI logged in (`az login`), Node.js + npm (for `prisma migrate deploy`),
#          and backend/.env present with real Supabase/AI/Auth values.
# No local Docker required - images are built in ACR (cloud build).

param(
    [string]$ResourceGroup = "rg-veil-social",
    [string]$Location      = "eastus",
    [string]$AcrName       = "",
    [string]$KvName        = ""
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "=== Veil Social Azure Deployment ===" -ForegroundColor Cyan
Write-Host "RG=$ResourceGroup  Location=$Location"

# 1) Login check
try { $acct = az account show | ConvertFrom-Json; Write-Host "Logged in as $($acct.user.name)" -ForegroundColor Green }
catch { Write-Host "Run: az login" -ForegroundColor Red; exit 1 }

# 2) Resource group
az group create --name $ResourceGroup --location $Location --output none

# 3) ACR (Basic, admin enabled - used for image pull by Container Apps)
if (-not $AcrName) { $AcrName = "acrveil$((Get-Random -Minimum 100000 -Maximum 999999))" }
az acr create --resource-group $ResourceGroup --name $AcrName --sku Basic --admin-enabled true --location $Location --output none
$acrLogin = az acr show --name $AcrName --query loginServer -o tsv
$creds = az acr credential show --name $AcrName | ConvertFrom-Json
$acrUser = $creds.username; $acrPass = $creds.passwords[0].value
Write-Host "ACR: $acrLogin"

# 4) Container App Environment
az containerapp env create --name cae-veil-social --resource-group $ResourceGroup --location $Location --output none

# 5) Cloud-build backend & frontend images (no local Docker needed)
function Build-Image ($task, $ctx, $image) {
    az acr task create --registry $AcrName --name $task --image $image --file Dockerfile `
        --context https://github.com/sakashdora/Social_Space.git --commit-trigger-enabled false --output none 2>$null
    $run = az acr task run --registry $AcrName --name $task --context $ctx --no-wait 2>&1
    $runId = ($run | Select-String -Pattern "id:\s*([A-Za-z0-9_-]+)").Matches[0].Groups[1].Value
    for ($i=0; $i -lt 50; $i++) {
        Start-Sleep -Seconds 20
        $s = az acr task list-runs --registry $AcrName --query "[?name=='$runId'].status" -o tsv 2>$null
        if ($s -match "Succeeded") { Write-Host "  $task -> Succeeded" -ForegroundColor Green; break }
        if ($s -match "Failed")    {
            Write-Host "  $task -> FAILED. Check ACR build logs." -ForegroundColor Red
            Write-Host "  Run: az acr task logs --registry $AcrName --run-id $runId"
            exit 1
        }
    }
}
Build-Image "build-veil-backend"  "backend"  "veil-backend:latest"
Build-Image "build-veil-frontend" "frontend" "veil-frontend:latest"
# Retag so Container Apps always creates a fresh revision
az acr import --name $AcrName --source "$acrLogin/veil-backend:latest"   --image "veil-backend:v1" --force | Out-Null
az acr import --name $AcrName --source "$acrLogin/veil-frontend:latest" --image "veil-frontend:v1" --force | Out-Null

# 6) Read secrets from backend/.env
$map = @{}; Get-Content "$root\backend\.env" | ForEach-Object {
    $l = $_.Trim(); if ($l -eq "" -or $l.StartsWith("#")) { return }
    if ($l -notmatch "^([A-Za-z0-9_]+)=(.*)$") { return }
    $k=$Matches[1]; $v=$Matches[2]
    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v=$v.Substring(1,$v.Length-2) }
    $map[$k]=$v
}
$dbUrl = $map["DATABASE_URL"] -replace "&connection_limit=2",""
$supaKey = $map["SUPABASE_SERVICE_ROLE_KEY"]
if (-not $supaKey) { $supaKey = "REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY" }

# 7) Backend Container App
$beSecrets = @(
  "database-url=$dbUrl",
  "direct-url=$($map['DIRECT_URL'])",
  "supabase-url=$($map['SUPABASE_URL'])",
  "supabase-service-role-key=$supaKey",
  "jwt-secret=$($map['JWT_SECRET'])",
  "encryption-key=$($map['ENCRYPTION_KEY'])",
  "recovery-code-secret=$($map['RECOVERY_CODE_SECRET'])",
  "ai-api-key=$($map['AI_API_KEY'])",
  "grok-api-key=$($map['GROK_API_KEY'])"
)
az containerapp create --name veil-backend --resource-group $ResourceGroup --environment cae-veil-social `
  --image "$acrLogin/veil-backend:v1" --target-port 3000 --ingress external `
  --registry-server $acrLogin --registry-username $acrUser --registry-password $acrPass `
  --secrets $beSecrets `
  --env-vars "PORT=3000" "NODE_ENV=production" `
    "DATABASE_URL=secretref:database-url" "DIRECT_URL=secretref:direct-url" `
    "SUPABASE_URL=secretref:supabase-url" "SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key" `
    "SUPABASE_STORAGE_BUCKET=veil-media" "JWT_SECRET=secretref:jwt-secret" `
    "ENCRYPTION_KEY=secretref:encryption-key" "RECOVERY_CODE_SECRET=secretref:recovery-code-secret" `
    "AI_API_KEY=secretref:ai-api-key" "AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions" `
    "AI_MODEL=gemini-2.5-flash" "GROK_API_KEY=secretref:grok-api-key" `
    "WEBAUTHN_RP_NAME=Veil Social" "TOTP_ISSUER=Veil Social" `
  --cpu 0.5 --memory 1Gi --min-replicas 1 --max-replicas 2 --output none
$beUrl = az containerapp show --name veil-backend --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "Backend: https://$beUrl"

# 8) Frontend Container App (SSR) - create first to learn its URL
az containerapp create --name veil-frontend --resource-group $ResourceGroup --environment cae-veil-social `
  --image "$acrLogin/veil-frontend:v1" --target-port 3000 --ingress external `
  --registry-server $acrLogin --registry-username $acrUser --registry-password $acrPass `
  --env-vars "NODE_ENV=production" "PORT=3000" "BACKEND_API_URL=https://$beUrl" `
  --cpu 0.5 --memory 1Gi --min-replicas 1 --max-replicas 2 --output none
$feUrl = az containerapp show --name veil-frontend --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "Frontend: https://$feUrl"

# 9) Align backend CORS/WebAuthn to the real frontend URL
az containerapp update --name veil-backend --resource-group $ResourceGroup `
  --set-env-vars "FRONTEND_ORIGIN=https://$feUrl" "WEBAUTHN_ORIGIN=https://$feUrl" "WEBAUTHN_RP_ID=$feUrl" | Out-Null

# 10) Apply DB schema to Supabase (runs locally against DIRECT_URL)
Write-Host "=== Applying Prisma migrations to Supabase ===" -ForegroundColor Yellow
Push-Location "$root\backend"
npx prisma migrate deploy
Pop-Location

Write-Host "`n=== DEPLOYED ===" -ForegroundColor Green
Write-Host "Backend : https://$beUrl  (/healthz)"
Write-Host "Frontend: https://$feUrl"
Write-Host "`nNotes:" -ForegroundColor Cyan
Write-Host "- This frontend is an SSR (Nitro) app, so it runs as a Container App (not Static Web Apps)."
Write-Host "- Secrets are stored as encrypted Container App secrets (sourced from backend/.env), not in git."
Write-Host "- For a fully managed secret store, move values into Azure Key Vault and reference them via a"
Write-Host "  system-assigned managed identity (this CLI version's 'az containerapp create --identity' is limited)."
