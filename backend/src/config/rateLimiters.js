/**
 * src/config/rateLimiters.js
 *
 * IP and account-scoped fixed-window rate limits stored in D1 (RateLimitCounter).
 * Limits are enforced per client IP (CF-Connecting-IP) or per authenticated user.
 * Failures are closed: if the counter store is unreachable the request gets 503.
 */

import prisma from "./prisma.js";

/** name -> [maxPoints, windowSeconds] */
export const LIMITS = {
  login: [10, 900],
  register: [3, 3600],
  totp: [10, 300],
  sensitive: [5, 900],
  recovery: [5, 3600],
  ai: [20, 60],
  upload: [30, 3600],
  social: [120, 60],
};

/**
 * Consumes one point for `key` under the named limit.
 * Throws `{ msBeforeNext }` when the limit is exhausted.
 *
 * @param {string} name
 * @param {string} key
 */
export async function consume(name, key) {
  const [maxPoints, windowSeconds] = LIMITS[name] ?? (() => { throw new Error("Unknown rate limiter"); })();
  const id = `${name}:${key}`;
  const now = Date.now();

  // Atomic increment while the current window is open and below the limit.
  const incremented = await prisma.rateLimitCounter.updateMany({
    where: { key: id, expire: { gt: BigInt(now) }, points: { lt: maxPoints } },
    data: { points: { increment: 1 } },
  });
  if (incremented.count === 1) return { remainingPoints: maxPoints - (await current(id)).points };

  const row = await prisma.rateLimitCounter.findUnique({ where: { key: id } });
  if (row && Number(row.expire) > now) {
    throw Object.assign(new Error("Rate limit exceeded"), { msBeforeNext: Number(row.expire) - now });
  }

  // Window expired or never existed: start a new one.
  const expire = BigInt(now + windowSeconds * 1000);
  await prisma.rateLimitCounter.upsert({
    where: { key: id },
    create: { key: id, points: 1, expire },
    update: { points: 1, expire },
  });
  return { remainingPoints: maxPoints - 1 };
}

async function current(id) {
  return (await prisma.rateLimitCounter.findUnique({ where: { key: id } })) ?? { points: 0 };
}

/** Express-style middleware factory. */
export function pgRateLimit(name) {
  return async (req, res, next) => {
    try {
      const key = req.user?.id || req.ip || "unknown";
      const result = await consume(name, key);
      res.set("X-RateLimit-Remaining", String(result.remainingPoints));
      return next();
    } catch (error) {
      if (Number.isFinite(error?.msBeforeNext)) {
        const retryAfter = Math.max(1, Math.ceil(error.msBeforeNext / 1000));
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({ error: "Too many requests. Please try again later.", retryAfter });
      }
      console.error("Rate limiter unavailable:", error?.message);
      res.set("Retry-After", "5");
      return res.status(503).json({ error: "Request protection is temporarily unavailable. Please retry." });
    }
  };
}

/** Removes expired counters. Called by the scheduled retention job. */
export async function purgeExpiredCounters(now = Date.now()) {
  const result = await prisma.rateLimitCounter.deleteMany({ where: { expire: { lt: BigInt(now) } } });
  return result.count;
}
