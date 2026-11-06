/**
 * Test harness for the Worker application. Runs the real request pipeline
 * (handleRequest) against a local SQLite database and an in-memory R2 stand-in.
 */

import crypto from "node:crypto";
import { handleRequest } from "../app.js";
import { generateToken } from "../utils/jwt.js";
import { getClient } from "../config/db.js";

/** Creates an R2-like bucket that honours the subset of the API the Worker uses. */
export function createMemoryBucket() {
  const objects = new Map();
  const toBytes = async (value) => {
    if (value instanceof ReadableStream) return new Uint8Array(await new Response(value).arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return new Uint8Array(value.buffer ?? value);
  };
  return {
    objects,
    async put(key, value, options = {}) {
      const bytes = await toBytes(value);
      objects.set(key, { bytes, contentType: options.httpMetadata?.contentType || "application/octet-stream" });
      return { key, size: bytes.length };
    },
    async get(key, options = {}) {
      const entry = objects.get(key);
      if (!entry) return null;
      let slice = entry.bytes;
      let range;
      const rangeHeader = options.range?.get?.("range");
      if (rangeHeader) {
        const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : entry.bytes.length - 1;
        slice = entry.bytes.subarray(start, end + 1);
        range = { offset: start, length: slice.length };
      }
      const copy = new Uint8Array(slice);
      return {
        size: entry.bytes.length,
        range,
        httpMetadata: { contentType: entry.contentType },
        body: new Response(copy).body,
        arrayBuffer: async () => copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
      };
    },
    async head(key) {
      const entry = objects.get(key);
      return entry ? { key, size: entry.bytes.length } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

export const TEST_FRONTEND = "http://localhost:5173";

export function createBindings(dbUrl) {
  return {
    TEST_SQLITE_URL: dbUrl,
    NODE_ENV: "test",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
    RECOVERY_CODE_SECRET: crypto.randomBytes(32).toString("hex"),
    CRON_SECRET: crypto.randomBytes(32).toString("hex"),
    FRONTEND_ORIGIN: TEST_FRONTEND,
    MODERATOR_HANDLES: "moderator",
    MEDIA: createMemoryBucket(),
  };
}

let counter = 0;
/** Each request gets its own client IP so per-IP limits do not leak between tests. */
export function nextIp() {
  counter += 1;
  return `10.0.${Math.floor(counter / 250)}.${counter % 250}`;
}

/**
 * Sends a request through the Worker pipeline.
 * @param {ReturnType<typeof createBindings>} bindings
 */
export async function call(bindings, method, path, { body, token, headers = {}, rawBody, ip } = {}) {
  const init = {
    method,
    headers: {
      origin: TEST_FRONTEND,
      "cf-connecting-ip": ip || nextIp(),
      ...headers,
    },
  };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (rawBody !== undefined) {
    init.body = rawBody;
  } else if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await handleRequest(new Request(`https://api.test${path}`, init), bindings, {
    waitUntil() {},
    passThroughOnException() {},
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text, headers: response.headers };
}

/** Seeds a user directly in the database and returns it with a valid session token. */
export async function seedUser(prefix = "user") {
  const db = await getClient({ TEST_SQLITE_URL: process.env.VEIL_TEST_DB_URL });
  const handle = `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
  const user = await db.user.create({ data: { handle, recoveryHash: "test-only" } });
  return { ...user, token: generateToken(user.id, user.tokenVersion) };
}

export function dbClient() {
  return getClient({ TEST_SQLITE_URL: process.env.VEIL_TEST_DB_URL });
}
