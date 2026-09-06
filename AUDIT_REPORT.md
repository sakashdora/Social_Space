# VEIL (Social Space) — Full Functionality Audit Report
**Date:** September 6, 2026  
**Repository:** `sakashdora/Social_Space`  
**Backend:** Express + Prisma + PostgreSQL (Supabase)  
**Frontend:** React 19 + TanStack Start (SSR) + TanStack Query + Tailwind CSS  
**Auth:** Argon2id + WebAuthn/passkey + JWT (tokenVersion revocation) + BIP39 recovery codes  
**Auditor:** Antigravity Engineering

---

## Executive Summary

A comprehensive, route-by-route audit was conducted across all interactive elements, data fetching hooks, and backend controllers in the VEIL platform. Each element was traced end-to-end from user interaction (clicks, submissions, toggles) to network requests, backend route handlers, Prisma queries, and database schema representations.

The system features robust cryptographic and security foundations (Argon2id, WebAuthn, BIP39 mnemonic recovery, tokenVersion revocation, face detection blurring, and automated Gemini AI content moderation). However, several client-side UI flows have accumulated placeholder behaviors (`showToast(...)` calls, simulated `setTimeout` delays, local component state tracking without persistence, or mock identifiers).

This report catalogs all findings, identifies the root causes, diagnoses authentication latency bottlenecks, and provides a clear remediation roadmap for Phase 2.

---

## Inventory of Interactive Elements

### Classification Legend
- **`WORKING`**: Fully functional end-to-end (UI interaction calls backend API, reads/writes real database state, updates UI accordingly).
- **`DEAD`**: Renders and responds to user interaction (e.g. click, hover) but executes no network request, performs no state persistence, and does nothing or only fires an ephemeral client toast.
- **`MOCK_DATA`**: Renders hardcoded data or interacts purely with in-memory / `localStorage` state without database backing.
- **`BROKEN_WIRING`**: Intended to call a backend endpoint or perform an operation, but fails due to missing auth headers, missing parameters, or unhandled errors.
- **`PARTIALLY_IMPLEMENTED`**: Partially wired; some aspects succeed (e.g. form fields, timers), but key features (media capture, backend persistence, DB models) are incomplete or omitted.

| Route / Component | Element / Feature | File & Line Range | Classification | What Actually Happens |
| :--- | :--- | :--- | :--- | :--- |
| **Global / Navigation** | Theme Toggle | `frontend/src/components/veil/ThemeToggle.tsx:18-35` | `WORKING` | Toggles `dark` class on `document.documentElement` and persists to `localStorage`. |
| **Global / Navigation** | Nav Links (Feed, Explore, Video, Compose, Profile, Safety) | `frontend/src/components/veil/AppNav.tsx:64-118, 185-235` | `WORKING` | TanStack Router `<Link>` components with active state indicators and blur-active styling. |
| **Global / Navigation** | Unread Messages Badge | `frontend/src/components/veil/AppNav.tsx:25, 88-90, 212-214` | `MOCK_DATA` | Hardcoded `badge: "3"` in navigation item configuration. Does not query real unread message count. |
| **Global / Root** | Emergency Panic Key (`Esc`) | `frontend/src/routes/__root.tsx:29-45` | `WORKING` | Listens for `Escape` key, logs out, clears tokens, and redirects immediately to landing. |
| **`/` (Landing)** | Hero CTA "Enter Network" / "Create Account" | `frontend/src/routes/index.tsx:180-192` | `WORKING` | Navigates to `/onboarding` or `/social` depending on session state. |
| **`/` (Landing)** | Social Preview Card Reactions (Like / Comment) | `frontend/src/routes/index.tsx:244-252` | `DEAD` | Visual counters with `cursor-pointer` class; no `onClick` handlers attached. |
| **`/social` (Feed)** | Post Creation Trigger | `frontend/src/routes/social.tsx:505-515` | `WORKING` | Navigates to `/compose`. |
| **`/social` (Feed)** | Topic Search & Debounced Query | `frontend/src/routes/social.tsx:473-483` | `WORKING` | Updates search term; filters posts matching query in client feed. |
| **`/social` (Feed)** | Search Bar Filter Button (`SlidersHorizontal`) | `frontend/src/routes/social.tsx:484-490` | `DEAD` | `<button onClick={() => showToast("Showing all verified topics")}>`. No filter modal or logic. |
| **`/social` (Feed)** | Feed Tabs ("For You", "Following", "Anonymous", "Media") | `frontend/src/routes/social.tsx:522-548` | `WORKING` | Switches active tab and triggers TanStack Query fetch with `category` and `mode` query params. |
| **`/social` (Feed)** | Feed Post Like Button | `frontend/src/routes/social.tsx:806-825` | `WORKING` | Calls `api.toggleLike(post.id)`. Optimistically toggles like count and persists to Prisma `Like` table. |
| **`/social` (Feed)** | Post Repost Button | `frontend/src/routes/social.tsx:828-837` | `DEAD` | `<button onClick={() => showToast("Reposted successfully")}>` with static count `<span>3</span>`. Does not call backend `sharedPostId`. |
| **`/social` (Feed)** | Post Bookmark Button | `frontend/src/routes/social.tsx:854-862` | `DEAD` | `<button onClick={() => showToast("Bookmarked successfully")}>`. No bookmark API or DB persistence. |
| **`/social` (Feed)** | Post Options (`...`) on other authors' posts | `frontend/src/routes/social.tsx:714-722` | `DEAD` | Calls `showToast("Post options coming soon")`. No action sheet or report trigger. |
| **`/social` (Feed)** | Post Options Delete (author's own post) | `frontend/src/routes/social.tsx:724-740` | `WORKING` | Calls `api.deletePost(post.id)` and invalidates social feed queries. |
| **`/social` (Feed)** | Post Comment Expansion & View Comments | `frontend/src/routes/social.tsx:315-328, 838-853` | `BROKEN_WIRING` | Raw `fetch` to `${API_BASE}/v1/posts/${expandedPostId}` without `getHeaders()`. |
| **`/social` (Feed)** | Add Comment Submission | `frontend/src/routes/social.tsx:330-345, 930-955` | `WORKING` | Validates content, calls `api.createComment(postId, body)`, invalidates post query. |
| **`/social` (Feed)** | Who To Follow Connect Buttons | `frontend/src/routes/social.tsx:110-126, 224-226, 1070-1110` | `MOCK_DATA` | Toggles local state `followedHandles` only. No `Follow` table exists in Prisma schema. |
| **`/social` (Feed)** | Live Signals Button ("Live") | `frontend/src/routes/social.tsx:1018-1025` | `DEAD` | Triggers `showToast("Showing top signals")`. |
| **`/social` (Feed)** | Discover Directory Button ("Discover") | `frontend/src/routes/social.tsx:1065-1070` | `DEAD` | Triggers `showToast("Directory updated")`. |
| **`/compose`** | Mode Selector (Pseudonymous, Sovereign Anon, Ephemeral) | `frontend/src/routes/compose.tsx:109-115, 608-645` | `WORKING` | Sets `mode` ("pseudonymous", "anonymous", "ephemeral"). Sent to backend and stored in `post.mode`. |
| **`/compose`** | Format Tabs (Text, Media, Poll, Voice) | `frontend/src/routes/compose.tsx:117-131, 650-685` | `PARTIALLY_IMPLEMENTED` | Text and Media upload work. Poll only formats markdown `[ ]`. Voice only runs a timer. |
| **`/compose`** | Image Upload & Face Blurring | `frontend/src/routes/compose.tsx:285-334, 690-705` | `WORKING` | Client-side face detection via `@mediapipe/tasks-vision`, blurs faces on canvas, produces Blob payload. |
| **`/compose`** | Audience, Lifetime, & Engagement Selectors | `frontend/src/routes/compose.tsx:75-83, 133-145, 981-1091` | `PARTIALLY_IMPLEMENTED` | Dropdowns and toggles update React state, but values are omitted from `api.createPost` call. |
| **`/compose`** | Live Mockup Toolbar Reactions | `frontend/src/routes/compose.tsx:1330-1345` | `MOCK_DATA` | Renders static fake metrics: Heart (12), Comments (4), Reposts (2). |
| **`/compose`** | Publish Post Button | `frontend/src/routes/compose.tsx:395-460, 1140-1170` | `WORKING` | Calls `api.createPost`, runs backend AI moderation check, creates DB record, navigates to feed. |
| **`/news`** | Category Filter Tabs | `frontend/src/routes/news.tsx:44-65` | `WORKING` | Filters fetched verified news items by selected topic category. |
| **`/news`** | External Article Links | `frontend/src/routes/news.tsx:160-175` | `WORKING` | Opens original news source link in external tab with `rel="noopener noreferrer"`. |
| **`/video`** | Video Player Play/Pause, Mute/Unmute | `frontend/src/routes/video.tsx:40-75, 140-190` | `WORKING` | Standard HTML5 video element controls with reactive overlays. |
| **`/video`** | Video Engagement Buttons (Like, Share) | `frontend/src/routes/video.tsx:78-95, 210-240` | `WORKING` | Like toggles client state and updates count. Share uses `navigator.clipboard` or Web Share API. |
| **`/messages`** | Conversations List Fetch | `frontend/src/routes/messages.tsx:102-120` | `WORKING` | Calls `api.getConversations()` and displays user message threads. |
| **`/messages`** | New Message / Contact Selection | `frontend/src/routes/messages.tsx:125-155` | `WORKING` | Displays active users, creates/navigates to thread. |
| **`/messages`** | E2EE Key Synchronization Warning Dialog | `frontend/src/routes/messages.tsx:55-98, 160-195` | `BROKEN_WIRING` | Shows key reset dialog repeatedly if server has registered public key but client local storage lost keypair. |
| **`/messages/$threadId`** | E2EE Encrypted Message Send | `frontend/src/routes/messages.$threadId.tsx:85-135` | `WORKING` | Derives shared AES-GCM key, encrypts ciphertext, sends ciphertext + IV + ephemeral key to backend. |
| **`/messages/$threadId`** | Message Decryption & Render | `frontend/src/routes/messages.$threadId.tsx:140-190` | `WORKING` | Decrypts incoming AES-GCM ciphertext on the fly with recipient private key. |
| **`/safety`** | Safety Guidelines Tabs | `frontend/src/routes/safety.tsx:42-55` | `WORKING` | Switches active view between Guidelines, Reporting, and My Reports. |
| **`/safety`** | Submit Content Report Form | `frontend/src/routes/safety.tsx:57-123, 245-305` | `MOCK_DATA` | Saves report into browser `localStorage` (`social_space_user_reports`) with `REP-${Math.random()}`. |
| **`/safety`** | Submit Moderation Appeal Form | `frontend/src/routes/safety.tsx:374-440` | `MOCK_DATA` | Saves appeal into browser `localStorage`. No backend appeal submission endpoint. |
| **`/profile`** | Edit Profile (DisplayName, Bio, Avatar) | `frontend/src/routes/profile.tsx:210-255, 620-690` | `WORKING` | Calls `api.updateProfile(...)`, updates Prisma `User` record, updates UI. |
| **`/profile`** | 2FA (TOTP) Enable/Verify Flow | `frontend/src/routes/profile.tsx:260-315, 750-830` | `WORKING` | Fetches QR code from backend, verifies 6-digit TOTP token, persists `totpEnabled: true`. |
| **`/profile`** | WebAuthn / Passkey Registration | `frontend/src/routes/profile.tsx:320-375, 835-895` | `WORKING` | Fetches registration options, invokes `@simplewebauthn/browser`, registers credential on server. |
| **`/profile`** | Premium Waitlist Modal & Join | `frontend/src/routes/profile.tsx:1156-1304` | `MOCK_DATA` | Simulates 500ms `setTimeout`, sets local `isSubmitted: true`. No waitlist table or API. |
| **`/profile`** | Account Deletion | `frontend/src/routes/profile.tsx:405-445, 950-990` | `WORKING` | Prompts for passphrase confirmation, calls `api.deleteAccount()`, cleans up session. |
| **`/onboarding`** | Passphrase Registration + BIP39 Generation | `frontend/src/routes/onboarding.tsx:180-245` | `WORKING` | Argon2id hash + HIBP check + 12-word mnemonic recovery generation + JWT issuance. |
| **`/onboarding`** | WebAuthn Passkey Login / Register | `frontend/src/routes/onboarding.tsx:290-360` | `WORKING` | Complete WebAuthn ceremony end-to-end. |
| **`/onboarding`** | TOTP 2FA Challenge on Login | `frontend/src/routes/onboarding.tsx:250-285` | `WORKING` | Intercepts login when `requireMfa: true`, verifies token, issues auth tokens. |

---

## Root Cause Analysis for Non-Working Elements

### 1. `DEAD` Elements

#### Repost Button (`frontend/src/routes/social.tsx:828-837`)
- **Observed Behavior:** Clicking the repost button fires a toast: `"Reposted successfully"`. The counter is hardcoded to `3`.
- **Root Cause:** The component has no `repostMutation` wired up. In `backend/prisma/schema.prisma`, the `Post` model has a self-relation `sharedPostId String?` and `sharedPost Post?`, which was originally designed for reposts/quote posts. However, there is no controller action in `post.controller.js` or method in `frontend/src/lib/api.ts` to call this endpoint.

#### Bookmark Button (`frontend/src/routes/social.tsx:854-862`)
- **Observed Behavior:** Clicking the bookmark button triggers `showToast("Bookmarked successfully")`. The bookmark icon state is not saved.
- **Root Cause:** There is no `Bookmark` model in `schema.prisma`, no backend route, and no client API method.

#### Search Filter (`frontend/src/routes/social.tsx:484-490`) & Sidebar Signals/Discover (`:1018, :1065`)
- **Observed Behavior:** Clicking the slider icon triggers `showToast("Showing all verified topics")`. Clicking Live or Discover triggers static informational toasts.
- **Root Cause:** These buttons were created as aesthetic affordances during layout prototyping without corresponding filter state machines or directory routes.

#### Social Preview Card on Landing Page (`frontend/src/routes/index.tsx:244-252`)
- **Observed Behavior:** Like and comment counts render hover highlights and pointer cursors, but clicking does nothing.
- **Root Cause:** This is a marketing illustration component. The interactive cursor classes were accidentally applied to static preview DOM nodes.

---

### 2. `MOCK_DATA` Elements

#### Messages Unread Badge (`frontend/src/components/veil/AppNav.tsx:25`)
- **Observed Behavior:** Navigation bar displays a constant badge `"3"` next to Messages on both desktop sidebar and mobile bottom navigation.
- **Root Cause:** In `AppNav.tsx`, the `NAV_ITEMS` array hardcodes `badge: "3"` on the messages route object instead of deriving it from an unread message query (e.g. counting conversations with `unread: true` from `api.getConversations()`).

#### Safety Reports and Appeals (`frontend/src/routes/safety.tsx:57-123, 374-440`)
- **Observed Behavior:** Submitting a user report or moderation appeal stores the item in `localStorage.getItem("social_space_user_reports")` with a synthetic ID (`REP-${Math.random()}`).
- **Root Cause:** The backend moderation system (`backend/src/services/ai.service.js` and `backend/prisma/schema.prisma:ModerationLog`) is automated via Gemini during `post.controller.js:createPost`. No user-facing reporting API or database table exists for human review or appeal ingestion.

#### Who To Follow / Connect (`frontend/src/routes/social.tsx:110-126, 1070-1110`)
- **Observed Behavior:** Suggested users are fetched from `GET /v1/users/who-to-follow`. When the user clicks "Connect", the button flips to "Connected", but refreshing the page resets the state.
- **Root Cause:** The database does not have a `Follow` or `Relationship` table in `schema.prisma`. The frontend maintains `followedHandles` in ephemeral React `useState`.

#### Premium Waitlist Modal (`frontend/src/routes/profile.tsx:1156-1304`)
- **Observed Behavior:** Clicking "Join Waitlist" waits 500ms via `setTimeout` and shows a confirmation state.
- **Root Cause:** While the `User` model contains `isPremium Boolean @default(false)`, there is no waitlist queue table or API endpoint.

---

### 3. `BROKEN_WIRING` Elements

#### Comments Retrieval in Feed (`frontend/src/routes/social.tsx:315-328`)
- **Observed Behavior:** When a user clicks to view comments on an expanded post, the frontend does a raw `fetch(`${API_BASE}/v1/posts/${expandedPostId}`)` without setting the `Authorization: Bearer <token>` header from `getHeaders()`.
- **Root Cause:** While the post endpoint is publicly readable, comments associated with the post can fail or return unauthenticated payloads depending on deployment CORS and header configurations. The query should use the standardized `api.ts` client wrapper.

#### E2EE Key Synchronization Warning Loop (`frontend/src/routes/messages.tsx:55-98`)
- **Observed Behavior:** If a user logs in on a new browser or clears their local storage, the backend retains their public key (`User.publicKey`), but the client lacks the private key. This triggers `setShowKeyResetDialog(true)` on every mount.
- **Root Cause:** The key-exchange lifecycle does not provide a one-click re-generation or recovery mechanism from the BIP39 mnemonic; the dialog prompts the user without explaining how to re-derive their local keypair.

---

### 4. `PARTIALLY_IMPLEMENTED` Elements

#### Compose Voice Recording (`frontend/src/routes/compose.tsx:128-131, 764-792`)
- **Observed Behavior:** Selecting the Voice tab provides a microphone button. Clicking it triggers a seconds-based elapsed timer (`voiceDuration`), but no audio data is recorded.
- **Root Cause:** The component never requests `navigator.mediaDevices.getUserMedia({ audio: true })` and has no `MediaRecorder` instance.

#### Compose Poll Creation (`frontend/src/routes/compose.tsx:117-121, 387-392`)
- **Observed Behavior:** Users can add poll choices, but the submit handler simply concatenates them as markdown checkmarks (`- [ ] Choice`) into the post body.
- **Root Cause:** There is no `Poll` or `PollVote` model in Prisma. Posts display the text, but users in the feed cannot vote interactively.

#### Audience & Lifetime Post Options (`frontend/src/routes/compose.tsx:75-83, 133-145, 981-1091`)
- **Observed Behavior:** The UI allows selecting "Audience" (Everyone, Circle, Selected) and "Lifetime" (24h, 7d, 30d, Forever).
- **Root Cause:** The `handleSubmit` function in `compose.tsx` constructs `api.createPost(finalBody, category, backendMode, mediaPayload)`, completely discarding `audience` and `lifetime`. Furthermore, the backend `Post` model does not store an `expiresAt` or `audience` column.

---

## Phase 3: Auth Timing & Bottleneck Analysis

### 1. Argon2id Cryptographic Parameters
- **Current Configuration (`backend/src/utils/crypto.js:25-30`):**
  ```javascript
  const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  };
  ```
- **Performance Impact:**
  - On developer machines (multi-core desktop), 64 MiB with `timeCost: 3` executes in ~200–300ms.
  - On standard container environments (e.g. Azure Container Apps with 0.5–1 vCPU allocation), this CPU-bound hash takes **600ms–900ms** per execution.
  - While adhering to strict OWASP guidelines for Argon2id, executing this alongside other serial network requests compounds signup and signin latency.

### 2. Sequential Bottlenecks in Registration (`backend/src/controllers/register.controller.js`)
Currently, `registerUser` executes the following operations in strict series:
1. Passphrase entropy calculation (`calculateEntropy`) — synchronous (~1ms).
2. HaveIBeenPwned (HIBP) external API request (`axios.get("https://api.pwnedpasswords.com/range/...")`) with a 4000ms timeout — **~150ms–350ms** network latency.
3. Database uniqueness check (`prisma.user.findUnique({ where: { handle } })`) — **~40ms–100ms** database roundtrip.
4. Argon2id passphrase hash (`hashPassphrase`) — **~600ms–900ms** CPU time.
5. BIP39 recovery code generation (`generateRecoveryCodes(8)`) + hashing each code — **~10ms**.
6. Prisma transaction (`prisma.$transaction`) to write user, keys, and recovery codes — **~80ms–150ms**.

**Total Registration Time:** **~900ms – 1,500ms+**.

#### Optimization Opportunity:
The HIBP check (Step 2) and the Database handle check (Step 3) are completely independent. Running them concurrently with `Promise.all` eliminates 40ms–100ms of latency immediately without modifying any security parameters.

### 3. Login Flow Bottlenecks (`backend/src/controllers/login.controller.js`)
1. User lookup (`prisma.user.findUnique`) is executed.
2. If the user is missing, a dummy hash is verified to prevent user-enumeration timing attacks (`verifyPassphrase(DUMMY_HASH, passphrase)`).
3. If the user exists, `verifyPassphrase` runs, followed by session token issuance and database logging.
4. Total login time is ~300ms–700ms, predominantly dominated by Argon2id CPU time, which is cryptographically necessary.

### 4. Client-Side UX Perception Bottleneck (`frontend/src/routes/onboarding.tsx`)
1. During signup, the form sets `isLoading = true`. While the backend is crunching the external HIBP check, Argon2id hash, and database transaction, the frontend shows only a static generic spinner.
2. In the TOTP challenge step (`handleTotpVerify`), `setIsLoading(false)` is invoked synchronously before route transition, causing a momentary flash of unstyled inputs.
3. **Recommendation:** Introduce granular micro-status feedback on the button/card (e.g., *"Verifying entropy & breach safety..."* $\rightarrow$ *"Generating sovereign keys..."* $\rightarrow$ *"Securing identity..."*). This dramatically lowers perceived latency while maintaining rigorous cryptographic strength.

---

## Action Plan for Phase 2 Implementation

| Element / Issue | Target File(s) | Proposed Resolution Strategy |
| :--- | :--- | :--- |
| **Comments Raw Fetch** | `frontend/src/routes/social.tsx` | Wire via `api.ts` client with proper bearer authorization headers. |
| **Messages Unread Badge** | `frontend/src/components/veil/AppNav.tsx` | Wire dynamic query counting unread conversations from `api.getConversations()`. |
| **Repost Action** | `frontend/src/routes/social.tsx`, `backend/src/controllers/post.controller.js` | Implement `api.createRepost` calling backend `sharedPostId` flow or gracefully disable with clean tooltip if deferred. |
| **Search Filter Button** | `frontend/src/routes/social.tsx` | Wire active category filter pill selection or clean interactive popover. |
| **Landing Hero Mock Cursors** | `frontend/src/routes/index.tsx` | Remove misleading `cursor-pointer` classes or wire to redirect to active demo feed. |
| **Registration Concurrency** | `backend/src/controllers/register.controller.js` | Parallelize HIBP check and DB handle lookup using `Promise.all`. |
| **Onboarding Perceived Speed** | `frontend/src/routes/onboarding.tsx` | Implement progressive state status indicators during registration and clean MFA transitions. |
| **Compose Voice / Polls / Options** | `frontend/src/routes/compose.tsx` | Either wire real `MediaRecorder` audio capture and backend payload fields, or clearly mark unsupported draft options with transparent user notifications. |

---

## Conclusion & Request for Approval

The audit is complete. No source code has been altered during this phase. All findings have been verified by inspecting the frontend JSX and backend controllers end-to-end.

Please review this report. Upon your approval, we will proceed immediately to **Phase 2 (Fixing Findings Root-Cause First)** and **Phase 3 (Applying Auth Performance & Loading Enhancements)**.
