# Veil Social — Azure Deployment Status

_Last updated: 2026-07-12_

## Status: ✅ Deployment COMPLETE (Azure Container Apps)

The full-stack app (Express backend + TanStack Start frontend) is **live, healthy, and CORS-verified** on Azure Container Apps. The originally-planned Static Web Apps (SWA) path was **abandoned** because the frontend is an SSR/Nitro build that emits no static `index.html`, which SWA (no Node runtime) cannot serve.

---

## Live endpoints (verified)

| Tier      | URL                                                                                  | Status |
|-----------|--------------------------------------------------------------------------------------|--------|
| Frontend  | https://veil-frontend.livelymushroom-070d4053.eastus.azurecontainerapps.io           | HTTP 200 (SSR, 35 KB HTML, `<title>` present) |
| Backend   | https://veil-backend.livelymushroom-070d4053.eastus.azurecontainerapps.io            | `/healthz` → `{"status":"OK","database":"UP"}` |
| Backend API | `POST/GET …/v1/*`, `/api/*` (posts, auth, totp, passkeys, media, ai, rss, chats) | CORS preflight `204`, `Access-Control-Allow-Origin` = frontend URL, `Allow-Credentials: true` |

Data layer: **Supabase PostgreSQL** (external, schema applied via `prisma migrate deploy` against `DIRECT_URL`). Media: **Supabase Storage** (`veil-media` bucket).

---

## Azure resources (resource group `rg-veil-social`, eastus)

| Resource | Name | Notes |
|----------|------|-------|
| Container App Env | `cae-veil-social` | Shared env for both apps |
| Container App (backend) | `veil-backend` | Image `acrveil171907.azurecr.io/veil-backend:v1`, port 3000, 1–2 replicas |
| Container App (frontend) | `veil-frontend` | Image `acrveil171907.azurecr.io/veil-frontend:v1`, port 3000 (SSR/Nitro via `vite preview --host`), 1–2 replicas |
| ACR | `acrveil171907` | Basic, admin enabled, cloud builds via ACR tasks |
| Key Vault | `kvveil171907` | Secrets populated from `.env` (not used by app per CLI limitation; app uses encrypted Container App secrets instead) |
| ACR tasks | `build-veil-backend`, `build-veil-frontend` | Cloud builds (no local Docker needed) |
| Log Analytics | `workspace-rgveilsocialTeH6` | Auto-created with CA env |

### ⚠️ Leftover / stale resources to clean up (from a prior attempt)
These were created by an earlier failed attempt and are **not** used by the current deployment:
- ACR `acrveilsocial156613` (referenced by the old `backend/containerapp.yaml`, which contains **hardcoded secrets**)
- Key Vault `kv-veil-social-707061`
- Log Analytics `workspace-rgveilsocialcvXJ`
- Local file `backend/containerapp.yaml` (untracked, contains real Supabase + AI + auth secrets) — **delete locally**; it is now git-ignored.

---

## Mistakes found & fixed during deployment

1. **Secrets hardcoded in `backend/containerapp.yaml`** → moved to encrypted Azure Container App secrets (sourced from `.env`); file git-ignored.
2. **No DB migration step** → ran `prisma migrate deploy` against `DIRECT_URL` (schema `directUrl`); Supabase schema now applied.
3. **WebAuthn/CORS set to `localhost`** → set to the real frontend URL (`WEBAUTHN_RP_ID/ORIGIN`, `FRONTEND_ORIGIN`).
4. **`backend/.dockerignore` excluded `Dockerfile`** → broke `az acr build`; fixed.
5. **Dockerfile bug** → `node_modules` copied from the `deps` stage (no Prisma client); now copied from `builder` stage (post `prisma generate`). Also added `/app/tmp/uploads` ownership so the `nodejs` user can write.
6. **Frontend build is SSR, not static** → cannot run on SWA; deployed as a Container App running the Nitro server (`npm run start` / `vite preview --host 0.0.0.0`). `npm run preview` alone bound only to localhost → 503.
7. **Stale pre-existing `veil-backend` container app** pointed at the old `acrveilsocial156613` → deleted and recreated cleanly with the correct ACR + inline secrets.
8. **Azure CLI quirks** → `az acr build` log streaming crashes on `✓` (cp1252); used **ACR tasks + `--no-wait` + polling** instead. `az containerapp update --image <same tag>` doesn't create a revision → used **retag (`v1`)** to force new revisions.

---

## Repeatable deployment

`deploy-azure.ps1` (repo root) was rewritten to capture the working flow:
- Creates RG, ACR, CA Env.
- Cloud-builds backend & frontend images (no local Docker).
- Creates both Container Apps (inline secrets from `.env`, ACR pull).
- Aligns backend CORS/WebAuthn to the frontend URL.
- Runs `prisma migrate deploy`.

Prereqs: `az login`, Node.js + npm (for `prisma migrate deploy`), and a populated `backend/.env`.

---

## Not done / out of scope
- **Static Web Apps (SWA):** not used (frontend is SSR-only; no `index.html` to serve).
- **Custom domain / TLS:** using default `*.azurecontainerapps.io` URLs (HTTPS auto-provisioned).
- **Upstash Redis:** not configured → backend uses in-memory challenge store (fine for single instance).
- **GitHub Actions CI:** `frontend-deploy.yml` / `backend-deploy.yml` exist but require repo secrets and a static frontend build to be useful; currently the live deploy is via the PowerShell script + ACR tasks.
- **Git commit/push:** changes are uncommitted locally (secrets intentionally excluded via `.gitignore`).
