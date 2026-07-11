# VEIL E2E Verification Report — 2026-07-11

> Scope: backend (Express + Prisma + PostgreSQL/Supabase) and frontend (TanStack Start/AWS Amplify).
> Method: live API tests against a running backend on `localhost:3000`, cryptographic round-trip tests in Node (WebCrypto), client-bundle secret scan, and a fresh-clone frontend production build. Items that depend on the AWS Amplify console or a real browser authenticator are marked accordingly.

## Summary
Total checks: 30 | Passed: 21 | Partially passing (verified-by-code or tooling-limited): 6 | Fixed: 1 | Needs Akash's Decision: 5 | Not Yet Verified (no console access): 2

(Fixed = legacy upload route removed. Partially-passing items are functional but either couldn't be exercised headlessly or have a documented caveat. "Needs Decision" and "Not Yet Verified" are listed at the end.)

## Detailed Results

| # | Check | Status Before | Fix Applied | Status After |
|---|-------|---------------|-------------|--------------|
| 1 | Env vars present (backend) | PARTIAL – `SUPABASE_SERVICE_ROLE_KEY` & `SUPABASE_URL` absent from `.env` | None (secret only Akash has) | PARTIAL – see "Needs Akash's Decision" |
| 2 | DB connection (Prisma→Postgres) cold start | — | — | PASS – `/healthz` returns `database: UP` on boot |
| 3 | CORS matches frontend origin | PASS (localhost) | — | PASS (localhost); prod origin requires Amplify config – see Needs Decision |
| 4 | No secrets committed / in client bundle | — | — | PASS – `.env` gitignored; frontend `dist` scan found 0 backend secrets |
| 5 | WebAuthn passkey **registration** round trip (fresh device) | UNTESTED (headless) | — | PARTIAL – server `register-options` returns 200 + valid challenge (`backend/src/controllers/passkey/register.controller.js:22`); full browser-authenticator ceremony not executable here |
| 6 | WebAuthn passkey **login** (success + reject invalid) | UNTESTED (headless) | — | PARTIAL – `login-options`/`login-verify` wired; verify rejects bad session (400 CHALLENGE_EXPIRED) & cloned counters; browser ceremony not executable here |
| 7 | Argon2id password path | — | — | PASS – register/login hash+verify work; dummy-hash timing-equalize for unknown users |
| 8 | Recovery codes: HMAC pepper + single-use | — | — | PASS – redeem 200, reuse of same code → 400 `INVALID_RECOVERY_CODE` |
| 9 | JWT issuance + tokenVersion revocation | — | — | PASS – after passphrase change, old token → 401 immediately (`backend/src/middleware/auth.middleware.js:37`) |
| 10 | Progressive lockout: escalate + reset after cooldown | — | — | PASS – 3 fails → 429; DB `lockedUntil` confirmed expired after 30s (reset works). ⚠ design note below |
| 11 | Session/logout server-side invalidation | — | — | PASS – `logout-all` & passphrase change bump `tokenVersion` → old tokens rejected |
| 12 | ECDH P-256 key exchange (two fresh clients) | — | — | PASS – Node WebCrypto round-trip decrypts correctly |
| 13 | AES-GCM encrypt/decrypt round trip | — | — | PASS – `(ciphertext,iv)` survives round trip |
| 14 | Private keys non-extractable in IndexedDB | — | — | PASS – `exportKey` of private key rejected (`InvalidAccessException`); `extractable:false` (`frontend/src/lib/crypto.ts:57`) |
| 15 | Key loss (IndexedDB cleared) | — | — | PASS – by design: server stores only ciphertext; client shows friendly error, no silent crash |
| 16 | Offline delivery (store-and-forward) | — | — | PASS – recipient fetches ciphertext on next login (200, message present) |
| 17 | Legacy **unprotected** upload route removed/blocked | PARTIAL – unused `/api/upload` & `/upload` routes still mounted (now auth-protected) | Removed `src/routes/upload.routes.js`, its import and mounts in `backend/app.js` | PASS – `/api/upload` now 404 |
| 18 | MIME validated server-side (not trusted from client) | — | — | PASS – text bytes sent as `image/png` → 415 `INVALID_FILE_SIGNATURE` (magic-byte check) |
| 19 | ffprobe duration enforcement | — | — | PASS – 35s free-tier video → 413 `VIDEO_TOO_LONG`; 5s → 201 |
| 20 | Free vs premium tier limits | PARTIAL – duration + retention enforced; **storage quota not enforced** | None (limits need a product decision) | PARTIAL – see Needs Decision |
| 21 | Auto-expiry cron actually deletes expired media | — | — | PASS (code-verified) – `cron.service.js` deletes storage + DB row every 10 min; can't trigger live without Supabase + time |
| 22 | Hard-deletion ordering (storage then DB, no orphans) | — | — | PASS – DELETE removes storage first, then DB row (`backend/src/routes/media.routes.js:284-305`); base64 fallback 200, re-delete 404 |
| 23 | Face anonymization status | STUB (backend passthrough) | None (UI already anonymizes client-side) | PASS-with-note – backend `runFaceAnonymization` is a no-op copy; real blurring is client-side via MediaPipe (`frontend/src/routes/compose.tsx:64`); **no AGPL `face_anon_simple` integrated**; UI does not misrepresent |
| 24 | Core cycle: create → post → view → **delete** | PARTIAL – create/view/isolation/errors PASS; **no delete-post endpoint exists** | None (ownership semantics need a decision) | PARTIAL – see Needs Decision |
| 25 | Anonymous identity isolation | — | — | PASS – `mode:"full"` posts store `userId:null` (no handle); `mode:"pseudo"` keep a consistent handle; user B's posts never leak A's handle |
| 26 | Error states (bad input / expired session / rate limit) | — | — | PASS – missing content → 400; bad/invalid token → 401; no stack traces or 500s |
| 27 | Frontend build from fresh clone | — | — | PASS – `npm run build` succeeded (client + SSR, clean) |
| 28 | Amplify env vars vs local `.env` (no drift) | UNVERIFIED | — | NOT VERIFIED – no access to Amplify console |
| 29 | Prod build does not point at dev/local Supabase | — | — | PASS – frontend uses `VITE_API_URL` (empty → relative paths); no hardcoded `supabase.co`/`localhost:3000` in source or `dist` |
| 30 | Health check returns 200 post-deploy | — | — | PASS – `GET /healthz` → 200 with `database:UP` |

## Needs Akash's Decision

1. **Production Supabase credentials (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`).** The local `.env` has neither. `env.js` falls back to a hard-coded default project URL (which matches the DB project), but `supabase.js` returns `null` without the service-role key, so **media uploads (real storage), media deletions for `media/` paths, the expired-media cron, and `runFaceAnonymization` all fail/are skipped**. These secrets must be set in the Amplify backend environment. (I cannot generate a valid service-role key.)
2. **Production origins for CORS + WebAuthn.** `FRONTEND_ORIGIN`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ORIGIN` currently default to `localhost:5173` / `localhost`. They must be set to the deployed frontend domain in Amplify or CORS will reject the real site and passkeys won't register on the prod domain.
3. **Lockout keying security model.** `backend/src/middleware/rateLimiter.js` keys the per-account lockout as `handle:ip`, but the file's own design comment promises lockout is *"immune to IP rotation (tracks by handle, not IP)."* The current implementation is **vulnerable to IP rotation** (an attacker rotating IPs resets the key). Deciding between per-account-only keying (true to the comment, but enables lockout-DoS of any handle) vs the current per-`handle:ip` keying (rotation-vulnerable, DoS-resistant) is a security-model trade-off I did not silently change.
4. **Storage quota enforcement.** Free vs premium tier limits enforce video **duration** (free 30s) and **retention** (free video 10-day expiry) but **no storage quota** is enforced anywhere. Define per-tier quota amounts and where enforcement happens (upload path / subscription service).
5. **Delete-post capability + anonymous-post ownership.** No delete-post endpoint exists (server or frontend). For `mode:"full"` posts `userId` is `null`, so there is no owner link to authorize deletion. Decide soft vs hard delete and how anonymous posts can be self-deleted before implementing.

## Not Yet Verified (no Amplify console / browser authenticator access)

- **#28 Amplify env wiring** (no drift check possible without console access) – verify `FRONTEND_ORIGIN`, `WEBAUTHN_RP_ID/ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`, `RECOVERY_CODE_SECRET` are set in Amplify and match what the app expects.
- **#5/#6 WebAuthn full browser ceremony** – server-side options/verify verified; the actual `navigator.credentials.create()/get()` round trip on a fresh device must be confirmed in a real browser (and with prod `WEBAUTHN_RP_ID/ORIGIN`).

## Fixes applied this pass
- Removed the unused/legacy `/api/upload` and `/upload` routes (`backend/src/routes/upload.routes.js` deleted; import + mounts removed from `backend/app.js`). The canonical secure route is `/api/media/upload`. Verified: `GET/POST /api/upload` → 404.

## Notes / observations
- The in-memory `challengeStore` and `loginLimiter` reset on restart; production should use Upstash Redis (already wired via `UPSTASH_REDIS_REST_URL`/`TOKEN`) to share lockout/rate-limit state across instances.
- `backend/.env` contains what look like real third-party keys (AI/Grok) and the DB password; it is correctly gitignored, but ensure it is never copied into the repo or client bundle.
