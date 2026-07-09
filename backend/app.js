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
import uploadRoutes from "./src/routes/upload.routes.js";
import { startRetentionCron } from "./src/services/cron.service.js";
import chatsRoutes from "./src/routes/chats.routes.js";
import usersRoutes from "./src/routes/users.routes.js";
import mediaRoutes from "./src/routes/media.routes.js";
import prisma from "./src/config/prisma.js";

const app = express();

// Trust the first proxy — required for accurate IP in rate limiting behind Nginx / Supabase edge
app.set("trust proxy", 1);

// ─── Phase 2 Fix #8: Explicit CORS allowlist ──────────────────────────────────
// Parse FRONTEND_ORIGIN as a comma-separated list (supports staging + prod simultaneously)
const allowedOrigins = (env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, curl in dev, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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
app.use("/v1/auth", authRoutes);
app.use("/v1/auth/mfa/totp", totpRoutes);
app.use("/v1/auth/passkeys", passkeyRoutes);
app.use("/v1/posts", postsRoutes);
app.use("/v1/reactions", reactionsRoutes);
app.use("/v1/chats", chatsRoutes);
app.use("/v1/users", usersRoutes);
app.use("/api", aiRoutes);
app.use("/api/rss", rssRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/media", mediaRoutes);

// ─── Global Error Handler (no stack trace leakage in production) ──────────────
app.use((err, req, res, next) => {
  // Surface CORS errors with a clear 403 instead of a 500
  if (err.message && err.message.startsWith("CORS:")) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = env.PORT || 3000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${env.NODE_ENV || "development"}]`);
    startRetentionCron();
  });
}

export default app;
