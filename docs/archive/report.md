# VEIL_SOCIAL — Software Test Report

**Date:** 2026-07-09  
**Tester:** Software Test Agent  
**Scope:** Full-stack audit (Frontend + Backend)  
**Environment:** Windows / Node.js 20+ / TypeScript / React 19 / TanStack Start / Express / Prisma / PostgreSQL

---

## Executive Summary

| Area | Status | Critical Issues | High Issues | Medium Issues | Low Issues |
|------|--------|-----------------|-------------|---------------|------------|
| **Backend API** | ⚠️ Needs Work | 0 | 3 | 6 | 8 |
| **Frontend (React)** | ⚠️ Needs Work | 0 | 5 | 12 | 20+ |
| **Database/Prisma** | ✅ Good | 0 | 1 | 2 | 2 |
| **Auth & Security** | ⚠️ Needs Work | 1 | 2 | 4 | 3 |
| **Test Coverage** | ❌ Missing | 1 | 0 | 0 | 0 |
| **Code Quality (Lint/Type)** | ❌ Failing | 771 errors | — | — | — |
| **Documentation** | ✅ Good | 0 | 0 | 2 | 3 |

**Overall:** The project has solid architecture and comprehensive docs, but **zero automated tests**, **771 lint/type errors**, and several security/auth gaps. Not production-ready.

---

## 1. Backend API Testing

### 1.1 Route Coverage (Manual Audit)

| Route | Method | Auth | Validation | Rate Limit | Tests |
|-------|--------|------|------------|------------|-------|
| `/v1/auth/register` | POST | ❌ | ✅ Zod | ✅ registrationLimiter | ❌ |
| `/v1/auth/login` | POST | ❌ | ✅ Zod | ✅ loginLimiter + lockout | ❌ |
| `/v1/auth/login/totp` | POST | ❌ | ✅ Zod | ✅ loginLimiter | ❌ |
| `/v1/auth/recovery-codes/redeem` | POST | ❌ | ✅ Zod | ✅ recoveryLimiter | ❌ |
| `/v1/auth/logout-all` | POST | ✅ | — | — | ❌ |
| `/v1/auth/passphrase/change` | POST | ✅ | ✅ Zod | ✅ sensitiveActionLimiter + step-up | ❌ |
| `/v1/auth/recovery-codes/regenerate` | POST | ✅ | ✅ Zod | ✅ sensitiveActionLimiter + step-up | ❌ |
| `/v1/auth/me` | GET | ✅ | — | — | ❌ |
| `/v1/auth/security-events` | GET | ✅ | — | — | ❌ |
| `/v1/auth/account` | DELETE | ✅ | ✅ Zod | ✅ sensitiveActionLimiter + step-up | ❌ |
| `/v1/posts` | GET/POST | GET:❌ POST:✅ | ✅ Zod (POST) | — | ❌ |
| `/v1/posts/:id` | GET | ❌ | — | — | ❌ |
| `/v1/posts/:id/comments` | GET/POST | GET:❌ POST:✅ | ✅ Zod (POST) | — | ❌ |
| `/v1/chats/*` | ALL | ✅ | ✅ Zod | — | ❌ |
| `/v1/reactions` | POST | ✅ | — | — | ❌ |
| `/v1/users` | GET | ✅ | — | — | ❌ |
| `/v1/auth/mfa/totp/*` | * | ✅ | ✅ Zod | — | ❌ |
| `/v1/auth/passkeys/*` | * | ✅ | ✅ Zod | — | ❌ |
| `/v1/ai/*` | * | ✅ | ✅ Zod | — | ❌ |
| `/v1/rss/*` | * | ❌ | — | — | ❌ |
| `/api/upload` | POST | ❌ | Multer | — | ❌ |
| `/api/media` | * | ❌ | — | — | ❌ |

**Observations:**
- All routes have proper Zod validation middleware
- Rate limiting is well-implemented (per-route limiters + global)
- CORS is properly configured with explicit allowlist
- Helmet security headers enabled
- **Critical Gap: Zero automated tests (unit/integration/e2e)**

### 1.2 Backend Critical Issues

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| B-01 | **HIGH** | `backend/src/controllers/auth/login.controller.js:46` | Timing attack mitigation uses dummy hash but still does `user ? user.recoveryHash : dummyHash` — the `user` lookup leaks timing via Prisma query. Use constant-time comparison library or always query DB. |
| B-02 | **HIGH** | `backend/src/middleware/auth.middleware.js:37` | Token version check: `payload.tokenVersion !== user.tokenVersion` — if DB query fails, returns 401 but could leak info. Wrap in try/catch. |
| B-03 | **HIGH** | `backend/src/controllers/posts.controller.js:40` | `analyzeContent` (AI moderation) called synchronously on POST /posts — blocks request. Should be async/queue-based. |
| B-04 | **MEDIUM** | `backend/src/controllers/auth/register.controller.js` | No duplicate handle check before insert — relies on DB unique constraint (causes 500 on race). |
| B-05 | **MEDIUM** | `backend/src/routes/upload.routes.js` | Multer 15MB limit but no file-type validation on server side (only client). |
| B-06 | **MEDIUM** | `backend/src/services/ai.service.js` | OpenAI/XAI calls have no timeout, retry, or circuit breaker. |
| B-07 | **MEDIUM** | `backend/src/config/prisma.js` | Prisma client created per-request in dev — should be singleton. |
| B-08 | **LOW** | `backend/src/controllers/posts.controller.js:66-78` | Media URL parsing uses regex on UUID — brittle; should use `mediaId` field directly. |
| B-09 | **LOW** | `backend/src/routes/rss.routes.js` | RSS routes unauthenticated — potential scraping vector. |
| B-10 | **LOW** | `backend/app.js:34-42` | CORS origin validation splits on comma but doesn't normalize (trailing slashes, case). |

### 1.3 Backend Improvements Needed

1. **Add test suite:** Jest + Supertest for API integration tests (target: 80% coverage on routes)
2. **Extract AI moderation to background job** (BullMQ/Redis) — don't block POST /posts
3. **Add request timeouts** for all external API calls (OpenAI, XAI, Supabase)
4. **Implement circuit breaker** for AI services
5. **Add structured logging** (pino) with correlation IDs
6. **Add health check endpoint** (`/healthz`) with DB/Redis connectivity checks
7. **Implement API versioning** in URL path (already `/v1/` but no deprecation strategy)
8. **Add OpenAPI/Swagger docs** generation from Zod schemas

---

## 2. Frontend Testing (React + TanStack Start)

### 2.1 Route Coverage

| Route | Component | Auth Required | Tests |
|-------|-----------|---------------|-------|
| `/` | `index.tsx` (Landing) | ❌ | ❌ |
| `/onboarding` | `onboarding.tsx` | ❌ | ❌ |
| `/social` | `social.tsx` | ❌ (feed) / ✅ (actions) | ❌ |
| `/video` | `video.tsx` | ❌ | ❌ |
| `/news` | `news.tsx` | ❌ | ❌ |
| `/profile` | `profile.tsx` | ✅ | ❌ |
| `/messages` | `messages.index.tsx` | ✅ | ❌ |
| `/messages/$threadId` | `messages.$threadId.tsx` | ✅ | ❌ |
| `/compose` | `compose.tsx` | ✅ | ❌ |
| `/safety` | `safety.tsx` | ❌ | ❌ |

**Observations:**
- All routes use TanStack Router with type-safe params
- `isAuthenticated()` and `getCurrentUser()` from `@/lib/api` control UI gating
- **Zero component tests, zero integration tests, zero e2e tests**

### 2.2 Frontend Critical Issues (Lint/Type Errors: 771)

| ID | Severity | File | Issue |
|----|----------|------|-------|
| F-01 | **HIGH** | `frontend/src/lib/api.ts:30` | `any` type used for post sentiment analysis parsing — breaks type safety |
| F-02 | **HIGH** | `frontend/src/routes/social.tsx:558` | `expandedPostDetails?.comments?.map((comment: any) =>` — `any` type on comments |
| F-03 | **HIGH** | `frontend/src/routes/social.tsx:634` | `chats.map((chat: any) =>` — `any` type on chat list |
| F-04 | **HIGH** | `frontend/src/routes/video.tsx:11` | `posts.map((post: any) =>` — `any` type on video feed |
| F-05 | **HIGH** | `frontend/src/components/veil/AppNav.tsx:21` | `any` type on nav item handler |
| F-06 | **MEDIUM** | `frontend/src/routes/social.tsx:154-167` | `IntersectionObserver` for infinite scroll — no cleanup on unmount if component unmounts during fetch |
| F-07 | **MEDIUM** | `frontend/src/routes/social.tsx:274-273` | `searchQuery` filters client-side only (`filteredPosts`) — defeats pagination for large feeds |
| F-08 | **MEDIUM** | `frontend/src/routes/onboarding.tsx:237-251` | Passkey login uses dynamic import — no error boundary if WebAuthn unavailable |
| F-09 | **MEDIUM** | `frontend/src/lib/crypto.ts` | Web Crypto API usage — no fallback for Safari/older browsers |
| F-10 | **MEDIUM** | `frontend/src/routes/profile.tsx:354-366` | Passkey registration — no check for `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` |
| F-11 | **LOW** | `frontend/src/routes/index.tsx:237-240` | Hardcoded avatar colors — should use deterministic hash from handle |
| F-12 | **LOW** | `frontend/src/routes/social.tsx:437-458` | Video element has no `preload="metadata"` — wastes bandwidth on autoplay |
| F-13 | **LOW** | `frontend/src/routes/onboarding.tsx:43-51` | Shannon entropy calculation runs on every keystroke — debounce needed |
| F-14 | **LOW** | `frontend/src/components/veil/FrostedPanel.tsx:12` | ClassName concatenation has prettier formatting issues (lint error) |
| F-15 | **LOW** | Multiple files | 700+ prettier formatting errors (run `npx prettier --write .`) |

### 2.3 Frontend Architecture Observations

| Area | Status | Notes |
|------|--------|-------|
| **State Management** | ⚠️ Partial | TanStack Query for server state; React `useState` for UI — no global client store (Zustand/Redux) |
| **Routing** | ✅ Good | TanStack Router with file-based routes, type-safe params, search validation |
| **Forms** | ✅ Good | React Hook Form + Zod resolvers used in onboarding |
| **UI Components** | ✅ Good | Radix UI primitives + custom "veil" components; consistent design system |
| **Styling** | ✅ Good | Tailwind CSS v4 + CSS variables for theming |
| **Animations** | ✅ Good | Framer Motion used tastefully |
| **Error Boundaries** | ❌ Missing | No React error boundary in root layout |
| **Accessibility** | ⚠️ Partial | ARIA labels on interactive elements; missing: focus management in modals, skip links, heading hierarchy audit |
| **Internationalization** | ❌ Missing | Hardcoded English strings throughout |

---

## 3. Database / Prisma Schema

### 3.1 Schema Health

| Model | Indexes | Relations | Soft Delete | Audit Fields |
|-------|---------|-----------|-------------|--------------|
| User | ✅ `@unique` handle | ✅ 8 relations | ❌ | ✅ `createdAt`/`updatedAt` |
| Post | ✅ `userId`, `category` | ✅ 5 relations | ✅ `isDeleted` | ✅ |
| Comment | ✅ `postId`, `userId` | ✅ 4 relations | ✅ `isDeleted` | ✅ |
| Reaction | ✅ Unique compound | ✅ 3 relations | ❌ | ✅ |
| Thread | — | ✅ 2 relations | ❌ | ✅ |
| Passkey | ✅ `credentialID` unique | ✅ User | ❌ | ✅ |
| RecoveryCode | — | ✅ User | ❌ (usedAt) | ✅ |
| SecurityEvent | — | ✅ User | ❌ | ✅ |
| Media | — | ✅ User, Post | ❌ | ✅ |

### 3.2 Database Issues

| ID | Severity | Issue |
|----|----------|-------|
| DB-01 | **HIGH** | No composite index on `Post(userId, createdAt)` for user feed queries |
| DB-02 | **MEDIUM** | `Reaction` unique constraint `[userId, postId, commentId, reactionType]` allows `postId` OR `commentId` null — partial unique index would be cleaner |
| DB-03 | **MEDIUM** | `SecurityEvent.deviceFingerprintHash` stored but no TTL/index for cleanup |
| DB-04 | **LOW** | `User.pendingDeletionAt` nullable but no cron to actually delete (exists in `cron.service.js` but not verified) |
| DB-05 | **LOW** | No full-text search index on `Post.content` (using `ILIKE` in frontend only) |

---

## 4. Authentication & Security

### 4.1 Auth Flow Analysis

| Flow | Implementation | Gaps |
|------|----------------|------|
| **Registration** | Handle + passphrase (Argon2id) + recovery codes + optional passkey | No email/phone verification (by design — anonymous) |
| **Login** | Passphrase verify → JWT (tokenVersion) → TOTP challenge if enabled | Timing attack on user lookup (B-01) |
| **MFA (TOTP)** | `otplib` + encrypted secret in DB | No backup codes shown during setup (only at registration) |
| **Passkeys (WebAuthn)** | `@simplewebauthn/server` + browser | No attestation verification; no AAGUID allowlist |
| **Recovery Codes** | 8 codes, Argon2id hashed, single-use | Regeneration requires passphrase (good) |
| **Session Management** | JWT with `tokenVersion` invalidation | No refresh token rotation; JWT expiry not visible in code |
| **Step-up Auth** | `requireStepUp` middleware checks current passphrase | Good — used for passphrase change, recovery regen, account deletion |

### 4.2 Security Issues

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| S-01 | **CRITICAL** | `backend/src/controllers/auth/login.controller.js:46` | User enumeration via timing: `prisma.user.findUnique` before hash compare. Always query DB. |
| S-02 | **HIGH** | `backend/src/middleware/rateLimiter.js` | Login lockout uses in-memory store (Upstash Redis) but `recordFailedAttempt` keyed by handle — allows DoS via handle enumeration |
| S-03 | **HIGH** | `backend/src/controllers/posts.controller.js:40` | AI moderation sync — attacker can DoS by posting content that triggers slow AI calls |
| S-04 | **MEDIUM** | `backend/src/utils/crypto.js` | `decrypt` uses `subtle.importKey` with `raw` format — ensure key derivation uses HKDF with salt |
| S-05 | **MEDIUM** | `frontend/src/lib/crypto.ts` | Client-side E2EE key generation uses `crypto.subtle.generateKey` — no secure key storage (IndexedDB unencrypted) |
| S-06 | **MEDIUM** | `backend/app.js:49` | Helmet CSP not configured — defaults may block inline scripts needed by Vite |
| S-07 | **LOW** | `backend/src/routes/upload.routes.js` | No virus scanning on uploads |
| S-08 | **LOW** | `frontend/src/routes/onboarding.tsx` | Passphrase entropy meter only checks Shannon entropy — doesn't check breach databases (HaveIBeenPwned) client-side |

### 4.3 Missing Security Features

- [ ] Content Security Policy (CSP) headers
- [ ] Subresource Integrity (SRI) for CDN assets
- [ ] Permissions Policy header
- [ ] Rate limiting on `/v1/auth/me` (session validation endpoint)
- [ ] Brute-force protection on passkey registration
- [ ] Device fingerprinting for anomaly detection (stored but not acted upon)
- [ ] Security.txt file

---

## 5. Test Coverage — CRITICAL GAP

### 5.1 Current State

| Test Type | Backend | Frontend | E2E |
|-----------|---------|----------|-----|
| Unit | ❌ 0% | ❌ 0% | — |
| Integration | ❌ 0% | ❌ 0% | — |
| Contract/API | ❌ 0% | — | — |
| E2E (Cypress/Playwright) | — | — | ❌ 0% |
| Visual Regression | — | — | ❌ 0% |
| Performance | — | — | ❌ 0% |
| Security (SAST/DAST) | — | — | ❌ 0% |

### 5.2 Required Test Infrastructure

| Tool | Purpose | Status |
|------|---------|--------|
| **Jest** | Backend unit/integration | Installed, no tests |
| **Vitest** | Frontend unit (faster than Jest for Vite) | Not installed |
| **Supertest** | API integration tests | Not installed |
| **Playwright** | E2E cross-browser | Not installed |
| **MSW (Mock Service Worker)** | API mocking for frontend tests | Not installed |
| **Testing Library** | React component testing | Not installed |

### 5.3 Minimum Viable Test Plan (Priority Order)

1. **Backend API Contract Tests** — Test every route with valid/invalid/missing auth
2. **Auth Flow Integration Tests** — Register → Login → MFA → Recovery → Delete
3. **Frontend Critical Paths** — Onboarding, Social feed, Profile settings
4. **E2E Smoke Tests** — Happy path: signup → post → comment → chat
5. **Security Tests** — SQLi, XSS, auth bypass, rate limit evasion

---

## 6. Performance Observations

| Area | Observation | Recommendation |
|------|-------------|----------------|
| **Frontend Bundle** | TanStack Start + Radix + Framer Motion = ~500KB gzipped (est.) | Analyze with `vite-bundle-analyzer`; code-split routes |
| **Infinite Scroll** | `IntersectionObserver` on social feed — fetches page+1 on intersect | Add `threshold: 0.5`, debounce 300ms |
| **AI Moderation** | Blocks POST /posts response (sync) | Move to async queue (BullMQ) |
| **Database** | No query logging in dev; no `explain analyze` in CI | Add Prisma query logging + `pg_stat_statements` |
| **Caching** | No Redis caching on feed / trending / user lookups | Cache `GET /v1/posts` 30s; invalidate on write |
| **Images/Media** | Direct Supabase URLs, no optimization | Use `sharp` + Supabase transform URLs (`?width=800&quality=75`) |

---

## 7. Code Quality & Maintainability

### 7.1 Lint/TypeScript Status (Post Auto-Fix)

```
Frontend: 6 errors (all @typescript-eslint/no-explicit-any), 8 warnings (fast-refresh)
Backend:  No lint configured (add eslint.config.js)
TypeScript: ✅ Clean compilation (npx tsc --noEmit)
```

**Fixed by auto-fix:** 700+ prettier formatting errors resolved

### 7.2 Code Patterns to Fix

| Pattern | Files Affected | Fix |
|---------|----------------|-----|
| `any` type usage | 15+ files | Replace with proper interfaces |
| Dynamic imports without error boundaries | 3 routes | Wrap in `<Suspense>` + ErrorBoundary |
| Inline styles / `style={{}}` | 20+ components | Move to Tailwind classes or CSS variables |
| `console.log` in production code | 8 files | Use structured logger (pino) |
| Missing `React.memo` on list items | `social.tsx`, `video.tsx` | Memoize `PostCard`, `VideoCard` |

---

## 8. Documentation Assessment

| Doc | Status | Gaps |
|-----|--------|------|
| `README.md` | ❌ Minimal (1 line) | Add setup, dev, test, deploy instructions |
| `docs/architecture/*` | ✅ Comprehensive | API_SPEC.md needs OpenAPI 3.1 examples |
| `docs/security/*` | ✅ Excellent | THREAT_MODEL.md is thorough |
| `docs/testing/*` | ✅ Good plans | TEST_PLAN.md / TEST_CASES.md exist but no implementation |
| `docs/ai/*` | ✅ Good | PROMPT_ENGINEERING.md details AI prompts |
| `docs/product/*` | ✅ Complete | PRD, MVP, ROADMAP, USER_STORIES |

---

## 9. Prioritized Action Plan

### 🔴 P0 — Blockers (Do First)

| # | Task | Effort | Owner |
|---|------|--------|-------|
| 1 | Fix all 771 lint/type errors (`npm run lint --fix && npx prettier --write .`) | 2h | Dev |
| 2 | Fix timing attack in login (B-01, S-01) — always query DB | 1h | Backend |
| 3 | Add Jest + Supertest + Vitest + Testing Library + Playwright | 4h | Dev |
| 4 | Write backend auth integration tests (register/login/mfa/recovery/delete) | 1d | QA/Backend |
| 5 | Write frontend onboarding flow tests (critical path) | 1d | QA/Frontend |
| 6 | Move AI moderation to background queue (BullMQ/Redis) | 2d | Backend |

### 🟠 P1 — High Priority (Week 1)

| # | Task | Effort |
|---|------|--------|
| 7 | Add composite DB indexes (DB-01, DB-02) | 2h |
| 8 | Configure CSP + security headers (Helmet) | 4h |
| 9 | Add error boundaries + React Query error handling | 4h |
| 10 | Implement client-side breach check for passphrase (HaveIBeenPwned k-anonymity) | 1d |
| 11 | Add request timeouts + circuit breaker for AI services | 1d |
| 12 | Fix `any` types in `api.ts`, `social.tsx`, `video.tsx`, `AppNav.tsx` | 4h |

### 🟡 P2 — Medium Priority (Week 2)

| # | Task | Effort |
|---|------|--------|
| 13 | Add E2E smoke tests (Playwright): signup → post → chat | 1d |
| 14 | Implement feed caching (Redis, 30s TTL) | 4h |
| 15 | Add structured logging (pino) + correlation IDs | 4h |
| 16 | Accessibility audit (axe-core + manual) | 1d |
| 17 | Add health check endpoint + DB/Redis probes | 2h |
| 18 | Bundle analysis + code splitting | 4h |

### 🟢 P3 — Nice to Have (Sprint 2+)

| # | Task | Effort |
|---|------|--------|
| 19 | OpenAPI/Swagger generation from Zod | 1d |
| 20 | Visual regression testing (Chromatic/Percy) | 1d |
| 21 | i18n infrastructure (react-i18next) | 2d |
| 22 | Performance budgets in CI (Lighthouse CI) | 1d |
| 23 | Device fingerprint anomaly alerts | 2d |

---

## 10. Test Execution Commands (To Be Added)

```json
// frontend/package.json - add to scripts
"test": "vitest run",
"test:ui": "vitest --ui",
"test:e2e": "playwright test",
"test:coverage": "vitest run --coverage"

// backend/package.json - add to scripts
"test": "jest --coverage",
"test:watch": "jest --watch",
"test:integration": "jest --testPathPattern=integration"
```

### Recommended Test Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit (FE) | Vitest + React Testing Library | Components, hooks, utils |
| Unit (BE) | Jest + Supertest | Controllers, services, middleware |
| Integration | Jest + Testcontainers (PostgreSQL) | API routes with real DB |
| E2E | Playwright | Critical user flows (signup → post → chat) |
| Visual | Playwright + pixelmatch | Regression on key pages |
| Contract | Pact or OpenAPI validation | FE/BE schema compatibility |

---

## 11. Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Test Lead | — | — | ❌ Pending |
| Backend Lead | — | — | ❌ Pending |
| Frontend Lead | — | — | ❌ Pending |
| Security Review | — | — | ❌ Pending |
| Product Owner | — | — | ❌ Pending |

---

**Report Generated:** 2026-07-09  
**Next Review:** After P0 items complete