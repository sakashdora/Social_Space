/**
 * src/config/pgPool.js
 *
 * Dedicated pg.Pool exclusively for rate-limiter-flexible (RateLimiterPostgres).
 *
 * RateLimiterPostgres requires a raw pg.Pool -- Prisma exposes no public pool API.
 * This pool is intentionally separate from Prisma and must NEVER be used for
 * business logic queries.
 *
 * Connection budget (Supabase free tier: 15 pooler connections):
 *   Prisma runtime:       connection_limit=2 x 2 replicas = 4
 *   Rate limiter pool:    max=2             x 2 replicas = 4
 *   Total:                                                 8 / 15
 *
 * PgBouncer transaction mode requires:
 *   - No prepared statements (handled by rate-limiter-flexible internally)
 *   - statement_timeout as a safeguard (not a driver-level prepared-statement setting)
 */

import pg from "pg";
import { env } from "./env.js";

export const pgPool = new pg.Pool({
  connectionString:        env.DATABASE_URL,
  max:                     2,       // minimal footprint -- rate limiter use only
  idleTimeoutMillis:       30_000,  // release idle connections after 30s
  connectionTimeoutMillis: 3_000,   // fail fast if pool exhausted
  statement_timeout:       5_000,   // guard against slow counter queries
});

pgPool.on("error", (err) => {
  // Non-fatal: log but do not crash the process -- rate limiters will fail-open
  console.error("[pgPool/rateLimiter] Unexpected pool client error:", err.message);
});
