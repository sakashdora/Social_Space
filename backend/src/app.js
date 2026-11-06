/**
 * src/app.js
 *
 * HTTP application for the Cloudflare Worker: security headers, CORS, JSON body
 * parsing with a size cap, route mounting, and error handling.
 */

import { Router, createResponse, errorResponse } from "./http/express-lite.js";
import { env, loadRuntimeEnv, configuredOrigins, isProduction } from "./config/env.js";
import { setRuntime } from "./config/runtime.js";
import { setDatabase, db } from "./config/db.js";

import authRoutes from "./routes/auth.routes.js";
import totpRoutes from "./routes/totp.routes.js";
import passkeyRoutes from "./routes/passkey.routes.js";
import postsRoutes from "./routes/posts.routes.js";
import reactionsRoutes from "./routes/reactions.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import chatsRoutes from "./routes/chats.routes.js";
import usersRoutes from "./routes/users.routes.js";
import communityRoutes from "./routes/community.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import cronRoutes from "./routes/cron.routes.js";

const MAX_JSON_BYTES = 100 * 1024;
const REQUEST_TIMEOUT_MS = 25000;
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "private, no-store",
};

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** True when the browser origin is one of the configured frontend origins. */
export function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, "").toLowerCase();
  if (configuredOrigins().includes(normalized)) return true;
  return !isProduction() && LOCAL_ORIGIN.test(normalized);
}

function applyCors(res, origin) {
  res.set("Vary", "Origin");
  if (origin && isOriginAllowed(origin)) {
    res.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, Content-Range, X-RateLimit-Remaining, Retry-After",
      "Access-Control-Max-Age": "86400",
    });
  }
}

const app = Router();

// Global security headers and CORS are applied to every response, including errors.
app.use((req, res, next) => {
  res.set(SECURITY_HEADERS);
  applyCors(res, req.headers.origin);
  next();
});

app.get("/", (req, res) => res.json({ message: "Social Space API is running." }));

app.get("/healthz", async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: "OK", timestamp: new Date().toISOString(), services: { database: "UP" } });
  } catch (error) {
    console.error("Health check database failure:", error?.message);
    return res.status(500).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      services: { database: "DOWN" },
      error: "Database unavailable",
    });
  }
});

// Route groups keep the original /v1 and /api/v1 prefixes so existing clients keep working.
for (const prefix of ["/v1", "/api/v1"]) {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/auth/mfa/totp`, totpRoutes);
  app.use(`${prefix}/auth/passkeys`, passkeyRoutes);
  app.use(`${prefix}/posts`, postsRoutes);
  app.use(`${prefix}/reactions`, reactionsRoutes);
  app.use(`${prefix}/chats`, chatsRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/community`, communityRoutes);
}

app.use("/api", aiRoutes);
app.use("/ai", aiRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/cron", cronRoutes);

// Final error handler: never leaks stack traces or internal messages.
// Express-style error handlers are recognised by their four-argument signature.
app.use((error, req, res, _next) => {
  const [status, message] = errorResponse(error);
  if (status >= 500) console.error("Unhandled request error:", error?.name || "Error", error?.message || "");
  if (!res.headersSent) res.status(status).json({ error: message });
});

function buildRequest(request, url) {
  const headers = {};
  for (const [key, value] of request.headers) headers[key] = value;
  const query = {};
  for (const [key, value] of url.searchParams) {
    if (!(key in query)) query[key] = value;
  }
  return {
    method: request.method,
    path: url.pathname,
    query,
    headers,
    params: {},
    body: {},
    ip: request.headers.get("cf-connecting-ip") || "unknown",
    origin: url.origin,
    url: url.pathname + url.search,
    raw: request,
  };
}

function plainResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS },
  });
}

/**
 * Handles one Worker request.
 * @param {Request} request
 * @param {Record<string, unknown>} bindings Worker env (vars, secrets, D1, R2)
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, bindings, ctx) {
  try {
    loadRuntimeEnv(bindings);
    setRuntime(bindings, ctx);
    await setDatabase(bindings);
  } catch (error) {
    console.error("Worker configuration error:", error?.message);
    return plainResponse(500, "Service is misconfigured.");
  }

  const url = new URL(request.url);
  if (url.pathname.length > 512) return plainResponse(414, "URI too long.");

  const req = buildRequest(request, url);
  const res = createResponse();
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    res.set({
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-CSRF-Token",
    });
    res.set(SECURITY_HEADERS);
    applyCors(res, origin);
    return res.sendStatus(204).toResponse();
  }

  if (BODY_METHODS.has(request.method) && (request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > MAX_JSON_BYTES) return plainResponse(413, "Request body too large. Maximum allowed size is 100KB for JSON requests.");
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return plainResponse(413, "Request body too large. Maximum allowed size is 100KB for JSON requests.");
    if (text.trim().length > 0) {
      try {
        req.body = JSON.parse(text);
      } catch {
        return plainResponse(400, "Invalid JSON in request body.");
      }
    }
  }

  const done = (error) => {
    if (res.headersSent) return;
    if (error) {
      const [status, message] = errorResponse(error);
      res.status(status).json({ error: message });
    } else {
      res.status(404).json({ error: "Not found." });
    }
  };

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      if (!res.headersSent) res.status(504).json({ error: "The request timed out." });
      resolve();
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    app.handle(req, res, done);
  } catch (error) {
    done(error);
  }

  try {
    await Promise.race([res.finished, timeout]);
  } finally {
    clearTimeout(timer);
  }
  return res.toResponse();
}

export default app;
