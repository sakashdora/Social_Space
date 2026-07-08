# Codebase Archaeology Audit Report — VEIL

## Executive Summary

VEIL is a privacy-first anonymous social network in a functional MVP/development state. While the core features (posting, commenting, reactions, and direct messaging) are fully integrated between the React SPA frontend and Node.js/Express backend, there are several key areas where the actual implementation diverges from the original conceptual design. Most notably, direct messages (chats) are stored in plaintext in the database rather than being end-to-end encrypted as originally planned. 

Furthermore, the face anonymization pipeline (originally proposed as an external Colab/AGPL-licensed system) has been replaced by a client-side MediaPipe FaceDetector that currently exists as orphaned code (never invoked during the upload path). Production storage integrations (Cloudflare R2 or Supabase buckets) are also missing; instead, uploads are returned as local base64-encoded data URLs. 

On the positive side, the codebase has been extensively hardened with security remediations, including boot-time secret checking, strict CORS allowlisting, per-account progressive lockouts, Zod request validations, and two-phase cron data retention purges.

---

## 1. Codebase Inventory

### Directory Tree Overview
The repository is split into two primary components: a backend Express service and a frontend React Vite SPA.

```
VEIL_SOCIAL/
├── backend/
│   ├── prisma/             # Schema, migrations, and seed scripts
│   ├── scripts/            # Utility/setup scripts
│   └── src/
│       ├── config/         # Config loader and stores
│       ├── controllers/    # Route controllers (split by feature)
│       ├── middleware/     # Auth, rate limiting, and validation middlewares
│       ├── routes/         # Express routing definitions
│       ├── schemas/        # Zod validation schemas
│       ├── services/       # AI services, cron routines, RSS parsing
│       └── utils/          # Cryptography, JWT, and security log helpers
├── docs/
│   ├── ai/                 # AI guides and architectures
│   ├── architecture/       # Database spec and deployments
│   ├── business/           # Monetization and market research
│   ├── product/            # PRD and Roadmap
│   ├── security/           # Threat models and retention plans
│   └── testing/            # Test plans
└── frontend/
    ├── src/
    │   ├── assets/         # Demo images
    │   ├── components/     # UI elements (shadcn/ui + Veil elements)
    │   ├── hooks/          # Custom react hooks
    │   ├── lib/            # API wrappers and face detection libraries
    │   └── routes/         # TanStack Router page routes
```

### Module Purpose, Key Files, and Size
| Folder / Module | Purpose | Key Files | Approximate Size (LOC) |
| :--- | :--- | :--- | :--- |
| `backend/src` | Core backend server logic (Express, controllers, middlewares, routes, utilities). | `app.js`, `env.js`, `crypto.js`, `login.controller.js` | ~3,612 LOC |
| `frontend/src` | React frontend application, excluding standard UI components and route tree generator. | `api.ts`, `onboarding.tsx`, `profile.tsx`, `messages.$threadId.tsx` | ~6,846 LOC |
| `frontend/src/components/ui` | Shadcn UI reusable presentation wrapper primitives. | `button.tsx`, `dialog.tsx`, `sidebar.tsx` | ~15,000 LOC |
| `docs/` | Planning, design, and regulatory documentation files across product, architecture, and security. | `PRD.md`, `THREAT_MODEL.md`, `ARCHITECTURE.md` | ~2,500 lines |

### Prisma Schema Listing (`schema.prisma`)
The PostgreSQL database schema consists of the following models and relations:
*   **User**: Represents an anonymous account.
    *   *Fields*: `id` (UUID PK), `handle` (Unique handle), `recoveryHash` (Argon2id passphrase hash), `isBanned` (Boolean), `avatarUrl` (String, optional), `lastActiveAt` (DateTime), `pendingDeletionAt` (DateTime grace period flag, optional), `createdAt` (DateTime), `updatedAt` (DateTime), `tokenVersion` (Int session invalidator), `totpEnabled` (Boolean), `totpSecret` (String, optional).
    *   *Relations*: `comments` (Comment[]), `messages` (Message[]), `passkeys` (Passkey[]), `posts` (Post[]), `reactions` (Reaction[]), `recoveryCodes` (RecoveryCode[]), `securityEvents` (SecurityEvent[]), `threads` (ThreadParticipant[]).
*   **Passkey**: WebAuthn credential records.
    *   *Fields*: `id` (UUID PK), `userId` (FK), `credentialID` (Unique string), `publicKey` (String), `counter` (BigInt), `transports` (String, optional), `nickname` (String, optional), `createdAt` (DateTime), `lastUsedAt` (DateTime, optional), `isRevoked` (Boolean).
    *   *Relations*: `user` (User, cascade delete).
*   **RecoveryCode**: BIP39 backup codes.
    *   *Fields*: `id` (UUID PK), `userId` (FK), `codeHash` (HMAC-SHA256 hash), `usedAt` (DateTime, optional), `createdAt` (DateTime).
    *   *Relations*: `user` (User, cascade delete).
*   **SecurityEvent**: Timeline audit log of sensitive security events.
    *   *Fields*: `id` (UUID PK), `userId` (FK), `type` (String, e.g., ACCOUNT_CREATED), `metadata` (String, optional), `deviceFingerprintHash` (SHA-256 IP/UA hash, optional), `createdAt` (DateTime).
    *   *Relations*: `user` (User, cascade delete).
*   **LoginAttempt**: Account-based rate limiting lockouts.
    *   *Fields*: `id` (UUID PK), `handle` (Unique string index), `failCount` (Int), `lockedUntil` (DateTime, optional), `updatedAt` (DateTime).
*   **Post**: Anonymous or pseudonymous social feed posts.
    *   *Fields*: `id` (UUID PK), `userId` (FK, nullable for fully anonymous posts), `content` (Sanitized text), `category` (String), `aiLabels` (JSON string, optional), `mediaUrl` (String, optional), `sentimentAnalysis` (JSON string, optional), `isDeleted` (Boolean), `sharedPostId` (FK, optional), `createdAt` (DateTime).
    *   *Relations*: `user` (User, optional), `comments` (Comment[]), `moderationLogs` (ModerationLog[]), `sharedPost` (Post, optional), `shares` (Post[]), `reactions` (Reaction[]).
*   **Comment**: Nested post replies.
    *   *Fields*: `id` (UUID PK), `postId` (FK), `userId` (FK, nullable for anonymous comments), `parentCommentId` (FK, optional), `content` (Text), `isDeleted` (Boolean), `createdAt` (DateTime).
    *   *Relations*: `post` (Post), `user` (User, optional), `parentComment` (Comment, optional), `replies` (Comment[]), `moderationLogs` (ModerationLog[]), `reactions` (Reaction[]).
*   **Reaction**: Post/Comment reactions.
    *   *Fields*: `id` (UUID PK), `userId` (FK), `postId` (FK, optional), `commentId` (FK, optional), `reactionType` (String), `createdAt` (DateTime).
    *   *Relations*: `user` (User), `post` (Post, optional), `comment` (Comment, optional).
    *   *Constraints*: Unique index on `[userId, postId, commentId, reactionType]`.
*   **ModerationLog**: Action logs taken by automated filters or admins.
    *   *Fields*: `id` (UUID PK), `targetPostId` (FK, optional), `targetCommentId` (FK, optional), `adminUserId` (String, optional), `actionTaken` (String), `reason` (String), `aiFlags` (JSON string, optional), `originalContentSnapshot` (String), `createdAt` (DateTime).
*   **Thread**: Direct message session.
    *   *Fields*: `id` (UUID PK), `deleteAfterSeconds` (Int timer, defaults to 7 days), `createdAt` (DateTime), `updatedAt` (DateTime).
    *   *Relations*: `messages` (Message[]), `participants` (ThreadParticipant[]).
*   **ThreadParticipant**: Many-to-many bridge for chats.
    *   *Fields*: `id` (UUID PK), `threadId` (FK), `userId` (FK), `createdAt` (DateTime).
    *   *Relations*: `thread` (Thread, cascade delete), `user` (User, cascade delete).
    *   *Constraints*: Unique index on `[threadId, userId]`.
*   **Message**: Individual chat messages.
    *   *Fields*: `id` (UUID PK), `threadId` (FK), `senderId` (FK), `body` (Plaintext), `mediaUrl` (String, optional), `createdAt` (DateTime), `expiresAt` (DateTime timer limit).
    *   *Relations*: `sender` (User), `thread` (Thread).

### API Routes Currently Implemented
All routes are prefixed by the Express base path:
*   **Auth Routes** (`/v1/auth` -> `backend/src/routes/auth.routes.js`)
    *   `POST /register` | Public | Zod `registerSchema`, `registrationLimiter` | Creates user + recovery codes
    *   `POST /login` | Public | Zod `loginSchema`, `loginLimiter`, `accountLockoutGuard` | Signs token + returns TOTP challenge flag
    *   `POST /login/totp` | Public | Zod `loginTotpSchema`, `loginLimiter` | Verifies TOTP step 2
    *   `POST /recovery-codes/redeem` | Public | Zod `redeemRecoveryCodeSchema`, `recoveryLimiter` | Emergency account re-key
    *   `POST /logout-all` | Secure | Require JWT session | Revokes all devices by incrementing `tokenVersion`
    *   `POST /passphrase/change` | Secure | Require JWT + Step-up validation | Updates passphrase hash
    *   `POST /recovery-codes/regenerate` | Secure | Require JWT + Step-up validation | Resets backup recovery codes
    *   `GET /me` | Secure | Require JWT | Returns active user profile
    *   `GET /security-events` | Secure | Require JWT | Lists account timeline logs
    *   `DELETE /account` | Secure | Require JWT + Step-up validation | Hard deletes user account
    *   `PATCH /security-key` | Secure | Deprecated compatibility stub
*   **TOTP Routes** (`/v1/auth/mfa/totp` -> `backend/src/routes/totp.routes.js`)
    *   `GET /status` | Secure | Require JWT | Checks if TOTP is active
    *   `POST /setup` | Secure | Require JWT | Generates secret key + QR code uri
    *   `POST /enable` | Secure | Require JWT + Zod `totpEnableSchema` + `totpVerifyLimiter` | Activates TOTP
    *   `POST /disable` | Secure | Require JWT + Step-up re-auth + Zod `sensitiveActionSchema` | Disables TOTP
*   **Passkey Routes** (`/v1/auth/passkeys` -> `backend/src/routes/passkey.routes.js`)
    *   `POST /login-options` | Public | `loginLimiter` | Generates WebAuthn authentication options
    *   `POST /login-verify` | Public | Zod `passkeyVerifyLoginSchema` + `loginLimiter` | Validates credential assertion
    *   `POST /register-options` | Secure | Require JWT | Generates WebAuthn registration options
    *   `POST /register-verify` | Secure | Require JWT + Zod `passkeyVerifyRegisterSchema` | Saves new passkey credential
    *   `GET /` | Secure | Require JWT | Lists registered credentials
    *   `DELETE /:id` | Secure | Require JWT + Step-up re-auth | Revokes a passkey
*   **Posts Routes** (`/v1/posts` -> `backend/src/routes/posts.routes.js`)
    *   `GET /` | Public | Fetches feed categories/posts
    *   `GET /:id` | Public | Fetches post details
    *   `GET /:postId/comments` | Public | Fetches comment thread
    *   `POST /:postId/comments` | Secure | Require JWT + Zod `createCommentSchema` | Inserts comment
    *   `POST /` | Secure | Require JWT + Zod `createPostSchema` | Moderates and creates post
*   **Reactions Routes** (`/v1/reactions` -> `backend/src/routes/reactions.routes.js`)
    *   `POST /` | Secure | Require JWT + Zod `toggleReactionSchema` | Toggles heart/thumb likes
*   **Chats Routes** (`/v1/chats` -> `backend/src/routes/chats.routes.js`)
    *   `GET /` | Secure | Require JWT | Lists chat channels
    *   `POST /` | Secure | Require JWT + Zod `startChatSchema` | Starts 1:1 conversation thread
    *   `GET /:threadId` | Secure | Require JWT | Fetches thread messages
    *   `POST /:threadId/messages` | Secure | Require JWT + Zod `sendChatMessageSchema` | Inserts chat message
    *   `PATCH /:threadId/timer` | Secure | Require JWT + Zod `updateChatTimerSchema` | Updates auto-deletion timer
*   **AI Writing Routes** (`/api` -> `backend/src/routes/ai.routes.js`)
    *   `POST /generate` | Public | Zod `generateSchema` | Orchestrates writing draft/critic cycle
    *   `POST /correct` | Public | Zod `textSchema` | Fixes spelling and grammar
    *   `POST /suggest` | Public | Zod `textSchema` | Returns three smart reply suggestions
*   **RSS News Routes** (`/api/rss` -> `backend/src/routes/rss.routes.js`)
    *   `GET /` | Public | Aggregates Google News RSS articles
*   **Upload Routes** (`/api/upload` -> `backend/src/routes/upload.routes.js`)
    *   `POST /` | Secure | Require JWT + Multer MIME filtering | Returns base64 payload URLs

### Environment Variables
Sanitized, checked, and exported under `backend/src/config/env.js`:
*   `PORT` (Default: 3000): Server port.
*   `DATABASE_URL` (Required): Primary connection link.
*   `DIRECT_URL` (Required): Direct pooler link for database migrations.
*   `AI_API_KEY` (Required in production): Google Gemini API key.
*   `AI_API_URL` (Default: Google Gemini endpoint): OpenAI compatible chat completions endpoint.
*   `AI_MODEL` (Default: gemini-2.5-flash): AI analysis model.
*   `GROK_API_KEY` (Optional): x.AI or Groq key for draft generation.
*   `JWT_SECRET` (Required): Secret key for signing session tokens (min 32 bytes).
*   `ENCRYPTION_KEY` (Required): 64 hex characters (32 bytes) key for GCM at-rest encryption.
*   `RECOVERY_CODE_SECRET` (Required): HMAC key for backup code hashing (min 32 bytes).
*   `WEBAUTHN_RP_NAME` (Default: "Social Space"): WebAuthn RP name identifier.
*   `WEBAUTHN_RP_ID` (Default: "localhost"): WebAuthn RP ID domain index.
*   `WEBAUTHN_ORIGIN` (Default: local frontend): WebAuthn client origin context.
*   `FRONTEND_ORIGIN` (Default: local frontend): CORS whitelist (comma-separated).
*   `TOTP_ISSUER` (Default: "Social Space"): QR code issuer text.
*   `UPSTASH_REDIS_REST_URL` (Required in production): REST endpoint URL for Upstash Redis.
*   `UPSTASH_REDIS_REST_TOKEN` (Required in production): REST auth token.

#### Flagged Environment Variables:
1.  `NODE_ENV`: Checked in `env.js` and `app.js` (to swap morgan log formats or toggle strict length checks), but **not documented** or referenced in `.env.example`.
2.  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: Documented in `.env.example` as optional fallback keys, but **strictly required at boot-time in production** by `env.js` (fails boot if production flag is active and keys are empty).

### Dependencies & Unused Packages (`package.json`)
The following dependencies are declared:
*   **Production**: `@prisma/client`, `@simplewebauthn/server`, `@upstash/redis`, `argon2`, `axios`, `bcryptjs`, `bip39`, `cors`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `jsonwebtoken`, `mongoose`, `morgan`, `multer`, `openai`, `otplib`, `prisma`, `qrcode`, `rss-parser`, `sanitize-html`, `xai`, `zod`.
*   **Development**: `jest`, `nodemon`.

#### Flagged Unused Packages (No codebase imports found):
1.  `mongoose`: Leftover package from the initial scaffolding phase when MongoDB was planned. The `backend/src/models` directory is empty. Prisma handles all DB queries. This package can be safely uninstalled.
2.  `bcryptjs`: The codebase strictly utilizes `argon2` for password/passphrase hashing and `crypto.createHmac` for recovery codes. `bcryptjs` is imported nowhere in code, though mock bcrypt-style hashes are hardcoded inside the `seed.js` script.

---

## 2. Planned vs. Actual Implementation

### Major Planning Document Comparison

| Area / Feature | Originally planned (docs) | What's actually implemented | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **No PII collection** | PRD (FR1.1): Users must sign up without any email, phone, or name. | True. Prisma User table has no email/phone columns. Validated on onboarding. | **Match** | High alignment with anonymity core value. |
| **Passkeys as Default** | Security (3.1): Passkeys as primary default login method. | Passphrase is the default at registration. Passkeys are setup optionally in Step 4. | **Diverged** | Changed to maximize device compatibility (fallback is primary). |
| **Passphrase Strength** | Security: High-entropy secrets. | Minimum 12 characters, Shannon entropy >= 60 bits, and HIBP k-anonymity validation. | **Match** | Highly secure passphrase strength validator. |
| **Recovery Codes** | PRD (FR1.6): Zero-knowledge client-side recovery codes. | 8 BIP39 word lists generated by server and stored as HMAC-SHA256 hashes in DB. | **Diverged** | Handled server-side to allow constant-time database matching. |
| **Direct Message E2E** | PRD (FR1.4): All user communications (chats) must be E2E encrypted. | Plaintext bodies saved directly to PostgreSQL `Message` table. | **Diverged** | **CRITICAL GAP.** No message encryption is wired. |
| **Face Anonymization** | MVP/PRD: Media anonymized using a server/Colab pipeline (`face_anon_simple`). | A client-side MediaPipe library exists but is completely orphaned (never called). | **Diverged** | Pre-upload anonymization is mock only. AGPL concerns bypass. |
| **Supabase Storage** | Architecture / Tech Stack: Storage via Supabase / Cloudflare R2 bucket. | Express upload route reads file to buffer and returns local base64 data URL. | **Diverged** | Storage is mock only; inflates database rows in dev. |
| **Per-Account Lockout** | Security: Rate limit brute-forcing. | Enforced by `LoginAttempt` table locking account for 30s/5m/30m/24h. | **Match** | Solid progressive lockout implementation. |
| **Step-Up Re-Auth** | Security: re-auth before sensitive actions. | `requireStepUp` middleware verifies passphrase before changes, deletes, TOTP disable. | **Match** | Correctly maps all designated sensitive routes. |

---

## 3. Security & Correctness Findings

1.  **Exposed Keys in Local Workspace**:
    The developer `.env` file contains active API keys for Google Gemini (`AI_API_KEY`) and Groq (`GROK_API_KEY`), along with active credentials to a Supabase database instance. Although excluded from source control by `.gitignore`, these credentials represent risk if the workspace environment is shared or compromised.
2.  **Lack of Chat Encryption**:
    Despite claims of "end-to-end encrypted 1:1 messaging" in the header metadata of `messages.tsx`, chat messages are written as plaintext database fields. If the database container or Supabase cluster is compromised, the full text of all direct messages is exposed.
3.  **Mock Hashing Drift in Seed Scripts**:
    While the running production server hashes passphrases using Argon2id, the database seed file (`prisma/seed.js`) populates mock user profiles using bcrypt-formatted hash strings (`$2a$10$...`). While they do not break database inserts, verifying a seed user's login with the running Argon2id verifier will fail due to format differences.
4.  **Rate Limiter Implementation**:
    Rate limiters (`loginLimiter`, `registrationLimiter`, `totpVerifyLimiter`, `sensitiveActionLimiter`, `recoveryLimiter`) are properly configured in `backend/src/middleware/rateLimiter.js` and mounted on their respective Express router paths. They currently rely on memory storage, which must be swapped for Upstash Redis in multi-instance production environments.
5.  **Orphaned Code and Dead Dependencies**:
    *   `frontend/src/lib/faceDetect.ts` is fully implemented to run browser-level face boxes using vision tasks, but it is never imported or invoked in the compose media workflow.
    *   `mongoose` and `bcryptjs` are declared dependencies but are completely unused in the active backend source logic.
6.  **Code TODO Flags**:
    *   `backend/src/services/cron.service.js:L24`: Warning notifications on Day 23 of account inactivity are stubs due to a missing notification queue system. Currently logs to standard console output.

---

## 4. Open Risks & Unresolved Decisions

*   **AGPL Licensing & Face Detection (Open)**:
    Bypassing the server-side Colab approach avoided AGPL licensing issues. However, the client-side alternative (MediaPipe) is not wired in. Users can currently upload original, un-anonymized photos containing facial data, presenting a serious privacy risk.
*   **Plaintext Storage of Chat Records (High Risk)**:
    Metadata is sealed (thread participants are isolated), but actual chat payloads are unencrypted. The platform's advertising as "end-to-end encrypted" constitutes a mismatch with actual implementation capabilities.
*   **Scale Limitation of base64 Media Uploads (Medium Risk)**:
    Writing images and videos as inline base64 string data URLs in database fields degrades query performance and rapidly balloons Postgres storage consumption.

---

## 5. Recommended Next Actions

1.  **Encrypt Chat Messages (High Priority)**:
    Implement message body encryption in `sendChatMessage` and decryption in `getChatMessages` using the server's `ENCRYPTION_KEY` (AES-256-GCM) or transition to a client-side WebCrypto E2E model.
2.  **Integrate Client-Side Face Anonymization (High Priority)**:
    Wire the client-side `detectFace` module inside the upload pipeline in `frontend/src/routes/compose.tsx` to automatically blur detected coordinates before posting media.
3.  **Implement Cloud Storage Integration (Medium Priority)**:
    Update `backend/src/routes/upload.routes.js` to stream files to Cloudflare R2 or a Supabase Storage bucket instead of returning base64 URLs.
4.  **Prune Unused Dependencies (Low Priority)**:
    Run `npm uninstall mongoose bcryptjs` in the `backend/` directory to decrease dependency footprint and eliminate security warnings for unused packages.
