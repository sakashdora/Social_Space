# SECURITY REPORT

## Findings
VEIL is designed as an anonymous, secure space. However, several high-impact security vulnerabilities were identified in the initial code audit:
1.  **Stored XSS (Cross-Site Scripting)**: User comments did not filter HTML inputs, allowing scripts to be executed inside other clients' browsers.
2.  **Rate-Limit DoS (Denial of Service)**: The brute-force progressive lockout keyed logins on the user's `handle` globally, permitting an attacker to lock any user out of their account indefinitely.
3.  **Recovery Codes Timing Attack**: The recovery code matcher returned early on success, leaking the index of correct recovery codes via response time. Passphrase hashing occurred conditionally, revealing user existence.
4.  **MIME Spoofing**: Uploaded media relied on client-supplied file extensions, which could allow malicious scripts (e.g. PHP/JS code) disguised as images to bypass restrictions.

## Risk Level
*   Stored XSS: **CRITICAL**
*   Rate-Limit DoS Lockout: **HIGH**
*   Recovery Code Timing Attack: **MEDIUM**
*   MIME Spoofing: **HIGH**

## Affected Files
*   `backend/src/controllers/comments.controller.js` (Stored XSS)
*   `backend/src/middleware/rateLimiter.js` (DoS Lockout)
*   `backend/src/controllers/auth/login.controller.js` (DoS Lockout)
*   `backend/src/utils/recoveryCodes.js` (Timing Attacks)
*   `backend/src/controllers/auth/recovery.controller.js` (Timing Attacks)
*   `backend/src/routes/upload.routes.js` (MIME Spoofing)
*   `backend/src/routes/media.routes.js` (MIME Spoofing)

## Code Changes

### Stored XSS Fix
Used `sanitize-html` to filter inputs prior to database storage:
```javascript
import sanitizeHtml from "sanitize-html";
const sanitizedContent = sanitizeHtml(content, {
  allowedTags: [],
  allowedAttributes: {}
});
```

### Rate-Limit DoS Fix
Modified database tracking key to incorporate the client's IP:
```javascript
const lookupKey = `${handle}:${ip}`;
```

### Timing Attacks Fix
1. Used `crypto.timingSafeEqual` in `findMatchingRecoveryCode` to check all 8 slots without early exits.
2. Initiated the Argon2id passphrase hash promise concurrently at startup in `redeemRecoveryCode` to eliminate timing differentials based on user existence.

### MIME Spoofing Fix
Added magic byte signature validation to check file buffers against file type headers (JPEG, PNG, GIF, WebP, MP4, HEIC, MOV, WebM).

## Verification Result
*   XSS sanitization tests show script tags are successfully stripped to empty strings.
*   Automated integration test `IP-Scoped Lockout Rate Limiting` verified that lockout counts are scoped strictly per IP, preventing target account lockout.
*   Jest test `should scan all records even if a match is found` confirmed timing safe comparison behavior.
*   Builds successfully with zero compilation warnings.

## Remaining Issues
*   None. All identified critical and high vulnerabilities have been fully mitigated.

## Recommendation
*   Enforce HTTP-only, secure, same-site cookies for JWT tokens.
*   Implement strict Content Security Policies (CSP) via Helmet in production.
