/**
 * src/routes/media.routes.js
 *
 * Media upload, verification and delivery on Cloudflare R2.
 *
 * Upload flow (unchanged from the client's perspective):
 *   1. POST /api/media/upload-url  → reserves a Media row, returns a one-time signed upload URL
 *   2. PUT  <signedUrl>            → raw bytes, streamed to a staging key (token-authenticated)
 *   3. POST /api/media/confirm     → verifies magic bytes and size, strips metadata, publishes
 *
 * Verification runs inside the Worker: the real format is taken from magic bytes,
 * MP4/MOV duration is read from the file header, and images are re-encoded only
 * by removing metadata segments. Files whose format or duration cannot be verified
 * are rejected.
 */

import crypto from "node:crypto";
import { Router } from "../http/express-lite.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { pgRateLimit } from "../config/rateLimiters.js";
import prisma from "../config/prisma.js";
import { env } from "../config/env.js";
import { findVisiblePost, unexpired } from "../services/postPolicy.js";
import { verifyMediaTicket } from "../utils/mediaTickets.js";
import { signScopedToken, verifyScopedToken } from "../utils/jwt.js";
import { queueMediaDeletion, drainStorageDeletions } from "../services/storageCleanup.js";
import { putObject, getObject, headObject, deleteObject, isStorageConfigured } from "../services/storage.js";
import { sniffMediaType, stripImageMetadata, readMp4Duration, maxDurationSeconds } from "../utils/mediaProcessor.js";
import { safeWaitUntil } from "../utils/lifecycle.js";

const MAX_BYTES = 50 * 1024 * 1024;
const FREE_QUOTA_BYTES = 100 * 1024 ** 2;
const PREMIUM_QUOTA_BYTES = 10 * 1024 ** 3;
const UPLOAD_WINDOW_SECONDS = 2 * 3600;

// Declared MIME types accepted for post media. The sniffed container must match the declared kind.
const TYPES = {
  "image/jpeg": "IMAGE", "image/png": "IMAGE", "image/webp": "IMAGE", "image/gif": "IMAGE",
  "video/mp4": "VIDEO", "video/quicktime": "VIDEO", "video/webm": "VIDEO",
  "audio/ogg": "AUDIO", "audio/mp4": "AUDIO",
};

const router = Router();
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const result = (media) => ({ mediaId: media.id, type: media.type, success: true });

/** Streams an object with Range support and short-lived, non-cacheable headers. */
async function streamObject(req, res, key, { contentType, expiresAt } = {}) {
  const range = req.headers.range;
  const object = await getObject(key, range ? { range: new Headers({ Range: range }) } : {});
  if (!object) return res.status(404).json({ error: "Media unavailable." });

  const headers = {
    "Content-Type": contentType || object.httpMetadata?.contentType || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
  };
  if (expiresAt) headers["X-Expires-At"] = expiresAt.toISOString();

  if (range && object.range) {
    const start = object.range.offset ?? 0;
    const length = object.range.length ?? object.size - start;
    headers["Content-Range"] = `bytes ${start}-${start + length - 1}/${object.size}`;
    headers["Content-Length"] = String(length);
    return res.stream(206, headers, object.body);
  }
  headers["Content-Length"] = String(object.size);
  return res.stream(200, headers, object.body);
}

router.get("/stream/:postId", optionalAuth, route(async (req, res) => {
  const granted = verifyMediaTicket(String(req.query.ticket || ""), req.params.postId);
  const include = { media: true, owner: { select: { isBanned: true } } };
  const post = granted
    ? await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false, ...unexpired() }, include })
    : await findVisiblePost(req.params.postId, req.user?.id, { include });
  const media = post?.media;
  if (!post || post.owner?.isBanned || !media || media.status !== "ready" || (media.expiresAt && media.expiresAt <= new Date())) {
    return res.status(404).json({ error: "Media unavailable." });
  }
  const blocked = await prisma.moderationLog.findFirst({ where: { targetPostId: post.id, actionTaken: "blocked" }, select: { id: true } });
  if (blocked) return res.status(404).json({ error: "Media unavailable." });
  if (!isStorageConfigured()) return res.status(503).json({ error: "Storage is unavailable." });

  const key = req.query.thumb === "true" ? (media.thumbnailPath || media.storagePath) : media.storagePath;
  return streamObject(req, res, key, { contentType: media.mimeType, expiresAt: media.expiresAt });
}));

/**
 * Chat attachments: the client asks for a ticket, then loads the blob with it.
 * The ticket lives at most 60 seconds and never beyond the message expiry.
 */
router.get("/attachments/:mediaId", requireAuth, route(async (req, res) => {
  const media = await prisma.media.findFirst({
    where: {
      id: req.params.mediaId, purpose: "chat", status: "ready", ...unexpired(),
      thread: { participants: { some: { userId: req.user.id } } },
      message: { expiresAt: { gt: new Date() } },
    },
    include: { message: { select: { expiresAt: true } } },
  });
  if (!media) return res.status(404).json({ error: "Attachment unavailable." });
  if (!isStorageConfigured()) return res.status(503).json({ error: "Storage is unavailable." });
  const remaining = Math.floor((media.message.expiresAt.getTime() - Date.now()) / 1000);
  const ttl = Math.max(1, Math.min(60, remaining));
  const ticket = signScopedToken({ scope: "chat-media", mediaId: media.id }, { expiresInSeconds: ttl, audience: "media" });
  res.set("Cache-Control", "private, no-store");
  return res.json({ url: `${req.origin}/api/media/blob/${media.id}?ticket=${ticket}` });
}));

router.get("/blob/:mediaId", route(async (req, res) => {
  const grant = verifyScopedToken(String(req.query.ticket || ""), "media");
  if (!grant || grant.scope !== "chat-media" || grant.mediaId !== req.params.mediaId) {
    return res.status(404).json({ error: "Attachment unavailable." });
  }
  const media = await prisma.media.findFirst({
    where: { id: req.params.mediaId, purpose: "chat", status: "ready" },
    include: { message: { select: { expiresAt: true } } },
  });
  if (!media || !media.message || media.message.expiresAt <= new Date()) {
    return res.status(404).json({ error: "Attachment unavailable." });
  }
  if (!isStorageConfigured()) return res.status(503).json({ error: "Storage is unavailable." });
  return streamObject(req, res, media.storagePath, { contentType: "application/octet-stream", expiresAt: media.message.expiresAt });
}));

router.post("/upload-url", requireAuth, pgRateLimit("upload"), route(async (req, res) => {
  const { mimeType, sizeBytes, purpose = "post", threadId } = req.body;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) throw fail("File size must be between 1 byte and 50 MB.", 413);
  if (!["post", "chat"].includes(purpose)) throw fail("Invalid upload purpose.");
  if (purpose === "post" && !TYPES[mimeType]) throw fail("Unsupported media type.", 415);
  if (purpose === "chat" && mimeType !== "application/octet-stream") throw fail("Chat attachments must be encrypted before upload.");
  if (!isStorageConfigured()) throw fail("Storage is not configured.", 503);
  if (purpose === "chat" && (typeof threadId !== "string" || !await prisma.threadParticipant.findFirst({ where: { threadId, userId: req.user.id } }))) {
    throw fail("Conversation not found.", 403);
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const used = await prisma.media.aggregate({ where: { userId: req.user.id }, _sum: { sizeBytes: true } });
  const quota = user.isPremium ? PREMIUM_QUOTA_BYTES : FREE_QUOTA_BYTES;
  if ((used._sum.sizeBytes || 0) + sizeBytes > quota) throw fail("Storage quota exceeded.", 413);

  const id = crypto.randomUUID();
  const type = purpose === "chat" ? "FILE" : TYPES[mimeType];
  const uploadPath = `staging/${id}.bin`;
  const media = await prisma.media.create({ data: {
    id, userId: req.user.id, purpose, threadId: purpose === "chat" ? threadId : null,
    type, status: "pending", uploadPath, storagePath: `media/${id}`,
    thumbnailPath: null,
    uploadExpiresAt: new Date(Date.now() + UPLOAD_WINDOW_SECONDS * 1000),
    bucket: env.MEDIA_BUCKET_NAME,
    mimeType: purpose === "chat" ? "application/octet-stream" : mimeType,
    sizeBytes, wasPremiumUpload: user.isPremium,
    expiresAt: purpose === "chat" ? new Date(Date.now() + 86400000) : null,
  } });

  const token = signScopedToken(
    { scope: "upload", mediaId: media.id, userId: req.user.id, sizeBytes },
    { expiresInSeconds: UPLOAD_WINDOW_SECONDS, audience: "media" },
  );
  return res.json({ mediaId: id, signedUrl: `${req.origin}/api/media/upload/${id}?token=${token}` });
}));

/** Receives the raw bytes of an authorised upload. The token is the only credential. */
router.put("/upload/:mediaId", route(async (req, res) => {
  const grant = verifyScopedToken(String(req.query.token || ""), "media");
  if (!grant || grant.scope !== "upload" || grant.mediaId !== req.params.mediaId) throw fail("Upload authorization is invalid.", 403);
  const media = await prisma.media.findFirst({ where: { id: req.params.mediaId, userId: grant.userId, status: "pending" } });
  if (!media || !media.uploadExpiresAt || media.uploadExpiresAt <= new Date()) throw fail("Upload authorization expired.", 410);
  if (!isStorageConfigured()) throw fail("Storage is unavailable.", 503);

  const declared = Number(req.headers["content-length"] || 0);
  if (declared !== media.sizeBytes) throw fail("Content-Length does not match the authorised size.", 413);
  if (!req.raw.body) throw fail("Upload body is missing.", 400);

  await putObject(media.uploadPath, req.raw.body, { contentType: "application/octet-stream" });
  const stored = await headObject(media.uploadPath);
  if (!stored || stored.size !== media.sizeBytes) {
    if (stored) await deleteObject(media.uploadPath);
    throw fail("Uploaded size does not match the authorised size.", 413);
  }
  return res.status(201).json({ received: true });
}));

router.post("/confirm", requireAuth, route(async (req, res) => {
  const { mediaId } = req.body;
  if (typeof mediaId !== "string") throw fail("mediaId is required.");
  const media = await prisma.media.findFirst({ where: { id: mediaId, userId: req.user.id } });
  if (!media) throw fail("Upload not found.", 404);
  if (media.status === "ready") return res.json(result(media));
  if (!isStorageConfigured()) throw fail("Storage is unavailable.", 503);
  if (!media.uploadExpiresAt || media.uploadExpiresAt <= new Date()) throw fail("Upload authorization expired.", 410);

  const claimed = await prisma.media.updateMany({ where: { id: mediaId, userId: req.user.id, status: "pending" }, data: { status: "processing" } });
  if (!claimed.count) throw fail("Upload is already processing or has failed. Start a new upload.", 409);

  try {
    const staged = await getObject(media.uploadPath);
    if (!staged) throw fail("Uploaded object not found.", 400);
    if (staged.size !== media.sizeBytes) throw fail("Uploaded size does not match the authorised size.", 413);
    const bytes = new Uint8Array(await staged.arrayBuffer());

    const sniffed = sniffMediaType(bytes);
    const declaredKind = media.purpose === "chat" ? "FILE" : media.type;
    if (media.purpose === "post" && (!sniffed || sniffed.kind !== declaredKind)) {
      throw fail("Invalid or unsupported media. Please upload a valid file.", 422);
    }

    let body = bytes;
    let mimeType = media.mimeType;
    let extension = ".bin";
    let durationSeconds = null;

    if (media.purpose === "post" && sniffed.kind === "IMAGE") {
      // Metadata removal can only shrink or keep the size; it never adds decoded pixels.
      const stripped = stripImageMetadata(bytes, sniffed.mime);
      if (!stripped) throw fail("Invalid or unsupported media. Please upload a valid file.", 422);
      body = new Uint8Array(stripped);
      mimeType = sniffed.mime;
      extension = sniffed.ext;
    } else if (media.purpose === "post") {
      if (sniffed.mime !== "video/mp4" && sniffed.mime !== "video/quicktime" && sniffed.mime !== "audio/mp4") {
        // Duration cannot be verified for this container inside the Worker, so it is refused.
        throw fail("This video format cannot be verified. Upload MP4 or MOV.", 422);
      }
      durationSeconds = readMp4Duration(bytes);
      if (!durationSeconds || durationSeconds <= 0) {
        throw fail("Invalid or unsupported video file. Unable to verify duration.", 422);
      }
      const limit = maxDurationSeconds(media.wasPremiumUpload);
      if (durationSeconds > limit) throw fail("This clip exceeds the account duration limit.", 422);
      mimeType = sniffed.mime;
      extension = sniffed.ext;
    }

    const used = await prisma.media.aggregate({ where: { userId: req.user.id, id: { not: media.id } }, _sum: { sizeBytes: true } });
    const quota = media.wasPremiumUpload ? PREMIUM_QUOTA_BYTES : FREE_QUOTA_BYTES;
    if ((used._sum.sizeBytes || 0) + body.byteLength > quota) throw fail("Storage quota exceeded after processing.", 413);

    const storagePath = `media/${media.id}${extension}`;
    await putObject(storagePath, body, { contentType: mimeType });

    const ready = await prisma.media.update({ where: { id: media.id }, data: {
      status: "ready", storagePath, mimeType, sizeBytes: body.byteLength, durationSeconds,
      thumbnailPath: null, uploadPath: null, uploadExpiresAt: null,
      expiresAt: media.purpose === "chat" ? media.expiresAt : media.type === "VIDEO" && !media.wasPremiumUpload ? new Date(Date.now() + 10 * 86400000) : null,
    } });
    safeWaitUntil(deleteObject(media.uploadPath).catch(() => undefined));
    return res.status(201).json(result(ready));
  } catch (error) {
    await prisma.media.updateMany({ where: { id: media.id }, data: { status: "failed" } });
    if (error.status) throw error;
    console.error("Media verification failed:", error?.message);
    throw fail("Invalid or unsupported media. Please upload a valid file.", 422);
  }
}));

router.delete("/:mediaId", requireAuth, route(async (req, res) => {
  const media = await prisma.media.findFirst({ where: { id: req.params.mediaId, userId: req.user.id } });
  if (!media) throw fail("Media not found.", 404);
  if (media.status === "processing") throw fail("Upload is processing. Please retry shortly.", 409);
  await queueMediaDeletion(media);
  await prisma.media.delete({ where: { id: media.id } });
  safeWaitUntil(drainStorageDeletions());
  return res.json({ success: true, message: "Media removed; stored objects are queued for cleanup." });
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Media request failed:", error?.message);
  res.status(error.status || 500).json({ error: error.status ? error.message : "Media request failed." });
});

export default router;
