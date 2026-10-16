# Repair status — 16 October 2026

This report describes changes after the baseline audit at commit `7d1dcec`. The deployment target remains Vercel + Supabase. Changes are in the working tree; no production database, bucket, policy, account, or deployment has been changed.

## Implemented repairs

| Area | Result |
| --- | --- |
| Post privacy | Hidden ownership supports deletion of new anonymous posts. Explicit public serializers remove owner IDs and storage paths. Audiences, expiry, engagement permissions, and repost visibility share server-side checks. |
| Uploads | Server-issued reservations bind objects to owners. Confirmation checks actual sizes and decoded content, quota, and single-use attachment ownership. Images are re-encoded and clips are inspected/remuxed before publication. |
| Media access | Private storage, opaque object names, expiring media capabilities, and short-lived storage URLs replace unrestricted references. Chat attachments require thread membership and follow message expiry. |
| Account cleanup | Activity cancels pending deletion. Cleanup rechecks inactivity under a lock and records retryable storage deletion jobs before cascading database rows. Staging cleanup waits for outstanding upload authorizations to expire. |
| Authentication | Shared encrypted one-use challenges, atomic recovery-code redemption, valid zero-counter passkey support, configured WebAuthn origins, strict cron authentication, and serverless rate limits that reject requests if their storage fails. |
| Chat | Paginated and incremental history, expiry enforcement, browser-encrypted attachment bytes, account/key-version-aware key caches, and archived device keys. Optional private Supabase Realtime notifications reduce polling while retaining a fallback. |
| Product flows | Persisted follows, polls, reports, appeals, waitlist entries, and moderator review statuses. Voice recording captures real audio. Image privacy processing reports failures and processes detected faces. |
| Frontend integration | Connected composer options, media-only posts, account-scoped bookmarks, longer feed history, post links, visible mutation failures, bounded AI/news input, and draft restoration after hydration. |
| Packaging | One root workspace lockfile, patched production packages, Node 22.12+, corrected Docker build contexts, narrower Vercel binary inclusion, and deterministic static-output copying. Removed unused Nitro beta tooling that introduced an incompatible cache dependency, and the unused server pipeline that falsely simulated face anonymization. |

## Verification

- TypeScript: passed with no errors.
- Installation: a clean `npm ci` succeeded. After removing unused Nitro tooling, the final lockfile dry run passed and the dependency tree has no invalid versions; npm lists two extra optional Sharp/WASM runtime packages without failing.
- ESLint: no errors; seven existing Fast Refresh warnings in shared UI/theme modules. These concern development hot reload, not a demonstrated production failure.
- Automated tests: 37 passing — 34 backend tests across four suites and three browser-cryptography tests.
- Database: all 11 migrations apply to a fresh disposable local PostgreSQL database. No live database was used.
- Backend coverage includes ownership/audience denials, anonymous serialization, expiry, reaction/recovery-code races, single-use challenges, upload validation and quotas, cleanup, chat membership and attachment access, and persisted community flows.
- Media fixtures exercise Sharp plus real FFmpeg/FFprobe, including invalid content, clip inspection, metadata removal, and thumbnail creation. External storage is mocked.
- Cryptography checks cover two-party text decryption, thread/ciphertext tampering, encrypted attachment round trips, and per-account local key rotation/deletion.
- Production build: passed and prerendered 10 pages. Markdown rendering now loads syntax highlighting on demand; its main chunk decreased from about 971 KB to 360 KB before compression. The optional highlighter still produces a large-chunk warning.
- Browser smoke checks: composer poll/selected-audience controls, safety/reporting layout, and saved-draft restoration with no hydration error. These checks did not publish content or verify authenticated Supabase workflows.
- `npm audit --omit=dev`: zero reported vulnerabilities. The full audit still reports 19 moderate entries caused by one `sprintf-js` denial-of-service advisory in Jest's transitive development dependencies. npm's proposed fix downgrades Jest; that downgrade was not applied. This is an unresolved development-tool dependency issue, not evidence that every security defect has been found.

## Required deployment work and practical limits

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the exact configuration and staging checks. A working live release still requires the database migration, private bucket configuration, server secrets, exact frontend/passkey origins, and optional Realtime signing configuration and SQL policies. Live uploads, two-account Realtime delivery, hardware passkeys, Vercel Linux binary packaging, and Docker images have not been verified here.

Old fully anonymous text posts without retained ownership cannot be backfilled reliably. Historical raw chat attachments are not retroactively encrypted. Local chat keys have no cross-device backup; losing browser storage can make history unreadable. The encryption design has no independent peer-key verification or double ratchet. See [SECURITY.md](SECURITY.md).

Public image/video processing removes file metadata, not identifying faces, voices, scenes, or all hidden information. Moderation review statuses do not automatically ban accounts or remove posts. Bookmarks remain local to this browser, partitioned by account. The premium flag is not a billing system. AI tools need a configured provider, and video processing remains subject to the configured 60-second Vercel function budget.

## Free service recommendation

For the selected stack, start with Supabase Realtime for chat notifications and private Supabase Storage for images and short clips. This keeps authorization and infrastructure integrated. The free plan includes 1 GB file storage and finite bandwidth/realtime allowances; it cannot support unlimited video uploads. Cloudflare R2 is a possible later media-storage alternative with 10 GB-month free Standard storage and free direct egress, but it is not integrated in this change. Vercel Hobby is for personal, noncommercial projects. Current sources and the quota comparison are in [DEPLOYMENT.md](DEPLOYMENT.md#free-plan-capacity).
