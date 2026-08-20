# Vercel Deployment Guide for VEIL Social Space

This guide details how to deploy the **VEIL Social Space** application to Vercel in a production-ready serverless environment.

---

## Architecture Overview

The repository is structured as a monorepo containing:
- **`frontend/`**: Vite + React 19 + TanStack Start frontend.
- **`backend/`**: Express.js REST API with Prisma ORM and Supabase storage.
- **`api/index.js`**: Serverless Function bridge exporting the Express app for Vercel.

When deployed on Vercel:
- Static frontend assets are served directly via Vercel's Edge CDN (`frontend/dist/client`).
- API requests (`/api/*`, `/v1/*`, `/healthz`) are routed to the Vercel Serverless Function (`api/index.js`).
- Background cleanup routines are triggered every 10 minutes via Vercel Cron (`/api/cron/retention`).

---

## Step 1: Database Setup (Managed PostgreSQL)

> [!IMPORTANT]
> Vercel Serverless Functions are stateless. Local SQLite (`dev.db`) will **not** persist. You must use a remote PostgreSQL database (such as **Supabase PostgreSQL**, **Neon**, or **AWS RDS**).

1. Create a PostgreSQL database instance (e.g. on [Supabase](https://supabase.com) or [Neon](https://neon.tech)).
2. Retrieve your connection strings:
   - **`DATABASE_URL`**: Pooled connection URL (transaction mode, e.g. `postgres://...:6543/postgres?pgbouncer=true`).
   - **`DIRECT_URL`**: Direct connection URL (used by Prisma migrations/DDL, e.g. `postgres://...:5432/postgres`).
3. Run migrations on your target database before deploying:
   ```bash
   cd backend
   npx prisma db push
   ```

---

## Step 2: Configure Vercel Environment Variables

In your Vercel Project Dashboard (**Settings > Environment Variables**), add the following required secrets:

| Variable Name | Required | Example / Format | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production mode & strict validations |
| `DATABASE_URL` | Yes | `postgres://user:pass@host:6543/db?pgbouncer=true` | Pooled DB connection string for Prisma |
| `DIRECT_URL` | Yes | `postgres://user:pass@host:5432/db` | Direct DB connection string for Prisma DDL |
| `JWT_SECRET` | Yes | 32+ character random string | JWT signing key |
| `ENCRYPTION_KEY` | Yes | Exactly 64 hex characters (32 bytes) | AES data encryption key |
| `RECOVERY_CODE_SECRET` | Yes | 32+ character random string | HMAC secret for recovery codes |
| `SUPABASE_URL` | Yes | `https://your-project.supabase.co` | Supabase project URL for storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJhbG...` | Supabase admin key for media bucket ops |
| `SUPABASE_STORAGE_BUCKET` | Optional | `veil-media` | Bucket name (defaults to `veil-media`) |
| `FRONTEND_ORIGIN` | Yes | `https://your-app.vercel.app` | CORS allowed origin(s), comma-separated |
| `AI_API_KEY` | Optional | `AIzaSy...` | Gemini AI key for moderation & AI labels |
| `AI_MODEL` | Optional | `gemini-2.5-flash` | Gemini model name |
| `CRON_SECRET` | Optional | Random secret string | Authorization for Vercel Cron endpoint |

---

## Step 3: Deployment Options

### Option A: Vercel Dashboard (Git Integration - Recommended)

1. Push your code to GitHub / GitLab / Bitbucket.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New Project**.
3. Import your repository.
4. Keep the **Root Directory** as `./` (project root).
5. Vercel will automatically detect `vercel.json`. Verify build settings:
   - **Framework Preset**: `Other`
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist/client`
6. Add your **Environment Variables** (from Step 2).
7. Click **Deploy**.

---

### Option B: Vercel CLI Deployment

1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Log in to Vercel:
   ```bash
   vercel login
   ```
3. Deploy to Preview:
   ```bash
   vercel
   ```
4. Deploy to Production:
   ```bash
   vercel --prod
   ```

---

## Step 4: Verification & Post-Deployment Checklist

After deployment completes:

1. **Verify Health Endpoint**:
   Visit `https://<your-app>.vercel.app/healthz`. Expected response:
   ```json
   {
     "status": "OK",
     "timestamp": "2026-08-20T19:20:00.000Z",
     "services": { "database": "UP" }
   }
   ```

2. **Verify Frontend**:
   Open `https://<your-app>.vercel.app/` in browser to confirm static bundle loads and routes function properly.

3. **Verify Vercel Cron Job**:
   In Vercel Dashboard, go to **Settings > Crons** to confirm the retention cleanup schedule (`/api/cron/retention`) is active.

---

## Troubleshooting

- **500 Error on Database Query**: Ensure `DATABASE_URL` is correct and PostgreSQL database is accessible from Vercel's IP ranges (enable SSL mode `?sslmode=require` if required by host).
- **Prisma Client Missing**: The build command `npm run build` automatically executes `npx prisma generate`. If Prisma client errors occur, verify `package.json` build scripts.
- **CORS Error**: Ensure `FRONTEND_ORIGIN` matches your exact Vercel deployment domain (including `https://`).
