# Changelog — VEIL

All notable changes to the VEIL platform are reconstructed chronologically from git commit history.

---

## [Phase 0] Scaffold & Repository Initialization — 2026-07-06
**What changed:**
- Created the baseline repository structure.
- Imported the frontend React SPA prototype code.
- Scaffolded the backend directory using Node.js, Express, and ES Modules.
- Set up Prisma with initial configurations targeting PostgreSQL (migrated from a planned MongoDB setup).

**Why:**
- Establish the developmental skeleton and coordinate communication channels between the frontend interfaces and backend API routes.

**Files affected:**
- `package.json`
- `app.js`
- `frontend/*`

---

## [Phase 1] Security Remediations (Phase 0 - 2) — 2026-07-08
**What changed:**
- Centralized configuration loading in `backend/src/config/env.js` and added strict boot-time key validation.
- Ran database migrations for WebAuthn/Passkey fields and applied a migration adding the user inactivity grace period (`pendingDeletionAt` column).
- Integrated Upstash Redis REST credentials.
- Set up an explicit CORS allowlist parsing domain listings from environment settings.
- Standardized body size parsing constraints, setting a global JSON payload limit of 100kb.
- Implemented passkey session token verification adjustments on the frontend client.
- Fixed SQL user enumeration leaks in `startChat` checks.
- Sanitized user-generated post text using `sanitize-html` strip-all rules.
- Set up rate-limiting limits for registrations, logins, recovery redemptions, and sensitive actions.
- Introduced two-phase message/user retention cleanup routines run periodically via interval timers.

**Why:**
- Address critical security vulnerabilities flagged in initial audits, preventing spam registration, token spoofing, HTML injection, and data leakages.

**Files affected:**
- `backend/src/config/env.js`
- `backend/src/middleware/rateLimiter.js`
- `backend/src/services/cron.service.js`
- `backend/src/routes/upload.routes.js`
- `backend/src/controllers/posts.controller.js`
- `backend/src/controllers/chats.controller.js`

---

## [Phase 2] Route Split & Controller Standardization (Phase 3) — 2026-07-08
**What changed:**
- Refactored monolithic controller files (`auth.controller.js`, `passkey.controller.js`) into modular sub-controllers.
- Standardized Express endpoint error handling formats, returning uniform JSON response structures containing error messages and codes.
- Added strict request body verification checks across all active endpoints using Zod schema validation middleware.

**Why:**
- Improve backend codebase modularity, reduce source file churn, and guarantee that client-side forms receive consistent error shapes for validation failures.

**Files affected:**
- `backend/src/controllers/auth/register.controller.js`
- `backend/src/controllers/auth/login.controller.js`
- `backend/src/controllers/auth/recovery.controller.js`
- `backend/src/controllers/auth/profile.controller.js`
- `backend/src/controllers/passkey/register.controller.js`
- `backend/src/controllers/passkey/login.controller.js`
- `backend/src/controllers/passkey/management.controller.js`
- `backend/src/routes/*`
- `backend/src/schemas/*`

---

## [Phase 3] UI Theme & Profile Dashboard Polish — 2026-07-08
**What changed:**
- Applied scroll constraints on messages thread containers and list elements.
- Optimized inputs for dark/light mode switches, removing redundant outlines and nested backgrounds.
- Unified input box margins and focus borders.
- Polished the account profile page, adding a security event timeline tracker, privacy grid settings, and interactive avatar badges.

**Why:**
- Ensure the user interface meets the visual quality requirements of the design guidelines, maintaining clear focus states and clean scroll behaviors on mobile devices.

**Files affected:**
- `frontend/src/routes/profile.tsx`
- `frontend/src/routes/messages.tsx`
- `frontend/src/styles.css`

---

## [Phase 4] News Reader & AI Briefings — 2026-07-08
**What changed:**
- Implemented an in-app Web Reader using an iframe to view RSS news articles within the application workspace.
- Added an Apple-style shared element morphing transition using Framer Motion to expand/collapse articles.
- Teleported the news reader modal to `document.body` using a React Portal.
- Integrated automated AI summarizations powered by Gemini/Grok that trigger on article expansion.

**Why:**
- Deliver a premium article reading flow that keeps users within the app workspace, providing instant summaries of articles.

**Files affected:**
- `frontend/src/routes/news.tsx`

---

## [Phase 5] Chat UI UX Polish — 2026-07-08
**What changed:**
- Configured React Query optimistic updates on the message sending hook, updating the chat bubbles list instantly before the backend write finishes.
- Clear input fields immediately upon submit, and added rollback triggers to restore draft states if uploads fail.
- Added Framer Motion fade/slide-up transitions on individual message items and slide layouts on theme toggle widgets.
- Attached `onLoad` triggers on post/message image attachments to scroll the thread container to the bottom after resources resolve.

**Why:**
- Increase message delivery responsiveness, reduce visual layout jumps, and provide tactile click feedback for interactable buttons.

**Files affected:**
- `frontend/src/components/veil/ThemeToggle.tsx`
- `frontend/src/routes/messages.tsx`
- `frontend/src/routes/messages.$threadId.tsx`
