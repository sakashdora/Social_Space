# Social Space

An anonymous social network: a React / TanStack Start frontend, served from **Cloudflare Pages**, and a
**Cloudflare Worker** API that stores data in **D1** (SQLite) and media in **R2**. Everything runs on
Cloudflare's free tier. Sign-in is by passkey or handle + passphrase. No email address or phone number is ever requested.

## Architecture

| Part | Runtime | Storage |
| --- | --- | --- |
| `frontend/` (React 19, TanStack Router, Tailwind v4) | Cloudflare Pages (static, prerendered) | none |
| `backend/` (Worker, Prisma 7 + D1 adapter, zod) | Cloudflare Workers | D1 database `social-space` |
| Media uploads and delivery | Worker (verifies files) | R2 bucket `veil-media` |
| Retention job | Workers Cron Trigger (daily 02:00 UTC) | — |

## Local development

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run generate                       # Prisma client for the Worker
cp backend/.dev.vars.example backend/.dev.vars   # then replace each value with a random secret
npm --prefix backend run db:migrate:local         # creates the local D1 database
npm run dev:api                        # http://127.0.0.1:8787
```

In a second terminal, set `VITE_API_URL=http://127.0.0.1:8787` in `frontend/.env` (see `frontend/.env.example`) and run `npm run dev:web`.

## Verify

```bash
npm run check          # secret scan, typecheck, lint, tests, builds
npm run check:secrets -- --dist   # after a build: scans the browser bundle too
```

Tests run the real request pipeline against a throwaway SQLite database and an in-memory R2 stand-in.
They read no production credentials.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the step-by-step Cloudflare setup, secrets, and the GitHub Actions workflow.

## Security

- Secrets live only in Cloudflare (`wrangler secret put`) or in local, git-ignored `.dev.vars`. They are never in the frontend bundle or in git. `npm run check:secrets` enforces this in CI.
- The browser receives a Content-Security-Policy that allows scripts only by hash and blocks inline injection (generated at build time as `_headers`).
- Passphrases are stored as salted PBKDF2-SHA256 hashes (600,000 iterations). Recovery codes and TOTP secrets are protected as described in [SECURITY.md](SECURITY.md).
- Uploads are verified from their magic bytes, sized against the reservation, and metadata-stripped (JPEG, PNG, WebP). See [SECURITY.md](SECURITY.md) for the media limits.

Further reading: [SECURITY.md](SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md). The historical audit documents (`AUDIT_REPORT.md`, `PROJECT_ANALYSIS.md`, `REMEDIATION.md`, and the others) describe the earlier Vercel and Supabase deployment and are kept for reference only.
