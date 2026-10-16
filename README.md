# VEIL Social

A React 19 / TanStack Start social application with an Express API, Prisma/PostgreSQL, private Supabase Storage, and optional Supabase Realtime notifications. The deployment target is Vercel + Supabase.

## Start locally

Use Node.js 22.12 or newer. Install from the repository root with `npm ci`; the root `package-lock.json` is the workspace lockfile.

1. Copy `backend/.env.example` to `backend/.env` and configure a development PostgreSQL database and independent random secrets.
2. Copy `frontend/.env.example` to `frontend/.env`. Leave `VITE_API_URL` empty for the local Vite proxy or same-origin Vercel deployment.
3. Apply migrations to your **development** database: `npm exec --workspace backend -- prisma migrate deploy`.
4. In separate terminals run `npm run dev:backend` and `npm run dev:frontend`. Open http://localhost:5173.

PostgreSQL is required; this application does not use SQLite. Media requires a private Supabase bucket. AI providers and Redis are optional; absent Redis, authentication challenges use PostgreSQL. AI writing tools return an unavailable error without a working provider.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tests use an isolated local PostgreSQL instance, or `TEST_DATABASE_URL` pointing to a local database whose name starts with `veil_test`. They never use the development/production database URL. Test databases are disposable; the suite truncates their tables. Portable test clusters are left under ignored `tmp/` for diagnostics and are stopped after the run. External storage is mocked in API tests; video-processing tests run FFmpeg/FFprobe on generated local fixtures. Encryption tests exercise Web Crypto and IndexedDB.

The build generates Prisma Client, prerenders the frontend, and copies static assets to `dist/`. It does **not** apply database migrations.

## Implemented behavior

- Anonymous/pseudonymous posts with enforced audiences, expiry, engagement permissions, and polls.
- Private storage uploads with server-issued reservations, ownership checks, quotas, actual image/video inspection, metadata processing, and retryable cleanup.
- Browser-encrypted direct messages and attachments, paginated history, disappearing timers, and optional realtime invalidation notifications with polling fallback.
- Passphrases, passkeys, TOTP, one-use recovery codes, shared rate limits, and account deletion.
- Saved follows, reports, appeals, waitlist enrollment, and a moderator review-status queue.
- Optional AI writing/moderation providers and news RSS.

See [deployment setup](DEPLOYMENT.md), [security boundaries](SECURITY.md), and [repair status](REMEDIATION.md). [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) records the original audit at commit `7d1dcec`; older audit scores are not current assurance.

## Free service choice

For this project, Supabase Realtime + Storage is the simplest integrated starting point alongside Vercel. The free plan has finite storage, bandwidth, and realtime quotas; it is suitable for a small prototype, not unlimited video hosting. [Deployment notes](DEPLOYMENT.md#free-plan-capacity) compare the current limits and explain when Cloudflare R2 may be useful.
