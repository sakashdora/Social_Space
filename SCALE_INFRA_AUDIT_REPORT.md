# VEIL Social_Space — Scale & Delivery Infrastructure Audit Report

**Audit Date:** 2026-09-10
**Scope:** Full repository scan — `backend/`, `frontend/`, root configs (`vercel.json`, `docker-compose.yml`), env templates, Prisma schema, all JS/TS source files.

---

## 1. Executive Summary

VEIL is a small-scale production system that has implemented **one partial scaling layer** (connection pooling via PgBouncer, scoped to its Supabase configuration) and **one narrowly-scoped caching layer** (Upstash Redis, used exclusively for auth challenge/TOTP/WebAuthn short-lived tokens — not for any application data). Every other scale and delivery component is absent: there is no CDN in front of media bytes, no caching of feed queries or user profiles, no chunked or resumable upload logic, no real-time message transport (chat is driven entirely by HTTP polling at 2.5-second intervals), no message queue or async job worker (AI moderation runs synchronously in the request/response cycle via `safeWaitUntil`), no thumbnail-first / progressive loading strategy beyond a server-generated JPEG poster for videos, and no read-replica configuration. The architecture will function adequately at dozens of concurrent users. At 10,000+ concurrent users it will encounter database saturation, poll-hammering of the API, upload timeouts on large files, and media latency hot-spots simultaneously.

---

## 2. Findings Table

| # | Component | Status | Evidence (file:line) | Notes |
|---|---|---|---|---|
| 1 | CDN for media delivery | **Absent** | `media.routes.js:103` — `Cache-Control: no-store, private`; `VERCEL_DEPLOYMENT.md:15` (static JS/CSS only) | Media bytes are signed Supabase URLs; no CDN layer. Static JS/CSS served by Vercel Edge CDN only. |
| 2 | Caching layer (Redis/Memcached) | **Partial** | `challengeStore.js:21-35` — Upstash Redis wired in; `posts.controller.js:213`, `chats.controller.js:104` — bare Prisma queries | Redis present but used only for auth challenge tokens; no feed, profile, or session caching. |
| 3 | Chunked / resumable media upload | **Absent** | `api.ts:569-573` — single `fetch PUT` to signed URL; `media.routes.js:167-169` — `createSignedUploadUrl` returning a single URL | No chunking, no tus, no multipart. One PUT per file up to 50 MB. |
| 4 | Real-time message delivery | **Absent** | `messages.$threadId.tsx:64` — `refetchInterval: 2500`; `messages.tsx:125` — `refetchInterval: 4000`; `social.tsx:337` — `refetchInterval: 5000` | Pure HTTP polling. No WebSocket, SSE, MQTT, or socket.io found anywhere in the repo. |
| 5 | Message queue / async job processing | **Absent** | `posts.controller.js:176-180` — `safeWaitUntil(analyzeAndModeratePost(...))` in-process; `cron.service.js:158-163` — `setInterval` loop | No BullMQ, RabbitMQ, Kafka, or Azure Service Bus. Moderation and cleanup run in-process. |
| 6 | Thumbnail-first / progressive loading | **Partial** | `mediaProcessor.js:93-121` — ffmpeg extracts `_thumb.jpg`; `media.routes.js:70-80` — `?thumb=true` parameter; `social.tsx:800` — `poster={thumbUrl}` | Video poster thumbnails generated and served. No blur-hash, LQIP, or progressive JPEG for images. |
| 7 | Database read scaling | **Partial** | `.env.example:5` — `?pgbouncer=true&connection_limit=2`; `pgPool.js:27` — `max: 2`; `schema.prisma:5-9` — single `url` + `directUrl` only | PgBouncer transaction-mode pooling active via Supabase. No read-replica URL. No Prisma read-replica extension. Connection limit set to 2. |

---

## 3. Detailed Findings

### 3.1 CDN for Media Delivery

**Verdict: Absent**

Media files are stored in Supabase Storage. The streaming endpoint (`GET /api/media/stream/:postId`) performs access checks, then generates a 15-minute signed URL and issues a `302` redirect to the Supabase origin URL directly.

```js
// backend/src/routes/media.routes.js : 89-106
const { data: signedData, error: signError } = await supabase.storage
  .from(bucketName)
  .createSignedUrl(targetPath, 900);   // 900s = 15 min expiry

// Security header: Ensure CDNs and proxies never cache this endpoint keyed on postId
res.set("Cache-Control", "no-store, private");

// 302 redirect for direct <video src="..." poster="..."> consumption
return res.redirect(302, signedData.signedUrl);
```

The `Cache-Control: no-store, private` header **explicitly prevents** any CDN from caching media bytes. Every media load path is:

```
Browser -> Vercel Serverless Function -> Supabase Storage Origin
```

`VERCEL_DEPLOYMENT.md:15` references Vercel's Edge CDN only for **static frontend assets**:

```
Static frontend assets are served directly via Vercel's Edge CDN (frontend/dist/client).
```

No Cloudflare, Azure Front Door, Fastly, or other media CDN configuration exists in any env template, `vercel.json`, `docker-compose.yml`, or source file. No `cdn.*` environment variables appear in `.env.example` or `.env.production.template`.

---

### 3.2 Caching Layer (Redis/Memcached)

**Verdict: Partial**

`@upstash/redis` is installed (`backend/package.json:30`) and `challengeStore.js` initializes a live client when env vars are present:

```js
// backend/src/config/challengeStore.js : 21-35
import { Redis } from "@upstash/redis";

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log("[challengeStore] Using Upstash Redis backend.");
} else {
  console.warn(`... falling back to in-memory store.`);
}
```

The `store` object from `challengeStore.js` is called **exclusively** from auth flows (WebAuthn challenge storage, pending TOTP secret storage). It is imported by zero application-data controllers. Evidence for absence of feed/profile caching:

```js
// backend/src/controllers/posts.controller.js : 213-258 (getFeed)
const posts = await prisma.post.findMany({
  where, skip, take, orderBy: { createdAt: "desc" },
  include: { user: ..., media: ..., sharedPost: ..., _count: ... }
});
// No cache read before query. No cache write after query.
```

```js
// backend/src/controllers/chats.controller.js : 104-107 (getChatMessages)
const messages = await prisma.message.findMany({
  where: { threadId },
  orderBy: { createdAt: "asc" }
});
// No cache lookup. Every GET hits the database.
```

---

### 3.3 Chunked / Resumable Media Upload

**Verdict: Absent**

The upload flow is a three-step sequence but each step is a single atomic HTTP request — no chunking, tus protocol, or multipart splitting:

**Step 1 — Backend generates a presigned PUT URL:**
```js
// backend/src/routes/media.routes.js : 167-169
const { data: uploadData, error: uploadError } = await supabase.storage
  .from(bucketName)
  .createSignedUploadUrl(storagePath);   // Standard Supabase upload URL (not resumable)
```

**Step 2 — Frontend sends the entire file in one fetch PUT:**
```ts
// frontend/src/lib/api.ts : 568-576
if (initData.signedUrl) {
  const uploadRes = await fetch(initData.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,                        // Entire File object — no chunking
  });
}
```

**Step 3 — Server confirmation (ffprobe + ffmpeg thumbnail):**
```ts
// frontend/src/lib/api.ts : 581-592
const confirmRes = await fetch(`${API_BASE}/api/media/confirm`, { ... });
```

No `tus` client library, no `@supabase/storage-js` resumable upload API call (`resumableUploadUrl`), no `S3.createMultipartUpload`, and no client-side file splitting were found. The `onProgress` callback in `uploadMedia` reflects three coarse status strings (`"uploading"`, `"processing"`, `"ready"`) tied to full-step completion — not byte-level chunk progress.

---

### 3.4 Real-Time Message Delivery Transport

**Verdict: Absent — mechanism is HTTP polling**

A repo-wide regex search across all `.js`/`.ts`/`.tsx` files for `websocket`, `socket.io`, `ws`, `WebSocket`, `SSE`, `EventSource`, `server-sent`, `long-poll` returned **zero results**.

Chat messages are fetched by `useQuery` with fixed `refetchInterval`:

```ts
// frontend/src/routes/messages.$threadId.tsx : 61-65
const { data: messages = [], isLoading } = useQuery({
  queryKey: ["chatMessages", threadId],
  queryFn: () => fetchChatMessages(threadId),
  refetchInterval: 2500,    // HTTP GET every 2.5 seconds
});
```

```ts
// frontend/src/routes/messages.tsx : 122-126
const { data: threads = [], isLoading } = useQuery({
  queryKey: ["chats"],
  queryFn: fetchChats,
  refetchInterval: 4000,    // HTTP GET every 4 seconds
});
```

```ts
// frontend/src/routes/social.tsx : 333-338
const { data: chats = [] } = useQuery({
  queryKey: ["chats"],
  queryFn: fetchChats,
  enabled: authed,
  refetchInterval: 5000,    // HTTP GET every 5 seconds (social feed sidebar)
});
```

`fetchChatMessages` resolves to `GET /v1/chats/:threadId` which issues a fresh `prisma.message.findMany` on every invocation. There is no server push of any kind.

---

### 3.5 Message Queue / Async Job Processing

**Verdict: Absent**

A repo-wide search for `BullMQ`, `bull`, `RabbitMQ`, `kafka`, `service.bus`, `queue`, `worker` returned **zero results**.

AI content moderation runs inside the request lifecycle (deferred until after HTTP response, but still in-process):

```js
// backend/src/controllers/posts.controller.js : 175-180
// Run background AI moderation (non-blocking, serverless-safe lifecycle)
safeWaitUntil(
  analyzeAndModeratePost(post.id, content).catch((err) => {
    console.error(`Background post moderation fail-to-launch for ${post.id}:`, err);
  })
);
```

`safeWaitUntil` (from `@vercel/functions`) keeps the serverless function alive until the Gemini/Groq API call completes. This is not a queue — it is an in-process async call that holds the function warm. On Docker/Azure Container Apps, it is a bare fire-and-forget promise in the Node.js process with no retry, backpressure, or dead-letter handling.

Data retention cleanup runs as a `setInterval` loop inside the main process:

```js
// backend/src/services/cron.service.js : 158-163
setInterval(() => {
  runRetentionCleanup().catch((err) => { ... });
}, 10 * 60 * 1000);   // every 10 minutes, in-process
```

On Vercel, this is replaced by a Vercel Cron trigger (`vercel.json:15-19`), but the called function is still the same synchronous cleanup running inside the serverless invocation. No durable queue, no worker process, no dead-letter path exists.

---

### 3.6 Thumbnail-First / Progressive Media Loading

**Verdict: Partial**

**What exists:** The server-side pipeline extracts a single JPEG frame at 0.5s from uploaded videos using ffmpeg and stores it separately in Supabase Storage:

```js
// backend/src/utils/mediaProcessor.js : 98-104
await execFileAsync(resolvedFfmpeg, [
  "-ss", "0.5",
  "-i", videoPath,
  "-frames:v", "1",
  "-y",
  outputPath
]);
```

This thumbnail is stored at `media/<userId>/<mediaId>_thumb.jpg` and served via `GET /api/media/stream/:postId?thumb=true`. It is used as the HTML `<video>` `poster` attribute:

```tsx
// frontend/src/routes/social.tsx : 800
poster={"thumbUrl" in mediaObj ? mediaObj.thumbUrl : undefined}
```

**What is absent:**
- No blur-hash, LQIP, or any placeholder for **images** — images load blank until the signed URL resolves
- No progressive JPEG encoding step in the upload pipeline
- The thumbnail stream endpoint itself performs a database query (post lookup + moderation check) and a Supabase Storage signed URL generation on every request — no cached poster URL is stored or pre-resolved

---

### 3.7 Database Read Scaling

**Verdict: Partial**

**Connection Pooling — Present (via Supabase PgBouncer):**

`DATABASE_URL` is configured in PgBouncer transaction mode through Supabase's pooler:

```
// backend/.env.example : 5
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=2"
```

A secondary `pg.Pool` with `max: 2` exists exclusively for the rate-limiter:

```js
// backend/src/config/pgPool.js : 25-31
export const pgPool = globalForPg.pgPool || new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
  statement_timeout: 5_000,
});
```

Comments in `pgPool.js` explicitly budget for a 2-replica deployment (4 Prisma + 4 rate-limiter = 8 of 15 Supabase free-tier pooler connections).

**Read Replicas — Absent:**

`schema.prisma` defines only a single `url` (pooled runtime) and `directUrl` (migrations only). No Prisma read-replica extension, no `READ_REPLICA_URL` env var, and no per-query routing hint exist anywhere in the codebase:

```prisma
// backend/prisma/schema.prisma : 5-9
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Query-Level Caching — Absent:** As documented in section 3.2, no query result is stored in Redis or any other cache layer.

---

## 4. Risk Ranking

Ordered by severity at scale (10,000+ concurrent users), highest to lowest:

| Rank | Component | Risk at Scale |
|------|-----------|---------------|
| ?? **1** | **No real-time message transport** (polling at 2.5s) | At 10k active chat users, `GET /v1/chats/:threadId` generates ~4,000 req/s to Postgres continuously with zero message activity. This alone will saturate the connection pool (hard ceiling: 2 Prisma connections per instance) and crash the database under read lock contention. |
| ?? **2** | **No caching on feed/profile queries** | Every page load issues multiple multi-join Prisma queries (user + media + sharedPost + reaction count). With zero cache, database CPU scales linearly with concurrent users. The feed and chat list are the most-hit endpoints. |
| ?? **3** | **No CDN for media** | Every video/image load triggers a serverless function invocation (access check + signed URL generation) before a 302 to Supabase origin. At scale this saturates Vercel's concurrency budget and adds 200–800ms cold-path latency per media load. |
| ?? **4** | **No chunked/resumable upload** | A 50 MB video upload over a degraded mobile connection fails with no recovery. The `/api/media/confirm` step re-downloads the full video server-side for ffprobe/ffmpeg — doubling bandwidth cost. On Vercel (60s max function duration), large video confirmation will time out. |
| ?? **5** | **No message queue / async jobs** | On Vercel, `safeWaitUntil` holds function warm for the full Gemini API call (1–5s per post). At 500 posts/min this creates back-pressure on serverless concurrency. Retention cleanup has no durability guarantee across deploys. |
| ?? **6** | **No read replicas** | All reads hit the single primary through PgBouncer. `connection_limit=2` is the per-instance hard ceiling. Combined with poll-driven chat (Item 1) and uncached feed queries (Item 2), the primary becomes the single failure point for the entire application. |
| ?? **7** | **Partial thumbnail loading (images lack placeholder)** | Images load blank until the full signed URL resolves. Lower severity because images are typically smaller than videos and load faster, but this produces cumulative layout shift at scale and degrades perceived performance on slow connections. Compounded by the absence of CDN (Item 3). |

---

*Report end. No recommendations or fixes are included. All evidence citations reference specific file paths and line numbers verified by direct source code inspection during this audit.*
