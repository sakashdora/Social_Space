// Phase 0 Fix #2 & Phase 3 Fix #22: Centralized env loader imports and validates all required secrets at boot
import { env } from "./src/config/env.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./src/routes/auth.routes.js";
import totpRoutes from "./src/routes/totp.routes.js";
import passkeyRoutes from "./src/routes/passkey.routes.js";
import postsRoutes from "./src/routes/posts.routes.js";
import reactionsRoutes from "./src/routes/reactions.routes.js";
import aiRoutes from "./src/routes/ai.routes.js";
import rssRoutes from "./src/routes/rss.routes.js";
import { startRetentionCron } from "./src/services/cron.service.js";
import { initRateLimiters } from "./src/config/rateLimiters.js";
import chatsRoutes from "./src/routes/chats.routes.js";
import usersRoutes from "./src/routes/users.routes.js";
import mediaRoutes from "./src/routes/media.routes.js";
import cronRoutes from "./src/routes/cron.routes.js";
import prisma from "./src/config/prisma.js";

const app = express();

// Strip duplicate "/api" prefix if requests are double-prefixed (e.g. /api/api/...)
app.use((req, res, next) => {
  if (req.url.startsWith("/api/api/")) {
    req.url = req.url.substring(4);
  }
  next();
});

// Trust exactly 1 proxy hop — Azure Container Apps injects a single hop.
// Using `true` would trust all X-Forwarded-For hops, allowing IP spoofing to bypass rate limiters.
app.set("trust proxy", 1);

// ─── Universal Multi-Platform CORS Policy ─────────────────────────────────────
// Parse FRONTEND_ORIGIN as a comma-separated list.
// Automatically allows:
// 1. All Vercel preview and production subdomains (*.vercel.app)
// 2. Localhost and loopback IPs (http://localhost:*, http://127.0.0.1:*)
// 3. Explicitly configured origins (including wildcards like *.azurecontainerapps.io)
// 4. Same-host requests

const configuredOrigins = (env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

console.log("[cors] Configured allowed origins:", configuredOrigins);

export function isOriginAllowed(origin) {
  // Allow requests with no origin (same-origin, curl, server-to-server, mobile apps)
  if (!origin) return true;

  const norm = origin.trim().replace(/\/+$/, "").toLowerCase();

  // 1. Wildcard allow-all
  if (configuredOrigins.includes("*")) return true;

  // 2. Exact match against configured origins
  if (configuredOrigins.some((allowed) => allowed.toLowerCase() === norm)) {
    return true;
  }

  // 3. Automatically allow all Vercel deployment subdomains (*.vercel.app)
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(norm)) {
    return true;
  }

  // 4. Automatically allow local development servers (localhost / 127.0.0.1 on any port)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(norm)) {
    return true;
  }

  // 5. Wildcard pattern matching from configured origins (e.g. "https://*.azurecontainerapps.io")
  for (const pattern of configuredOrigins) {
    if (pattern.includes("*")) {
      const regexPattern = pattern
        .toLowerCase()
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[a-zA-Z0-9_-]+");
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(norm)) return true;
    }
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`[cors] Blocked origin: ${origin}`);
    // Standard CORS behavior: pass false to omit CORS headers without throwing a 500 error
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cache-Control",
    "X-CSRF-Token",
  ],
  exposedHeaders: ["Content-Disposition", "Content-Length", "X-Total-Count"],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── Phase 2 Fix #9: Global JSON body limit set to 100kb ─────────────────────
// The upload route uses multipart/form-data (multer) — NOT JSON — so it has its
// own 15MB limit scoped to that route. This global limit only covers JSON/urlencoded.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ limit: "100kb", extended: true }));

// ─── Phase 4 Fix #15: Conditional morgan logging ──────────────────────────────
// Use 'combined' (Apache-style) in production, 'dev' (colourised) in development
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── Base Health Check ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({ message: "Veil Shine Backend API is running!" });
});

// Production-ready health check endpoint (verifies database connectivity)
app.get("/healthz", async (req, res) => {
  try {
    // Run a basic raw query to check database responsiveness
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      services: {
        database: "UP"
      }
    });
  } catch (err) {
    console.error("Health check database failure:", err.message);
    return res.status(500).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      services: {
        database: "DOWN"
      },
      error: err.message
    });
  }
});

// ─── Mounted Routes ───────────────────────────────────────────────────────────
// Auth Routes
app.use("/v1/auth", authRoutes);
app.use("/api/v1/auth", authRoutes);

// TOTP Routes
app.use("/v1/auth/mfa/totp", totpRoutes);
app.use("/api/v1/auth/mfa/totp", totpRoutes);

// Passkey Routes
app.use("/v1/auth/passkeys", passkeyRoutes);
app.use("/api/v1/auth/passkeys", passkeyRoutes);

// Posts Routes
app.use("/v1/posts", postsRoutes);
app.use("/api/v1/posts", postsRoutes);

// Reactions Routes
app.use("/v1/reactions", reactionsRoutes);
app.use("/api/v1/reactions", reactionsRoutes);

// Chats Routes
app.use("/v1/chats", chatsRoutes);
app.use("/api/v1/chats", chatsRoutes);

// Users Routes
app.use("/v1/users", usersRoutes);
app.use("/api/v1/users", usersRoutes);

// AI Routes
app.use("/api", aiRoutes);
app.use("/ai", aiRoutes);

// RSS Routes
app.use("/api/rss", rssRoutes);
app.use("/rss", rssRoutes);

// Media Routes (canonical, secure upload + processing + deletion)
app.use("/api/media", mediaRoutes);
app.use("/media", mediaRoutes);

// Cron Routes (Vercel Cron target)
app.use("/api/cron", cronRoutes);
app.use("/cron", cronRoutes);

// ─── Global Error Handler (no stack trace leakage in production) ──────────────
app.use((err, req, res, next) => {
  // Fix B: JSON body parse errors are client errors (400), not server errors (500)
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }
  // Fix: Payload too large (body-parser limit exceeded) must return 413 not 500
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({ error: "Request body too large. Maximum allowed size is 100KB for JSON requests." });
  }
  // Surface CORS errors with a clear 403 instead of a 500
  if (err.message && err.message.startsWith("CORS:")) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = env.PORT || 3000;

// On Vercel Serverless Functions, process.env.VERCEL is set automatically.
// We skip starting the HTTP server listener and background cron interval loop.
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  // Initialize Postgres-backed rate limiters before accepting requests.
  // initRateLimiters resolves even if individual limiters fail (fail-open).
  initRateLimiters()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} [${env.NODE_ENV || "development"}]`);
        startRetentionCron();
      });
    })
    .catch((err) => {
      // Unexpected fatal error during init -- log but still start the server
      console.error("[boot] initRateLimiters fatal error:", err.message);
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} [${env.NODE_ENV || "development"}] (rate limiters unavailable -- fail-open)`);
        startRetentionCron();
      });
    });
}

export default app;
