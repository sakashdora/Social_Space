/**
 * src/config/rateLimiters.js
 *
 * Postgres-backed rate limiters via rate-limiter-flexible (RateLimiterPostgres).
 *
 * All counters are stored in the `rate_limit_counters` table in Supabase Postgres.
 * Multi-replica safe: all Azure Container Apps replicas read/write the same counter rows.
 *
 * FAIL-OPEN POLICY (confirmed by owner 2026-07-15 -- see implementation_plan.md):
 *   If a counter read/write fails (DB timeout, pool exhaustion), the request is ALLOWED.
 *   Rationale: availability > momentary rate-limit bypass. The per-account LoginAttempt
 *   lockout (recordFailedAttempt in rateLimiter.js) is a durable Postgres-backed fallback
 *   for all auth endpoints.
 *   TO CHANGE TO FAIL-CLOSED: catch the unexpected error case in pgRateLimit() and
 *   return res.status(429) instead of calling next().
 *
 * Boot sequence: call initRateLimiters() once before app.listen() in app.js.
 * The function resolves even if individual limiters fail to initialize (fail-open).
 */

import { RateLimiterPostgres } from "rate-limiter-flexible";
import { pgPool } from "./pgPool.js";

// ─── Limiter factory ──────────────────────────────────────────────────────────

function makePgLimiter(opts) {
  return new Promise((resolve) => {
    const limiter = new RateLimiterPostgres(
      {
        storeClient:   pgPool,
        tableCreated:  true,                    // table created by Prisma migration 20260715200000
        tableName:     "rate_limit_counters",
        keyPrefix:     opts.keyPrefix,
        points:        opts.points,
        duration:      opts.duration,           // seconds
        blockDuration: opts.blockDuration ?? 0, // 0 = no separate block period (window expiry handles it)
      },
      (err) => {
        if (err) {
          // Non-fatal: boot continues -- this limiter will fail-open
          console.error(`[RateLimiter] Failed to initialize '${opts.keyPrefix}':`, err.message);
          resolve(null);
        } else {
          resolve(limiter);
        }
      }
    );
  });
}

// ─── Limiter instances (populated by initRateLimiters) ───────────────────────

export const limiters = {};

/**
 * Initialize all Postgres-backed limiters. Must be called once at startup
 * before any request is served. Resolves even if individual limiters fail.
 */
export async function initRateLimiters() {
  const [login, register, totp, sensitive, recovery, ai] = await Promise.all([
    // login: 10 attempts per IP per 15 minutes (login + passkey login)
    makePgLimiter({ keyPrefix: "login",     points: 10, duration: 15 * 60 }),
    // register: 3 registrations per IP per hour (skipSuccessful applied in middleware)
    makePgLimiter({ keyPrefix: "register",  points: 3,  duration: 60 * 60 }),
    // totp: 10 attempts per IP per 5 minutes
    makePgLimiter({ keyPrefix: "totp",      points: 10, duration:  5 * 60 }),
    // sensitive actions: 5 per IP per 15 minutes (passphrase, account delete, passkey remove)
    makePgLimiter({ keyPrefix: "sensitive", points: 5,  duration: 15 * 60 }),
    // recovery: 5 per IP per hour (recovery code redemption)
    makePgLimiter({ keyPrefix: "recovery",  points: 5,  duration: 60 * 60 }),
    // ai: 20 per IP per minute (public unauthenticated AI writing endpoints)
    makePgLimiter({ keyPrefix: "ai",        points: 20, duration:       60 }),
  ]);

  limiters.login     = login;
  limiters.register  = register;
  limiters.totp      = totp;
  limiters.sensitive = sensitive;
  limiters.recovery  = recovery;
  limiters.ai        = ai;

  const ok   = Object.entries(limiters).filter(([, v]) => v !== null).map(([k]) => k);
  const fail = Object.entries(limiters).filter(([, v]) => v === null).map(([k]) => k);

  console.log(`[RateLimiter] Postgres-backed limiters ready: ${ok.join(", ")}`);
  if (fail.length) {
    console.warn(`[RateLimiter] WARN: Failed to initialize (will fail-open): ${fail.join(", ")}`);
  }
}

// ─── User-facing error messages ───────────────────────────────────────────────

const MESSAGES = {
  login:     "Too many login attempts from this network. Try again later.",
  register:  "Too many registration attempts from this network. Try again in an hour.",
  totp:      "Too many TOTP attempts from this network. Try again later.",
  sensitive: "Too many sensitive action attempts from this network. Try again later.",
  recovery:  "Too many recovery attempts from this network. Try again in an hour.",
  ai:        "Too many AI requests from this network. Please slow down.",
};

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Returns an Express middleware that rate-limits by IP using a named Postgres limiter.
 *
 * FAIL-OPEN: if the limiter is unavailable or throws an unexpected error,
 * the request passes through with a warning log.
 *
 * Sets standard rate-limit response headers on 429:
 *   Retry-After: seconds until window resets
 *   X-RateLimit-Reset: epoch ms of window reset
 *
 * @param {"login"|"register"|"totp"|"sensitive"|"recovery"|"ai"} name
 * @param {object} [opts]
 * @param {boolean} [opts.skipSuccessful] if true, refund 1 point on 2xx response
 */
export function pgRateLimit(name, { skipSuccessful = false } = {}) {
  return async (req, res, next) => {
    const limiter = limiters[name];

    // FAIL-OPEN: limiter not initialized (init failed or initRateLimiters not yet called)
    if (!limiter) {
      console.warn(`[RateLimiter] '${name}' limiter unavailable -- failing open.`);
      return next();
    }

    const ip  = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${name}:${ip}`;

    try {
      const rateLimiterRes = await limiter.consume(key);

      // Attach remaining points header on success
      res.set("X-RateLimit-Remaining", String(rateLimiterRes.remainingPoints));

      if (skipSuccessful) {
        // Reward successful requests (2xx) by refunding 1 consumed point.
        // Used on registration: a successful signup should not count against the limit.
        res.on("finish", () => {
          if (res.statusCode < 400) {
            limiter.reward(key, 1).catch(() => {});
          }
        });
      }

      return next();
    } catch (err) {
      // rate-limiter-flexible throws a RateLimiterRes object when the limit is exceeded
      if (err?.msBeforeNext !== undefined) {
        const retryAfterSecs = Math.ceil(err.msBeforeNext / 1000);
        res.set("Retry-After",       String(retryAfterSecs));
        res.set("X-RateLimit-Reset", String(Date.now() + err.msBeforeNext));
        return res.status(429).json({
          error:      MESSAGES[name] ?? "Too many requests. Please try again later.",
          retryAfter: retryAfterSecs,
        });
      }

      // FAIL-OPEN: unexpected error (DB timeout, pool exhaustion, connection error)
      console.error(`[RateLimiter] '${name}' consume() unexpected error (failing open):`, err?.message ?? err);
      return next();
    }
  };
}
