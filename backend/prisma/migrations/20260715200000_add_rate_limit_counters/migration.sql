-- Migration: 20260715200000_add_rate_limit_counters
-- Creates the rate_limit_counters table used by rate-limiter-flexible (RateLimiterPostgres).
-- The driver manages counter upserts/reads; this migration owns the schema definition.
-- Rows expire based on the `expire` column (Unix epoch ms); stale rows cleaned up by retention cron.

CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
    "key"       TEXT        NOT NULL,
    "points"    INTEGER     NOT NULL DEFAULT 0,
    "expire"    BIGINT      NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT  "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

-- Index on expire for efficient TTL cleanup queries (run by retention cron every 10 minutes)
CREATE INDEX IF NOT EXISTS "rate_limit_counters_expire_idx" ON "rate_limit_counters" ("expire");

COMMENT ON TABLE "rate_limit_counters" IS
  'Postgres-backed rate limit counters. Rows with expire < now() are stale and cleaned up by the retention cron.';
