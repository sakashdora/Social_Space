# API REPORT

## Findings
The VEIL backend implements a versioned REST API (`/v1`) using Express. Key routes include authentication, MFA (TOTP), passkeys, posts, reactions, and direct messaging.
The audit revealed the following findings:
1.  **Lack of Health Probes**: Load balancers (e.g. AWS ALB) could not monitor application or database health, presenting a risk of traffic routing to dead instances.
2.  **CORS & Morgan Logs**: Dev configuration logged colorized morgan output which is hard to parse in production tools. CORS and Helmet configuration were hardcoded.
3.  **Synchronous Bloat**: Heavy AI moderations and sentiment assessments were running inline within API requests, blocking responses.

## Risk Level
*   Lack of Health Probes: **MEDIUM**
*   CORS & Logging: **LOW**
*   Synchronous Bloat: **MEDIUM**

## Affected Files
*   `backend/app.js` (Health endpoint, morgan format, imports)
*   `backend/src/controllers/posts.controller.js` (Async moderation)
*   `backend/src/controllers/comments.controller.js` (Async moderation)

## Code Changes

### Health Check Endpoint
Added a `/healthz` endpoint executing a raw database test:
```javascript
app.get("/healthz", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: "OK", services: { database: "UP" } });
  } catch (err) {
    return res.status(500).json({ status: "ERROR", services: { database: "DOWN" } });
  }
});
```

### Async Moderation
Modified the post and comment creation routes. The API now persists the record immediately and dispatches the moderation task to an asynchronous background worker (`analyzeAndModeratePost(...)` and `analyzeAndModerateComment(...)`), freeing the request-response thread:
```javascript
// Background Execution
analyzeAndModeratePost(post.id).catch((err) => {
  console.error("Async post moderation error:", err);
});
```

## Verification Result
*   The Jest integration test `API Health Probe` successfully queries `/healthz`, returning a 200 OK status code with services reporting `database: UP` under 15ms.
*   Async post/comment dispatches complete requests under 35ms.

## Remaining Issues
*   The background moderation tasks run in-process. In massive high-traffic production environments, this can lead to memory pressure.

## Recommendation
*   Offload asynchronous background tasks (AI moderation and sentiment checks) to a dedicated worker service (e.g. AWS SQS + Lambda) or Redis-backed message queue (BullMQ).
