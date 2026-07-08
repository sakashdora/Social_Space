/**
 * upload.routes.js
 *
 * Phase 2 Fix #6: requireAuth added — unauthenticated uploads now return 401.
 * Phase 2 Fix #7: MIME allowlist added — only approved image/video types accepted.
 *
 * Note to reviewer: the global express.json() limit is 100kb (set in app.js),
 * but this route uses multipart/form-data via multer — the 15MB fileSize limit
 * here is scoped to multer only and does NOT affect the JSON limit.
 *
 * Frontend token: the frontend already sends Authorization: Bearer <token> on all
 * authenticated API calls (confirmed via frontend/src/lib/api.ts). No frontend
 * changes needed for this fix.
 */

import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";

// ─── MIME allowlist ────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB — scoped to this multer instance only
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(
      Object.assign(new Error(`File type '${file.mimetype}' is not allowed.`), {
        code: "INVALID_MIME_TYPE",
        status: 415,
      }),
      false
    );
  },
});

const router = Router();

// Phase 2 Fix #6: requireAuth before multer — unauthenticated requests fail fast
// before any file bytes are processed.
router.post("/", requireAuth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided." });
    }
    // For local dev, return a base64 data URL.
    // PRODUCTION: replace with S3/GCS/Cloudflare R2 upload and return a public URL.
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const mimeType = req.file.mimetype;
    const url = `data:${mimeType};base64,${b64}`;

    return res.status(200).json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed." });
  }
});

// Multer error handler — catches MIME rejection and file-size errors
router.use((err, req, res, next) => {
  if (err.code === "INVALID_MIME_TYPE") {
    return res.status(415).json({ error: err.message });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File exceeds the 15 MB size limit." });
  }
  next(err);
});

export default router;
