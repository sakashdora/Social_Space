/**
 * rateLimiter.js -- Per-account progressive lockout (Postgres via Prisma)
 *
 * --- IP-based rate limiting -----------------------------------------------
 * IP limiters have been migrated to Postgres-backed rate-limiter-flexible.
 * See: src/config/rateLimiters.js + src/config/pgPool.js
 *
 * Import pgRateLimit from rateLimiters.js in your routes:
 *   import { pgRateLimit } from "../config/rateLimiters.js";
 *   router.post("/login", pgRateLimit("login"), accountLockoutGuard, loginHandler);
 *
 * --- Per-account lockout --------------------------------------------------
 * The lockout system below is keyed on `handle` (not IP) -- immune to IP rotation.
 * It uses the Prisma LoginAttempt table and is already durable across replicas.
 *
 * Lockout schedule:
 *   3 fails  -> 30 seconds
 *   5 fails  -> 5 minutes
 *   8 fails  -> 30 minutes
 *   12 fails -> 24 hours
 */

import prisma from "../config/prisma.js";

// --- Per-account lockout schedule -----------------------------------------

const LOCKOUT_SCHEDULE = [
  { fails: 12, lockMs: 24 * 60 * 60 * 1000 }, // 12+ -> 24 hours
  { fails: 8,  lockMs: 30 * 60 * 1000 },       // 8+  -> 30 minutes
  { fails: 5,  lockMs:  5 * 60 * 1000 },       // 5+  -> 5 minutes
  { fails: 3,  lockMs:      30 * 1000 },        // 3+  -> 30 seconds
];

/**
 * Express middleware: check if the account identified by req.body.handle is locked.
 * Call next(err) with a 429 response if the account is currently locked.
 *
 * Usage: router.post("/login", pgRateLimit("login"), accountLockoutGuard, loginHandler)
 */
export async function accountLockoutGuard(req, res, next) {
  const handle = (req.body?.handle || req.params?.handle || "").trim().toLowerCase();
  if (!handle) return next();

  // Key is per-account only (not per-account:ip) -- truly immune to IP rotation.
  // DoS via lockout is mitigated by the separate IP-based pgRateLimit("login") above.
  const key = handle;

  try {
    const attempt = await prisma.loginAttempt.findUnique({ where: { handle: key } });
    if (!attempt) return next();

    if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
      const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: `Account temporarily locked due to too many failed attempts. Try again in ${remaining} seconds.`,
        lockedUntilTs: attempt.lockedUntil.toISOString(),
      });
    }

    next();
  } catch (err) {
    console.error("accountLockoutGuard error:", err);
    next(); // fail open -- don't block login on DB error
  }
}

/**
 * Record a failed authentication attempt for a given handle.
 * Applies the lockout schedule automatically.
 *
 * @param {string} handle
 */
export async function recordFailedAttempt(handle) {
  const key = handle.trim().toLowerCase();
  try {
    await prisma.loginAttempt.upsert({
      where:  { handle: key },
      create: { handle: key, failCount: 1, lockedUntil: null },
      update: { failCount: { increment: 1 } },
    });

    const refetched = await prisma.loginAttempt.findUnique({ where: { handle: key } });
    const failCount = refetched?.failCount ?? 1;

    let lockedUntil = null;
    for (const { fails, lockMs } of LOCKOUT_SCHEDULE) {
      if (failCount >= fails) {
        lockedUntil = new Date(Date.now() + lockMs);
        break;
      }
    }

    if (lockedUntil) {
      await prisma.loginAttempt.update({
        where: { handle: key },
        data:  { lockedUntil },
      });
    }
  } catch (err) {
    console.error("recordFailedAttempt error:", err);
  }
}

/**
 * Clear the failed attempt counter for a handle after a successful authentication.
 *
 * @param {string} handle
 */
export async function clearFailedAttempts(handle) {
  const key = handle.trim().toLowerCase();
  try {
    await prisma.loginAttempt.delete({ where: { handle: key } }).catch(() => {});
  } catch {
    // Ignore -- not critical if cleanup fails
  }
}
