import { RateLimiterPostgres } from "rate-limiter-flexible";
import { pgPool } from "./pgPool.js";

export const limiters = {};
let initialization;
const definitions = {
  login: [10, 900], register: [3, 3600], totp: [10, 300],
  sensitive: [5, 900], recovery: [5, 3600], ai: [20, 60],
  upload: [30, 3600], social: [120, 60],
};

// Initialize on every runtime, including cold serverless requests.
export function initRateLimiters() {
  initialization ??= Promise.resolve().then(() => {
    for (const [name, [points, duration]] of Object.entries(definitions)) {
      limiters[name] = new RateLimiterPostgres({ storeClient: pgPool,
        tableCreated: true, tableName: "rate_limit_counters", keyPrefix: name,
        points, duration });
    }
  }).catch(error => { initialization = undefined; throw error; });
  return initialization;
}

export function pgRateLimit(name) {
  return async (req, res, next) => {
    try {
      await initRateLimiters();
      if (!limiters[name]) throw new Error("Unknown rate limiter");
      const result = await limiters[name].consume(req.user?.id || req.ip || req.socket?.remoteAddress || "unknown");
      res.set("X-RateLimit-Remaining", String(result.remainingPoints));
      return next();
    } catch (error) {
      if (Number.isFinite(error?.msBeforeNext)) {
        const retryAfter = Math.max(1, Math.ceil(error.msBeforeNext / 1000));
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({ error: "Too many requests. Please try again later.", retryAfter });
      }
      console.error("Rate limiter unavailable:", error.message);
      res.set("Retry-After", "5");
      return res.status(503).json({ error: "Request protection is temporarily unavailable. Please retry." });
    }
  };
}
