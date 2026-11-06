# Deployment on Cloudflare

This guide deploys Social Space on Cloudflare: the frontend on **Pages**, the API on a **Worker**, the database on **D1**, and media on **R2**. Run the commands from the repository root unless a step says otherwise.

## 0. Before you start

- Install Node.js 22.13 or newer and run `npm ci`.
- Log in with the Cloudflare CLI: `npx wrangler login` (opens a browser; nothing is stored in this repository).
- Free-plan CPU limit: Workers on the Free plan allow **10 ms of CPU per request**. Passphrase hashing (PBKDF2 with 600,000 iterations) takes longer than that, so sign-in and registration may fail with a CPU-limit error on the Free plan. See [Plan and CPU limits](#plan-and-cpu-limits) before going live.

## 1. Create the resources

```bash
npx wrangler d1 create social-space
npx wrangler r2 bucket create veil-media
```

Copy the `database_id` printed by the first command into `backend/wrangler.toml`, replacing the all-zero placeholder under `[[d1_databases]]`.

## 2. Set the Worker secrets

Generate each secret locally, then store it in Cloudflare. Secrets are never written to a file in the repository.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # run once per secret
cd backend
npx wrangler secret put JWT_SECRET
npx wrangler secret put RECOVERY_CODE_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put ENCRYPTION_KEY        # must be exactly 64 hex characters
```

Optional AI providers (leave unset to disable AI features):

```bash
cd backend
npx wrangler secret put AI_API_KEY
npx wrangler secret put GROK_API_KEY
```

Each `secret put` prompts for the value. Paste it, and the value will not appear in your shell history or in this repository.

## 3. Set the public settings

Edit the `[vars]` block in `backend/wrangler.toml`:

- `FRONTEND_ORIGIN`, `WEBAUTHN_ORIGIN`: the exact origin of the Pages site, for example `https://social-space.pages.dev`.
- `WEBAUTHN_RP_ID`: the host part of that origin, without a scheme or port.
- `MODERATOR_HANDLES`: comma-separated handles allowed to use the moderation queue.

## 4. Apply the database schema and deploy the API

```bash
npm --prefix backend run db:migrate:remote
npm run deploy:api
```

Note the Worker URL printed at the end, for example `https://veil-social-api.<subdomain>.workers.dev`. Check it:

```bash
curl https://veil-social-api.<subdomain>.workers.dev/healthz
```

## 5. Create the Pages project and deploy the frontend

```bash
npx wrangler pages project create social-space --production-branch=main
VITE_API_URL=https://veil-social-api.<subdomain>.workers.dev npm run deploy:web
```

`VITE_API_URL` is the only build-time setting. It is public, so it may appear in the bundle.

If the Pages URL differs from the one in step 3, update `FRONTEND_ORIGIN`, `WEBAUTHN_ORIGIN` and `WEBAUTHN_RP_ID` and run `npm run deploy:api` again.

## 6. Automate with GitHub Actions (optional)

`.github/workflows/deploy.yml` deploys `main` after the API and the frontend build pass.

Repository settings to add:

- **Environment `production`** with the secrets below (protection rules are recommended):
  - `CLOUDFLARE_API_TOKEN`: an API token with *Workers Scripts: Edit*, *D1: Edit*, *Workers R2 Storage: Edit* and *Cloudflare Pages: Edit* on the account.
  - `CLOUDFLARE_ACCOUNT_ID`: the account id from the Cloudflare dashboard.
- **Environment variable** `VITE_API_URL` (repository or environment variable, not a secret).

Worker secrets from step 2 stay in Cloudflare; the workflow never sets them.

## 7. Verify the deployment

- Open the Pages URL, create a handle, and sign out and back in.
- Upload a photo and publish a post with it.
- Check the Worker logs: `npx wrangler tail --cwd backend`.

## Local development against a remote D1

`npm --prefix backend run db:migrate:local` creates a local D1 database with the same schema. Local secrets come from `backend/.dev.vars` (copy `backend/.dev.vars.example`). This file is git-ignored.

## Plan and CPU limits

| Resource | Free plan | Notes |
| --- | --- | --- |
| Workers requests | 100,000 per day | Each API call is one request |
| Workers CPU | 10 ms per request | Passphrase hashing exceeds this; see below |
| D1 | 5 million rows read and 100,000 rows written per day; 5 GB storage | Enough for a small community |
| R2 | 10 GB storage; free operation quota | Media is deleted when posts or messages expire |
| Pages | Unlimited requests and bandwidth; 500 builds per month | Static frontend |
| Cron Triggers | Included | Retention job runs daily |

Limits change over time. Check Cloudflare's pricing pages before launch.

**Sign-in and registration on the Free plan.** PBKDF2 with 600,000 iterations costs roughly 100–300 ms of CPU, which is over the Free limit. Choose one of these before launch:

1. **Workers Paid** (about USD 5 per month, 30-second CPU limit by default). Nothing else changes.
2. **Move the key derivation to the browser.** The browser derives a key from the passphrase (WebCrypto or WASM is allowed there), and the Worker only applies a keyed HMAC. This keeps the Free plan viable but changes the sign-in protocol and the frontend. It is a larger change and needs a separate review.

## Data migration from the previous Supabase deployment

The old PostgreSQL data cannot be copied directly into D1. Two options:

- Start fresh (recommended for a pre-launch service).
- Export the users, posts and messages with a script of your own and insert them into D1. Passphrase hashes from the old deployment (Argon2id) still verify and are upgraded to the new format at the user's next sign-in. Media files must be copied from Supabase Storage into R2 under the same keys.

## Operational notes

- The retention job runs at 02:00 UTC. A manual run is available at `POST /api/cron/retention` with `Authorization: Bearer <CRON_SECRET>`.
- Rotate `CRON_SECRET`, `JWT_SECRET` and the AI keys with `wrangler secret put`. Rotating `JWT_SECRET` signs out every user.
- Rotate any credential that was ever stored in a local `.env` file or in the old Vercel and Supabase dashboards before reusing it.
