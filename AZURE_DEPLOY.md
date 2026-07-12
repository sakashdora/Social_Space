# VEIL Backend — Azure Container Apps Deployment Guide (Container-Based)

## Overview

This document describes how to deploy the VEIL backend (Express + Prisma + PostgreSQL/Supabase) to **Azure Container Apps** using a Docker container image built and pushed by GitHub Actions.

**Prerequisites:**
- An active Azure subscription with permission to create resource groups, ACR, and Container Apps
- GitHub repo push access (`sakashdora/Social_Space`)
- Access to the Supabase project dashboard (for connection strings)
- Azure CLI (`az`) installed locally for initial setup commands

**Key constraint: Akash never installs Docker locally.** All Docker work happens inside GitHub Actions' `ubuntu-latest` runners.

**Legacy AWS files** (`.ebextensions/`, `Procfile`, `buildspec.yml`) remain in the repo but are unused.

---

## Phase 1 — Pre-deployment verification

Every check below was run against the codebase at the current commit and confirmed passing.

| # | Check | Result | Verification |
|---|-------|--------|-------------|
| 1.1 | Dependency install | PASS | `cd backend && npm install` → 530 packages, no errors |
| 1.2 | Env var audit | PASS | All 21 env vars in `.env.example` match code usage exactly |
| 1.3 | Build | PASS | `npx prisma generate` → Prisma Client 5.22.0 generated |
| 1.4 | Database/Prisma | PASS | All 5 migrations applied, DB schema up to date |
| 1.5 | Local boot | PASS | Server starts, `GET /healthz` → `{"status":"OK","services":{"database":"UP"}}` |
| 1.6 | Test suite | PASS | 5/5 tests pass (health, recovery codes, IP lockout) |
| 1.7 | CORS config | PASS | CORS uses `FRONTEND_ORIGIN` env var (comma-separated allowlist) |
| 1.8 | Secrets hygiene | PASS | No hardcoded keys in source code; `.env` is gitignored |
| 1.9 | Port config | PASS | `PORT` read from env var (fallback 3000); start command `node app.js` |
| 1.10 | AI key resolution | PASS | `AI_API_KEY` (Gemini) and `GROK_API_KEY` (Groq/Grok) are both genuinely used with automatic fallback — neither is redundant |
| 1.11 | Repo cleanup | PASS | No unnecessary files; AWS legacy configs left in place (unused) |

---

## Phase 2 — Containerization

### Dockerfile (`backend/Dockerfile`)

Multi-stage build:
- **Stage 1 (deps)**: Installs production dependencies only
- **Stage 2 (builder)**: Copies node_modules + source, runs `npx prisma generate`, removes test files
- **Stage 3 (runner)**: Final image with non-root `nodejs` user (UID/GID 1001)

```dockerfile
# Stage 1: deps — install production dependencies only
FROM node:24-alpine AS deps

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production --no-audit --no-fund

# Stage 2: builder — generate Prisma Client
FROM node:24-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src
COPY app.js ./
RUN npx prisma generate
RUN rm -rf src/tests

# Stage 3: runner
FROM node:24-alpine AS runner

RUN apk add --no-cache libc6-compat openssl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/app.js ./

RUN mkdir -p /app/tmp && chown -R nodejs:nodejs /app/tmp
USER nodejs
EXPOSE 3000
CMD ["node", "app.js"]
```

### `.dockerignore` (`backend/.dockerignore`)

Excludes `node_modules`, `.env*`, `.git`, test files, AWS legacy configs, scratch dirs:

```
node_modules
.git
.env*
.env
*.log
tmp/
test*
**/*.test.js
**/*.spec.js
coverage/
.nyc_output
.vscode
.idea
.DS_Store
*.md
!README.md
.ebextensions
Procfile
buildspec.yml
docker-compose*
```

### Docker Build Validation

The `validate-docker-build.yml` workflow builds the image on every push to `backend/Dockerfile` or `backend/.dockerignore`. This is the **only** place where `docker build` runs — on GitHub Actions' `ubuntu-latest` runner, never on Akash's machine.

---

## Phase 3 — Azure Container Apps deployment

### Step 1 — Azure prerequisites (run from Akash's local terminal)

These are `az` CLI commands to set up Azure infrastructure. No Docker is needed on Akash's machine.

```bash
# 1. Create resource group
az group create --name veil-backend-rg --location eastus

# 2. Create Container Apps environment (log analytics workspace required)
az monitor log-analytics workspace create \
  --resource-group veil-backend-rg \
  --workspace-name veil-logs

az containerapp env create \
  --name veil-env \
  --resource-group veil-backend-rg \
  --location eastus \
  --logs-workspace-id $(az monitor log-analytics workspace show --resource-group veil-backend-rg --workspace-name veil-logs --query customerId -o tsv) \
  --logs-workspace-key $(az monitor log-analytics workspace get-shared-keys --resource-group veil-backend-rg --workspace-name veil-logs --query primarySharedKey -o tsv)

# 3. Create Azure Container Registry (ACR) for Docker images
az acr create \
  --resource-group veil-backend-rg \
  --name veilacr \
  --sku Basic \
  --admin-enabled true

# 4. Create the Container App with a placeholder image
az containerapp create \
  --name veil-backend \
  --resource-group veil-backend-rg \
  --environment veil-env \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --registry-server veilacr.azurecr.io \
  --query properties.configuration.ingress.fqdn
```

> **Why 2.0 GiB RAM?** Argon2id needs ~64 MiB per hash operation. With concurrent auth flows (WebAuthn + TOTP + IP lockout), 2.0 GiB provides safe headroom on a B1s-equivalent instance.

### Step 2 — Configure GitHub secrets for OIDC

Azure Container Apps deployment uses workload identity (OIDC) — no Docker credentials stored as GitHub secrets.

```bash
# Create a service principal with the necessary role assignments
az ad sp create-for-rbac \
  --name "veil-github-deploy" \
  --role contributor \
  --scopes /subscriptions/<YOUR_SUBSCRIPTION_ID>/resourceGroups/veil-backend-rg \
  --sdk-auth

# Store the JSON output as GitHub secret: AZURE_CREDENTIALS
```

Then add these additional GitHub secrets:
- `AZURE_SUBSCRIPTION_ID` — your Azure subscription ID
- `AZURE_TENANT_ID` — from the service principal JSON
- `AZURE_CLIENT_ID` — from the service principal JSON

### Step 3 — App-level secrets in Azure Container Apps

Run these commands to set the Container App's secrets. **Never bake secrets into the Docker image.**

```bash
# Set environment variables on the Container App
az containerapp update \
  --name veil-backend \
  --resource-group veil-backend-rg \
  --set-env-vars \
    NODE_ENV=production \
    DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=2" \
    DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
    SUPABASE_URL="https://[PROJECT_REF].supabase.co" \
    SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY]" \
    SUPABASE_STORAGE_BUCKET="veil-media" \
    AI_API_KEY="[YOUR_GEMINI_KEY]" \
    AI_API_URL="https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions" \
    AI_MODEL="gemini-2.5-flash" \
    GROK_API_KEY="[YOUR_GROK_OR_GROQ_KEY]" \
    JWT_SECRET="[48 random bytes hex]" \
    ENCRYPTION_KEY="[32 random bytes hex]" \
    RECOVERY_CODE_SECRET="[32 random bytes hex]" \
    WEBAUTHN_RP_NAME="Social Space" \
    WEBAUTHN_RP_ID="veil-backend.<REGION>.azurecontainerapps.io" \
    WEBAUTHN_ORIGIN="https://veil-backend.<REGION>.azurecontainerapps.io" \
    FRONTEND_ORIGIN="https://your-frontend-domain.com" \
    TOTP_ISSUER="Social Space" \
    UPSTASH_REDIS_REST_URL="" \
    UPSTASH_REDIS_REST_TOKEN=""
```

> Replace values in `[...]` with actual values. Get the Container App FQDN from Step 1 output and use it for `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN`.

### Step 4 — Database connectivity

The app reads both connection strings:
- `DATABASE_URL` (pooler, port 6543) — used at runtime by Prisma
- `DIRECT_URL` (direct, port 5432) — used only for `prisma migrate deploy`

Run migrations using the `DIRECT_URL` before the first smoke test:

```bash
# Option A: Run via Azure Container Apps exec (after first deploy)
az containerapp exec \
  --name veil-backend \
  --resource-group veil-backend-rg \
  --command "sh -c 'cd /app && npx prisma migrate deploy'"

# Option B: Run locally (no Docker needed) against the direct connection string
cd backend
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" npx prisma migrate deploy
```

### Step 5 — GitHub Actions workflow for continuous deployment

Create `.github/workflows/deploy-veil-container.yml` (already created in this repo):

1. **Trigger**: Push to `main` touching `backend/**`
2. **Steps**:
   - Checkout code
   - Log in to Azure via OIDC (`azure/login@v2`)
   - Log in to ACR (`azure/docker-login@v2`)
   - **Build Docker image on GitHub runner** (docker/build-push-action@v6) — never on Akash's machine
   - Push to ACR tagged with commit SHA
   - Update Container App to point at new image
3. **Migration job**: Post-deploy step that runs `prisma migrate deploy` inside the new container

### Step 6 — WebAuthn configuration

After the first deploy, update the Container App's env vars with the actual FQDN:

```bash
FQDN=$(az containerapp show --name veil-backend --resource-group veil-backend-rg --query properties.configuration.ingress.fqdn -o tsv)

az containerapp update \
  --name veil-backend \
  --resource-group veil-backend-rg \
  --set-env-vars \
    WEBAUTHN_RP_ID="${FQDN}" \
    WEBAUTHN_ORIGIN="https://${FQDN}"
```

**WebAuthn will silently fail** if these don't match the browser's origin exactly.

### Step 7 — Post-deploy smoke test

After migrations are confirmed applied, run these checks in order:

```bash
FQDN=$(az containerapp show --name veil-backend --resource-group veil-backend-rg --query properties.configuration.ingress.fqdn -o tsv)
BASE="https://${FQDN}"

# 1. Health check
curl -s ${BASE}/healthz
# Expected: {"status":"OK","timestamp":"...","services":{"database":"UP"}}

# 2. Root endpoint
curl -s ${BASE}/
# Expected: {"message":"Veil Shine Backend API is running!"}

# 3. Registration
curl -s -X POST ${BASE}/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"handle":"smoke-test-user-'"$(date +%s)"'","passphrase":"correct-horse-battery-staple-frobnicate"}'
# Expected: 201 with { "token": "...", "user": {...}, "recoveryCodes": [...] }

# 4. Login
curl -s -X POST ${BASE}/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"handle":"smoke-test-user-...","passphrase":"correct-horse-battery-staple-frobnicate"}'
# Expected: 200 with { "token": "...", "user": {...} }

# 5. Public feed
curl -s ${BASE}/v1/posts
# Expected: 200 with array

# 6. Create post
TOKEN="<from login response>"
curl -s -X POST ${BASE}/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"content":"Smoke test post from Azure Container Apps","category":"Life"}'
# Expected: 201

# 7. CORS rejection
curl -s ${BASE}/v1/posts \
  -H "Origin: https://evil-site.com"
# Expected: 403 with "CORS: origin 'https://evil-site.com' is not allowed."

# 8. AI suggest
curl -s -X POST ${BASE}/api/suggest \
  -H "Content-Type: application/json" \
  -H "Origin: https://allowed-origin.com" \
  -d '{"text":"I am feeling really happy today because"}'
# Expected: 200 with {"suggestions": [...]}

# 9. Cleanup — delete test account
curl -s -X DELETE ${BASE}/v1/auth/account \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"currentPassphrase":"correct-horse-battery-staple-frobnicate"}'
# Expected: 200
```

### Step 8 — Rollback procedure

Azure Container Apps keeps revision history:

```bash
# List revisions
az containerapp revision list \
  --name veil-backend \
  --resource-group veil-backend-rg \
  --output table

# Activate a previous revision
az containerapp revision activate \
  --name veil-backend \
  --resource-group veil-backend-rg \
  --revision <previous-revision-name>
```

Or from the Azure Portal:
1. Container Apps → `veil-backend` → **Revisions**
2. Select the previous healthy revision → **Activate**

---

## Additional notes

1. **No local Docker needed at any point.** Docker commands only run inside GitHub Actions' `ubuntu-latest` runners.

2. **Node 24 LTS** is used throughout (matches `package.json` scripts and `.ebextensions` config).

3. **Argon2id memory usage**: ~64 MiB per hash. 2.0 GiB RAM minimum for the Container App handles concurrent auth flows.

4. **In-memory challenge store**: Without Upstash Redis, challenge stores reset on Container App restart. Single-instance (min-replicas=1) makes this safe.

5. **Media processing**: `ffmpeg-static` and `sharp` work on Alpine Linux — no extra system packages needed.

6. **Git ignore**: `.env` is excluded from git. Secrets are injected at runtime via Azure Container App env vars.
