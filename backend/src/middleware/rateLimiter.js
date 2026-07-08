/**
 * rateLimiter.js — IP-based rate limiting + per-account progressive lockout
 *
 * IP limiters use express-rate-limit (in-memory store).
 * PRODUCTION: replace MemoryStore with a Redis store (e.g. rate-limit-redis)
 * to share state across multiple server instances.
 *
 * Per-account lockout uses the Prisma LoginAttempt table — durable across restarts,
 * and immune to IP rotation (tracks by handle, not IP).
 *
 * Lockout schedule:
 *   3 fails  → 30 seconds
 *   5 fails  → 5 minutes
 *   8 fails  → 30 minutes
 *   12 fails → 24 hours
 */

import rateLimit from "express-rate-limit";
import prisma from "../config/prisma.js";

// ─── IP-based limiters ────────────────────────────────────────────────────────

/**
 * General login endpoint limiter: 10 attempts per IP per 15 minutes.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts from this network. Try again later." },
  skipSuccessfulRequests: false,
});

/**
 * Phase 3 Fix #14 — Registration limiter: 3 registrations per IP per hour.
 * Prevents automated account creation while allowing legitimate users to retry.
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts from this network. Try again in an hour." },
  skipSuccessfulRequests: true, // Don't count successful registrations against the limit
});

/**
 * TOTP verify limiter: 10 attempts per IP per 5 minutes.
 */
export const totpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many TOTP attempts from this network. Try again later." },
});

/**
 * Sensitive action limiter (passphrase change, disable TOTP, remove passkey, etc.):
 * 5 attempts per IP per 15 minutes.
 */
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sensitive action attempts from this network. Try again later." },
});

/**
 * Recovery code redemption: 5 attempts per IP per hour.
 * (Per-account is not enforced here because the account is presumed inaccessible,
 * but we still cap per-IP to prevent bulk guessing across handles.)
 */
export const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many recovery attempts from this network. Try again in an hour." },
});

// ─── Per-account lockout schedule ─────────────────────────────────────────────

const LOCKOUT_SCHEDULE = [
  { fails: 12, lockMs: 24 * 60 * 60 * 1000 }, // 12+ → 24 hours
  { fails: 8,  lockMs: 30 * 60 * 1000 },       // 8+  → 30 minutes
  { fails: 5,  lockMs: 5  * 60 * 1000 },        // 5+  → 5 minutes
  { fails: 3,  lockMs: 30 * 1000 },             // 3+  → 30 seconds
];

/**
 * Express middleware: check if the account identified by req.body.handle is locked.
 * Attach the lockout state to req.lockout for downstream use.
 * Call next(err) with a 429 response if the account is currently locked.
 *
 * Usage: router.post("/login", loginLimiter, accountLockoutGuard, loginHandler)
 */
export async function accountLockoutGuard(req, res, next) {
  const handle = (req.body?.handle || req.params?.handle || "").trim().toLowerCase();
  if (!handle) return next();

  try {
    const attempt = await prisma.loginAttempt.findUnique({ where: { handle } });
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
    next(); // fail open — don't block login on DB error
  }
}

/**
 * Record a failed authentication attempt for a given handle.
 * Applies the lockout schedule automatically.
 *
 * @param {string} handle
 */
export async function recordFailedAttempt(handle) {
  const cleanHandle = handle.trim().toLowerCase();
  try {
    const current = await prisma.loginAttempt.upsert({
      where: { handle: cleanHandle },
      create: { handle: cleanHandle, failCount: 1, lockedUntil: null },
      update: { failCount: { increment: 1 } },
    });

    const newCount = current.failCount + 1; // upsert returns pre-update value in some adapters; refetch
    const refetched = await prisma.loginAttempt.findUnique({ where: { handle: cleanHandle } });
    const failCount = refetched?.failCount ?? newCount;

    // Determine appropriate lockout duration
    let lockedUntil = null;
    for (const { fails, lockMs } of LOCKOUT_SCHEDULE) {
      if (failCount >= fails) {
        lockedUntil = new Date(Date.now() + lockMs);
        break;
      }
    }

    if (lockedUntil) {
      await prisma.loginAttempt.update({
        where: { handle: cleanHandle },
        data: { lockedUntil },
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
  const cleanHandle = handle.trim().toLowerCase();
  try {
    await prisma.loginAttempt.delete({ where: { handle: cleanHandle } }).catch(() => {});
  } catch {
    // Ignore — not critical if cleanup fails
  }
}
