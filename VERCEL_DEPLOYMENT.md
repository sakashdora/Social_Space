# Vercel Production Deployment Guide — VEIL Social Space

This guide outlines how to deploy VEIL Social Space (TanStack Start React 19 Frontend + Express Serverless API) to Vercel.

---

## 1. How the 404: NOT_FOUND Was Resolved

The initial `404: NOT_FOUND` error occurred because Vercel was configured with an isolated static output directory (`frontend/dist`) while the application uses **TanStack Start Server-Side Rendering (SSR)** alongside an Express API.

### Fix Applied:
1. **Unified Serverless Adapter ([api/index.js](file:///e:/VEIL_SOCIAL/api/index.js))**: Routes all incoming traffic through Express.
2. **Integrated SSR & Static Assets ([backend/app.js](file:///e:/VEIL_SOCIAL/backend/app.js))**: Express serves both client static assets (`frontend/dist/client`) and executes TanStack Start SSR (`frontend/dist/server/server.js`) for all frontend page routes, while preserving all Express REST API endpoints (`/api/*`, `/v1/*`, `/media/*`).
3. **Vercel Catch-All Rewrite ([vercel.json](file:///e:/VEIL_SOCIAL/vercel.json))**: Rewrites `/(.*)` to `/api/index.js`.

---

## 2. Redeploying to Vercel

To apply this update and fix the 404 error on your live deployment:

### Option A: Via GitHub Push (Automatic)
Commit and push these updated files to your GitHub `main` branch:
```bash
git add .
git commit -m "Fix Vercel 404 routing with unified SSR + Express serverless handler"
git push origin main
```
Vercel will trigger a new build and deploy automatically.

---

### Option B: Via Vercel CLI
Run in your project root:
```bash
npx vercel --prod
```

---

## 3. Environment Variables Checklist

Set the following environment variables in **Vercel Dashboard** -> **Project Settings** -> **Environment Variables**:

| Variable Name | Description | Example / Location |
|---|---|---|
| `NODE_ENV` | Production mode switch | `production` |
| `DATABASE_URL` | Supabase Postgres Connection Pooler URL | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase Postgres Direct Connection URL | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | Supabase Project API Endpoint | `https://[ref].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secret Service Role Key | `eyJ...` |
| `SUPABASE_STORAGE_BUCKET` | Media storage bucket name | `veil-media` |
| `JWT_SECRET` | Secret hash for signing JWT tokens | 64-char random hex string |
| `ENCRYPTION_KEY` | AES-256 data encryption key | 64-char random hex string |
| `RECOVERY_CODE_SECRET` | Secret hash for recovery codes | 64-char random hex string |
| `AI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `AI_API_URL` | Gemini OpenAI-compatible Chat API Endpoint | `https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions` |
| `AI_MODEL` | Gemini Model Identifier | `gemini-2.5-flash` |
| `GROK_API_KEY` | xAI Grok API Key | `xai-...` |
| `FRONTEND_ORIGIN` | Allowed production origin for CORS | `https://your-app.vercel.app` |

---

## 4. Architecture Diagram

```mermaid
graph TD
  User[Browser / Client] -->|HTTPS Request| Vercel[Vercel Serverless Function: api/index.js]
  Vercel --> Express[Express Server: backend/app.js]
  Express -->|/api/* & /v1/*| API[Express API Controllers]
  Express -->|Static Asset| Assets[frontend/dist/client]
  Express -->|Page Route / | SSR[TanStack Start SSR: frontend/dist/server/server.js]
  API -->|Prisma Client| SupabaseDB[(Supabase PostgreSQL)]
  API -->|Supabase SDK| SupabaseStorage[(Supabase Storage)]
  API -->|Axios HTTPS| AI[Gemini / Grok APIs]
```
