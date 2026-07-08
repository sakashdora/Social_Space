/**
 * config/challengeStore.js
 *
 * Unified key-value store for short-lived challenge data (MFA challenges,
 * pending TOTP secrets, WebAuthn registration/authentication challenges).
 *
 * Strategy:
 *   - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured,
 *     uses Upstash Redis with native TTL — safe for multi-instance deployments.
 *   - Otherwise, falls back to an in-memory Map (single-instance dev only).
 *     A startup warning is printed so this is never silently used in production.
 *
 * API (same interface regardless of backend):
 *   await store.set(key, value, ttlSeconds)
 *   await store.get(key)           → value | null
 *   await store.del(key)
 *
 * Values are JSON-serialised for Redis compatibility.
 */

import { Redis } from "@upstash/redis";
import { env } from "./env.js";

// ─── Redis backend ─────────────────────────────────────────────────────────────

let redisClient = null;

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log("[challengeStore] Using Upstash Redis backend.");
} else {
  const warnPrefix = "[challengeStore] WARNING:";
  if (env.NODE_ENV === "production") {
    throw new Error(
      `${warnPrefix} UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production. ` +
      "In-memory challenge store is not safe for multi-instance deployments."
    );
  }
  console.warn(`${warnPrefix} UPSTASH_REDIS_REST_URL not configured — falling back to in-memory store.`);
  console.warn(`${warnPrefix} This is ONLY safe for single-instance local development.`);
}

// ─── In-memory fallback (dev only) ────────────────────────────────────────────

const memStore = new Map(); // key → { value, expiresAt }

function memSet(key, value, ttlSeconds) {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memDel(key) {
  memStore.delete(key);
}

// Prune expired in-memory entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memStore) {
    if (v.expiresAt < now) memStore.delete(k);
  }
}, 2 * 60 * 1000);

// ─── Unified store interface ───────────────────────────────────────────────────

export const store = {
  /**
   * Store a value with a TTL.
   * @param {string} key
   * @param {any} value  (will be JSON-serialised)
   * @param {number} ttlSeconds
   */
  async set(key, value, ttlSeconds) {
    if (redisClient) {
      // Upstash Redis: SET key value EX ttlSeconds
      await redisClient.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } else {
      memSet(key, value, ttlSeconds);
    }
  },

  /**
   * Retrieve a value. Returns null if missing or expired.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    if (redisClient) {
      const raw = await redisClient.get(key);
      if (raw === null || raw === undefined) return null;
      // Upstash client auto-parses JSON; if it's already an object, return directly
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } else {
      return memGet(key);
    }
  },

  /**
   * Delete a key (e.g., after a challenge is consumed).
   * @param {string} key
   */
  async del(key) {
    if (redisClient) {
      await redisClient.del(key);
    } else {
      memDel(key);
    }
  },
};
