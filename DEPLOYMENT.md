# Vercel + Supabase deployment

These are deployment instructions for the repaired source. No production migration, bucket change, policy change, secret update, or deployment was performed during this repair.

## Database and server configuration

1. Use a separate staging Supabase project first. Copy its actual runtime transaction-pooler URL to `DATABASE_URL`, with `pgbouncer=true&connection_limit=2`. Put its direct connection or session-pooler URL in `DIRECT_URL` for migrations. Both must point to the same project.
2. Set the required server values from `backend/.env.example` in Vercel: independent `JWT_SECRET`, `ENCRYPTION_KEY`, `RECOVERY_CODE_SECRET`, plus `CRON_SECRET`, Supabase URL/service-role key/bucket, and `NODE_ENV=production`. Generate secrets locally with a cryptographic random generator. Keep existing encryption/recovery secrets when upgrading an existing installation.
3. Set `FRONTEND_ORIGIN` to the exact frontend origin. For passkeys, set `WEBAUTHN_RP_ID` to the frontend hostname, without scheme or path, and `WEBAUTHN_ORIGIN` to its exact HTTPS origin. A preview hostname is a different relying party; do not dynamically trust arbitrary Origin headers.
4. Back up the target database, review the new migration, then run `npm exec --workspace backend -- prisma migrate deploy` against the selected target. The migration backfills ownership where recoverable, removes invalid/duplicate reactions, adds audience/expiry/poll/media fields and durable product-flow tables, and enables their RLS. Old fully anonymous text posts with no retained owner cannot have ownership reconstructed.
5. Leave `VITE_API_URL` empty for the combined Vercel deployment. Never expose service-role, JWT-signing, encryption, recovery, or cron secrets through `VITE_*` variables.

## Private storage

Create the bucket named by `SUPABASE_STORAGE_BUCKET` as **private**. Use a 50 MB maximum file size. If using a MIME allowlist, include JPEG, PNG, WebP, GIF, MP4, QuickTime, WebM, audio WebM/OGG/MP4, and `application/octet-stream` for encrypted chat attachments. No public read/write policy is required: the backend issues scoped signed URLs.

Uploads go directly from browser to storage. The API reserves ownership/quota, then downloads and checks the uploaded object before making it publishable. New image uploads are re-encoded to WebP; new clips have file metadata stripped. Video thumbnails are generated server-side. Chat uploads contain ciphertext and are not decoded or moderated as media by the server.

Current application limits: 50 MB per file, 100 MB per free account, 60 seconds for public free video/audio, and 10-day media retention for free videos. Chat ciphertext must fit within the file limit including its encryption tag. The premium database flag permits 10 GB and 600-second public clips; no paid subscription or billing workflow was implemented. Encrypted chat clip duration cannot be verified by the server.

Staging objects may remain until their two-hour signed-upload authorization expires, then the cleanup job removes them. Final objects and thumbnails also occupy storage. Per-user quotas do not guarantee staying below a project-wide free quota.

## Realtime chat

The application retains its own accounts and JWT login. Supabase Realtime carries small per-user invalidation notifications; ciphertext/history still comes from membership-checked Express routes.

1. Configure `SUPABASE_ANON_KEY` with the project's client key.
2. This implementation signs short-lived **HS256** realtime JWTs. `SUPABASE_JWT_SECRET` must be a shared signing secret accepted by that Supabase project (its supported legacy secret or an appropriately imported HS256 signing key). It is not the service-role key or the application's `JWT_SECRET`. Projects using only asymmetric signing keys need a compatible signing configuration or an adaptation of the signer. Consult [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys) and [custom JWT support](https://supabase.com/docs/guides/auth/jwts).
3. After Prisma migrations, review and apply `backend/supabase/realtime.sql` in the project's SQL editor. It checks the account, ban state, token version, token scope, and the user's own channel. Clients receive notifications; they cannot publish trusted events.
4. Disable public Realtime channel access and inspect existing `realtime.messages` policies for broader grants. The supplied policy cannot cancel a separate permissive policy. See [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).
5. With two staging accounts, confirm that each joins only its own private channel and receives a new message promptly. Disconnect Realtime and confirm polling still updates messages. Revoke sessions and verify new channel authorization fails.

If any realtime configuration is missing or authorization fails, chat uses REST polling. A connected client polls less frequently as a recovery mechanism. Live Supabase authentication/channel delivery and end-to-end upload/download must be checked on staging; automated tests use isolated PostgreSQL and mocked storage.

## Vercel project

Use the repository root, Node.js 22+, install command `npm ci`, build command `npm run build`, and output directory `dist`. `vercel.json` routes the API to `api/index.js`. Only Linux FFmpeg/FFprobe binaries are explicitly included; dependency tracing handles the application and its imports. Confirm binary packaging and clip-processing time on the target deployment.

The configured function budget is 60 seconds. Individual external operations and media subprocesses have timeouts, but slow networks or large/complex clips can still exceed the overall function budget. For substantial video traffic, move processing into a durable worker rather than increasing promises of unlimited uploads.

The scheduled `/api/cron/retention` job runs daily. It requires `Authorization: Bearer CRON_SECRET`; the `x-vercel-cron` header alone is never sufficient. Expired content is hidden on reads; physical cleanup runs later and is batched. Check `StorageDeletion` backlog and function failures. For a large backlog, invoke the authorized cleanup endpoint repeatedly or use a more frequent permitted schedule.

Optional `MODERATOR_HANDLES` grants review-queue access to named existing accounts. Status updates require passphrase verification. Configure AI provider keys only if using those features. Redis is optional because PostgreSQL stores one-use challenges.

## Free-plan capacity

Checked 16 October 2026. For this project's current architecture, **Supabase Realtime + Supabase Storage** is the simplest free starting point. Choose nearby application/database regions and measure latency; no speed benchmark or production capacity guarantee has been established.

| Service | Current free allowance relevant here | Fit |
| --- | --- | --- |
| Supabase | 500 MB database, 1 GB files, 5 GB egress plus 5 GB cached egress, 2 million realtime messages/month, 200 peak realtime connections | Integrated small prototype |
| Cloudflare R2 Standard | 10 GB-month storage, 1 million Class A and 10 million Class B operations/month, free direct internet egress | Possible later storage alternative for a media-heavy app; not integrated in this repair |
| Vercel Hobby | Personal, noncommercial use; platform resource limits apply | Personal prototype hosting |

Sources: [Supabase pricing](https://supabase.com/pricing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Vercel Hobby](https://vercel.com/docs/plans/hobby). There is no unlimited free video service in this setup. Cached-egress allowances do not mean private signed media always benefits from caching. Storage, video processing, and downloads will usually constrain this app before the advertised authentication-user allowance.

## Release checks

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Then exercise staging registration/login, passkeys/TOTP, a private post, image/video upload, two-account encrypted chat and attachment delivery, expiry, and cleanup. Verify denied access using a third account. Backups and a deployment rollback do not undo a database migration; retain a database restore plan before applying it to production.
