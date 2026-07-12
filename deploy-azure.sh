#!/usr/bin/env bash
# Azure Deployment Script for Veil Social
# Usage: ./deploy-azure.sh [resource-group] [location]

set -euo pipefail

RG=${1:-rg-veil-social}
LOCATION=${2:-eastus}

echo "=== Veil Social Azure Deployment ==="
echo "Resource Group: $RG"
echo "Location: $LOCATION"
echo ""

# 1. Create Resource Group
echo "Creating resource group..."
az group create --name "$RG" --location "$LOCATION" -o none

# 2. Create ACR
ACR_NAME="acrveilsocial$(date +%s | tail -c 6)"
echo "Creating ACR: $ACR_NAME..."
az acr create \
  --resource-group "$RG" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --location "$LOCATION" \
  -o none

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
echo "ACR Login Server: $ACR_LOGIN_SERVER"

# 3. Build and Push Backend Image
echo "Building backend Docker image..."
cd backend
az acr build \
  --registry "$ACR_NAME" \
  --image veil-backend:latest \
  --file Dockerfile \
  . \
  -o none
cd ..

# 4. Create Key Vault
KV_NAME="kv-veil-social-$(date +%s | tail -c 6)"
echo "Creating Key Vault: $KV_NAME..."
az keyvault create \
  --resource-group "$RG" \
  --name "$KV_NAME" \
  --location "$LOCATION" \
  --enable-rbac-authorization false \
  -o none

# Grant current user secret permissions
CURRENT_USER=$(az ad signed-in-user show --query userPrincipalName -o tsv)
az keyvault set-policy \
  --name "$KV_NAME" \
  --upn "$CURRENT_USER" \
  --secret-permissions set get list delete \
  -o none

echo "Key Vault created. You MUST now populate secrets:"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'DATABASE-URL' --value '<your-supabase-pooler-url>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'DIRECT-URL' --value '<your-supabase-direct-url>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'SUPABASE-URL' --value '<your-supabase-url>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'SUPABASE-SERVICE-ROLE-KEY' --value '<your-service-role-key>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'JWT-SECRET' --value '<generate-96-hex-chars>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'ENCRYPTION-KEY' --value '<generate-64-hex-chars>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'RECOVERY-CODE-SECRET' --value '<generate-64-hex-chars>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'AI-API-KEY' --value '<your-gemini-key>'"
echo "  az keyvault secret set --vault-name $KV_NAME --name 'GROK-API-KEY' --value '<your-grok-key>'"
echo ""
echo "Generate secrets with:"
echo "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"  # JWT_SECRET"
echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"   # ENCRYPTION_KEY, RECOVERY_CODE_SECRET"

# 5. Create Container App Environment
echo "Creating Container App Environment..."
az containerapp env create \
  --name "cae-veil-social" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  -o none

# 6. Create Backend Container App (after secrets are set)
echo ""
echo "=== AFTER POPULATING KEY VAULT, RUN: ==="
echo ""
echo "# Create backend container app with secrets from Key Vault"
echo "az containerapp create \\"
echo "  --name veil-backend \\"
echo "  --resource-group $RG \\"
echo "  --environment cae-veil-social \\"
echo "  --image $ACR_LOGIN_SERVER/veil-backend:latest \\"
echo "  --target-port 3000 \\"
echo "  --ingress external \\"
echo "  --registry-server $ACR_LOGIN_SERVER \\"
echo "  --secrets \\"
echo "    database-url=\$(az keyvault secret show --vault-name $KV_NAME --name DATABASE-URL --query value -o tsv) \\"
echo "    direct-url=\$(az keyvault secret show --vault-name $KV_NAME --name DIRECT-URL --query value -o tsv) \\"
echo "    supabase-url=\$(az keyvault secret show --vault-name $KV_NAME --name SUPABASE-URL --query value -o tsv) \\"
echo "    supabase-service-role-key=\$(az keyvault secret show --vault-name $KV_NAME --name SUPABASE-SERVICE-ROLE-KEY --query value -o tsv) \\"
echo "    jwt-secret=\$(az keyvault secret show --vault-name $KV_NAME --name JWT-SECRET --query value -o tsv) \\"
echo "    encryption-key=\$(az keyvault secret show --vault-name $KV_NAME --name ENCRYPTION-KEY --query value -o tsv) \\"
echo "    recovery-code-secret=\$(az keyvault secret show --vault-name $KV_NAME --name RECOVERY-CODE-SECRET --query value -o tsv) \\"
echo "    ai-api-key=\$(az keyvault secret show --vault-name $KV_NAME --name AI-API-KEY --query value -o tsv) \\"
echo "    grok-api-key=\$(az keyvault secret show --vault-name $KV_NAME --name GROK-API-KEY --query value -o tsv) \\"
echo "  --env-vars \\"
echo "    DATABASE_URL=secretref:database-url \\"
echo "    DIRECT_URL=secretref:direct-url \\"
echo "    SUPABASE_URL=secretref:supabase-url \\"
echo "    SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key \\"
echo "    SUPABASE_STORAGE_BUCKET=veil-media \\"
echo "    JWT_SECRET=secretref:jwt-secret \\"
echo "    ENCRYPTION_KEY=secretref:encryption-key \\"
echo "    RECOVERY_CODE_SECRET=secretref:recovery-code-secret \\"
echo "    AI_API_KEY=secretref:ai-api-key \\"
echo "    GROK_API_KEY=secretref:grok-api-key \\"
echo "    NODE_ENV=production \\"
echo "    PORT=3000 \\"
echo "    WEBAUTHN_RP_ID=api.yourdomain.com \\"
echo "    WEBAUTHN_ORIGIN=https://app.yourdomain.com \\"
echo "    FRONTEND_ORIGIN=https://app.yourdomain.com \\"
echo "    TOTP_ISSUER=Veil Social"

echo ""
echo "=== Frontend Deployment (Azure Static Web Apps) ==="
echo "1. Push frontend to GitHub"
echo "2. Create Static Web App in Azure Portal or CLI:"
echo "   az staticwebapp create \\"
echo "     --name swa-veil-social \\"
echo "     --resource-group $RG \\"
echo "     --location $LOCATION \\"
echo "     --source https://github.com/yourusername/veil-social \\"
echo "     --branch main \\"
echo "     --app-location /frontend \\"
echo "     --output-location dist \\"
echo "     --api-location \"\" \\"
echo "     --login-with-github"
echo ""
echo "3. Configure build to use: npm run build"
echo "4. Add custom domain and update FRONTEND_ORIGIN in backend secrets"
echo "5. Update WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN in backend to match your API domain"

echo ""
echo "=== Summary ==="
echo "Resource Group: $RG"
echo "ACR: $ACR_NAME ($ACR_LOGIN_SERVER)"
echo "Key Vault: $KV_NAME"
echo "Container App Env: cae-veil-social"
echo ""
echo "Next steps:"
echo "1. Populate Key Vault secrets (see commands above)"
echo "2. Create backend Container App (see command above)"
echo "3. Deploy frontend to Static Web Apps"
echo "4. Configure custom domains and update CORS/WebAuthn origins"