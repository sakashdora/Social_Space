# Production Deployment Guide — VEIL Social Space

This document outlines the deployment architecture, configuration steps, build process, and troubleshooting guide for running VEIL Social Space in production.

---

## 1. Deployment Architecture & Tech Stack

VEIL is deployed on a highly scalable, multi-tier containerized stack:

- **Hosting Platform**: Azure Container Apps (ACA)
- **Container Registry**: Azure Container Registry (ACR)
- **Database**: Supabase PostgreSQL (Managed Database)
- **Storage**: Supabase Storage Buckets
- **CI/CD Build System**: ACR Cloud Build Tasks (managed via Azure CLI)
- **Runtime Environment**: Node.js v20+

---

## 2. Infrastructure Components

The following active Azure resources in the resource group `rg-veil-social` power the deployment:

| Resource Name | Service Type | Role in Project |
|---|---|---|
| `cae-veil-social` | Container App Environment | Host environment for both front and backend containers. |
| `veil-backend` | Container App | Serves the Express REST API (port 3000). |
| `veil-frontend` | Container App | Serves the TanStack Start SSR application (port 3000). |
| `acrveil171907` | Container Registry | Stores Docker images and manages build task tasks. |
| `kvveil171907` | Key Vault | Primary secure secret vault. |
| `workspace-rgveilsocialtBUB` | Log Analytics | Centralized log aggregator and health monitor. |

---

## 3. Environment Variables (Required Names Only)

### Backend Container (`veil-backend`)
- `PORT`: Network port container listens on (defaults to 3000)
- `NODE_ENV`: Production mode switch (`production`)
- `DATABASE_URL`: Connection string to PostgreSQL Pooler
- `DIRECT_URL`: Connection string to PostgreSQL direct port (for migrations)
- `SUPABASE_URL`: API URL of Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret API key
- `SUPABASE_STORAGE_BUCKET`: Storage bucket name (`veil-media`)
- `JWT_SECRET`: Secret hash for signing JSON Web Tokens
- `ENCRYPTION_KEY`: 64 hex character string for AES data encryption
- `RECOVERY_CODE_SECRET`: Secret hash for recovery code HMACs
- `AI_API_KEY`: API token for Google Gemini
- `AI_API_URL`: API gateway endpoint for Google Gemini
- `AI_MODEL`: Name of AI model being used (`gemini-2.5-flash`)
- `GROK_API_KEY`: API token for Grok
- `WEBAUTHN_RP_NAME`: WebAuthn Relying Party name
- `WEBAUTHN_RP_ID`: Frontend FQDN (without protocol/port)
- `WEBAUTHN_ORIGIN`: Full frontend URL
- `FRONTEND_ORIGIN`: Full frontend URL (supports comma-separated list)
- `TOTP_ISSUER`: Name displayed in authentication apps (e.g. Google Authenticator)

### Frontend Container (`veil-frontend`)
- `NODE_ENV`: Production mode switch (`production`)
- `PORT`: Network port container listens on (defaults to 3000)
- `BACKEND_API_URL`: Direct URL of the backend Container App

---

## 4. Docker Build Process

Both frontend and backend utilize multi-stage Docker builds to reduce final image sizes and secure runtime environments.

### Backend Dockerfile (`backend/Dockerfile`)
1. **Dependency Stage**: Installs dependencies.
2. **Build Stage**: Copies codebase, generates Prisma Client (`prisma generate`), and prepares node modules.
3. **Runtime Stage**: Copies build outputs, runs under a non-root `nodejs` user, and exposes port `3000`.

### Frontend Dockerfile (`frontend/Dockerfile`)
1. **Build Stage**: Compiles client assets and the Nitro server bundle using `vite build`.
2. **Runtime Stage**: Copies the `dist` directory and runs the Nitro server via `vite preview --host 0.0.0.0 --port 3000` to serve the SSR app.

---

## 5. Deployment Step-by-Step

All deployment tasks are automated via the root script [deploy-azure.ps1](file:///e:/VEIL_SOCIAL/deploy-azure.ps1).

### Execution Flow:
1. **Azure Session Check**: Validates that you are logged in to the Azure CLI.
2. **Resource Provisioning**: Sets up the resource group, ACR, and Container App Environment if missing.
3. **Cloud Build**: Triggers an ACR task that compiles and pushes the backend and frontend Docker images in the cloud (avoiding local Docker daemon requirements).
4. **Secrets Injection**: Sourced from the local `backend/.env` file and updated as ACA secrets.
5. **Replicas Provisioning**: Provisions both container apps, exposing them via public HTTPS ingresses.
6. **Domain Alignment**: Automatically updates backend CORS settings matching the generated frontend domain.
7. **Database Migration**: Executes `npx prisma migrate deploy` locally to push migrations directly to Supabase.

---

## 6. Monitoring & Logging

Logs from both frontend and backend are aggregated into the Log Analytics Workspace.
- **Accessing logs via Azure CLI**:
  ```bash
  az containerapp logs show --name veil-backend --resource-group rg-veil-social
  ```
- **Health Checks**: The backend exposes a `/healthz` endpoint verifying SQL database responsiveness. The ACA environment polls this to monitor replica container lifecycles.

---

## 7. Troubleshooting & Recovery

### Image Upload Failures (400 / 403 / 404)
- **Check Storage Bucket**: Ensure the `veil-media` bucket exists in your Supabase console under Storage.
- **Check Service Role Key**: Verify that `SUPABASE_SERVICE_ROLE_KEY` in Azure is up-to-date and matches the key on your Supabase dashboard (Settings -> API).
- **Restart Container**: Re-run the secret set command and restart the active revision if credentials change:
  ```bash
  az containerapp revision restart --name veil-backend --resource-group rg-veil-social --revision [REVISION_NAME]
  ```

### Database Migration Failures
- If the schema gets desynchronized, navigate to the `backend/` folder and manually run:
  ```bash
  npx prisma migrate deploy
  ```
  Ensure your local `backend/.env` has `DIRECT_URL` configured correctly.
