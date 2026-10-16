import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import sharp from "sharp";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { pgRateLimit } from "../config/rateLimiters.js";
import prisma from "../config/prisma.js";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { probeVideoDuration, extractVideoThumbnail, stripClipMetadata } from "../utils/mediaProcessor.js";
import { findVisiblePost, unexpired } from "../services/postPolicy.js";
import { verifyMediaTicket } from "../utils/mediaTickets.js";
import { queueMediaDeletion, drainStorageDeletions } from "../services/storageCleanup.js";
import { safeWaitUntil } from "../utils/lifecycle.js";

const MAX_BYTES = 50 * 1024 * 1024;
const TYPES = {
  "image/jpeg": ["IMAGE", ".jpg"], "image/png": ["IMAGE", ".png"], "image/webp": ["IMAGE", ".webp"],
  "image/gif": ["IMAGE", ".gif"], "video/mp4": ["VIDEO", ".mp4"], "video/quicktime": ["VIDEO", ".mov"],
  "video/webm": ["VIDEO", ".webm"], "audio/webm": ["AUDIO", ".webm"], "audio/ogg": ["AUDIO", ".ogg"],
  "audio/mp4": ["AUDIO", ".m4a"],
};
const router = Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const result = media => ({ mediaId: media.id, type: media.type, success: true });

router.get("/stream/:postId", optionalAuth, route(async (req, res) => {
  const granted = verifyMediaTicket(String(req.query.ticket || ""), req.params.postId);
  const post = granted
    ? await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false, ...unexpired() }, include: { media: true, owner: { select: { isBanned: true } } } })
    : await findVisiblePost(req.params.postId, req.user?.id, { include: { media: true, owner: { select: { isBanned: true } } } });
  const media = post?.media;
  if (!post || post.owner?.isBanned || !media || media.status !== "ready" || (media.expiresAt && media.expiresAt <= new Date())) return res.status(404).json({ error: "Media unavailable." });
  const blocked = await prisma.moderationLog.findFirst({ where: { targetPostId: post.id, actionTaken: "blocked" }, select: { id: true } });
  if (blocked) return res.status(404).json({ error: "Media unavailable." });
  const target = req.query.thumb === "true" ? (media.thumbnailPath || media.storagePath) : media.storagePath;
  if (!supabase) return res.status(503).json({ error: "Storage is unavailable." });
  const expires = Math.max(1, Math.min(60, post.expiresAt ? Math.floor((post.expiresAt.getTime() - Date.now()) / 1000) : 60, media.expiresAt ? Math.floor((media.expiresAt.getTime() - Date.now()) / 1000) : 60));
  const { data, error } = await supabase.storage.from(media.bucket).createSignedUrl(target, expires);
  if (error || !data?.signedUrl) return res.status(502).json({ error: "Media is temporarily unavailable." });
  res.set("Cache-Control", "private, no-store");
  // Legacy keys contain an account UUID. Proxy those objects without disclosing
  // their storage URL; newly finalized object names contain only random IDs.
  if (target.split("/").length > 2) {
    const upstream = await fetch(data.signedUrl, { headers: req.headers.range ? { Range: req.headers.range } : {}, signal: AbortSignal.timeout(30000) });
    res.status(upstream.status);
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key); if (value) res.set(key, value);
    }
    if (!upstream.body) return res.end();
    await pipeline(Readable.fromWeb(upstream.body), res);
    return;
  }
  return res.redirect(302, data.signedUrl);
}));

router.get("/attachments/:mediaId", requireAuth, route(async (req, res) => {
  const media = await prisma.media.findFirst({ where: {
    id: req.params.mediaId, purpose: "chat", status: "ready", ...unexpired(),
    thread: { participants: { some: { userId: req.user.id } } },
    message: { expiresAt: { gt: new Date() } },
  }, include: { message: { select: { expiresAt: true } } } });
  if (!media) return res.status(404).json({ error: "Attachment unavailable." });
  if (!supabase) return res.status(503).json({ error: "Storage is unavailable." });
  const { data, error } = await supabase.storage.from(media.bucket).createSignedUrl(media.storagePath, Math.max(1, Math.min(60, Math.floor((media.message.expiresAt.getTime() - Date.now()) / 1000))));
  if (error) throw error;
  res.set("Cache-Control", "private, no-store");
  return res.json({ url: data.signedUrl });
}));

router.post("/upload-url", requireAuth, pgRateLimit("upload"), route(async (req, res) => {
  const { mimeType, sizeBytes, purpose = "post", threadId } = req.body;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) throw fail("File size must be between 1 byte and 50 MB.", 413);
  if (!["post", "chat"].includes(purpose)) throw fail("Invalid upload purpose.");
  if (purpose === "post" && !TYPES[mimeType]) throw fail("Unsupported media type.", 415);
  if (purpose === "chat" && mimeType !== "application/octet-stream") throw fail("Chat attachments must be encrypted before upload.");
  if (!supabase) throw fail("Storage is not configured.", 503);
  if (purpose === "chat" && (typeof threadId !== "string" || !await prisma.threadParticipant.findFirst({ where: { threadId, userId: req.user.id } }))) throw fail("Conversation not found.", 403);
  const id = crypto.randomUUID();
  const extension = purpose === "chat" ? ".bin" : TYPES[mimeType][1];
  const uploadPath = "staging/" + id + extension;
  const media = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${req.user.id} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: req.user.id } });
    const used = await tx.media.aggregate({ where: { userId: req.user.id }, _sum: { sizeBytes: true } });
    const quota = user.isPremium ? 10 * 1024 ** 3 : 100 * 1024 ** 2;
    if ((used._sum.sizeBytes || 0) + sizeBytes > quota) throw fail("Storage quota exceeded.", 413);
    return tx.media.create({ data: {
      id, userId: req.user.id, purpose, threadId: purpose === "chat" ? threadId : null,
      type: purpose === "chat" ? "FILE" : TYPES[mimeType][0],
      status: "pending", uploadPath, storagePath: "media/" + id + (purpose === "post" && TYPES[mimeType][0] === "IMAGE" ? ".webp" : extension),
      thumbnailPath: purpose === "post" && TYPES[mimeType][0] === "VIDEO" ? "media/" + id + "_thumb.jpg" : null,
      uploadExpiresAt: new Date(Date.now() + 2 * 3600000), bucket: env.SUPABASE_STORAGE_BUCKET,
      mimeType, sizeBytes, wasPremiumUpload: user.isPremium,
      expiresAt: purpose === "chat" ? new Date(Date.now() + 86400000) : null,
    } });
  });
  const { data, error } = await supabase.storage.from(media.bucket).createSignedUploadUrl(uploadPath);
  if (error || !data?.signedUrl) throw fail("Could not initialize storage upload.", 502);
  return res.json({ mediaId: id, signedUrl: data.signedUrl });
}));

router.post("/confirm", requireAuth, route(async (req, res) => {
  const { mediaId } = req.body;
  if (typeof mediaId !== "string") throw fail("mediaId is required.");
  const media = await prisma.media.findFirst({ where: { id: mediaId, userId: req.user.id } });
  if (!media) throw fail("Upload not found.", 404);
  if (media.status === "ready") return res.json(result(media));
  if (!supabase) throw fail("Storage is unavailable.", 503);
  if (!media.uploadExpiresAt || media.uploadExpiresAt <= new Date()) throw fail("Upload authorization expired.", 410);
  const claimed = await prisma.media.updateMany({ where: { id: mediaId, userId: req.user.id, status: "pending" }, data: { status: "processing" } });
  if (!claimed.count) throw fail("Upload is already processing or has failed. Start a new upload.", 409);
  const bucket = supabase.storage.from(media.bucket);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "veil-media-"));
  try {
    const info = await bucket.info(media.uploadPath);
    if (info.error) throw fail("Uploaded object not found.", 400);
    const storedSize = Number(info.data?.size ?? info.data?.metadata?.size);
    if (!Number.isSafeInteger(storedSize) || storedSize !== media.sizeBytes || storedSize > MAX_BYTES) throw fail("Uploaded size does not match the authorized size.", 413);
    const download = await bucket.download(media.uploadPath);
    if (download.error || !download.data) throw fail("Cannot inspect uploaded object.", 502);
    if (download.data.size !== media.sizeBytes) throw fail("Uploaded size changed.", 413);
    let buffer = Buffer.from(await download.data.arrayBuffer());
    let storagePath = media.storagePath, mimeType = media.mimeType, durationSeconds = null, thumbnailPath = null;
    if (media.type === "IMAGE") {
      // Decode actual bytes, reject invalid formats, strip EXIF/GPS, and bound decoded pixels.
      buffer = await sharp(buffer, { limitInputPixels: 40000000, animated: false }).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      storagePath = "media/" + media.id + ".webp";
      mimeType = "image/webp";
    } else if (media.type === "VIDEO" || media.type === "AUDIO") {
      const source = path.join(tempDir, "source" + path.extname(media.uploadPath));
      await fs.writeFile(source, buffer);
      const probe = await probeVideoDuration(source, media.wasPremiumUpload, media.type === "AUDIO");
      if (!probe.valid) throw fail(probe.message, probe.status || 400);
      durationSeconds = probe.durationSeconds;
      const sanitized = path.join(tempDir, "sanitized" + path.extname(media.uploadPath));
      await stripClipMetadata(source, sanitized);
      buffer = await fs.readFile(sanitized);
      if (media.type === "VIDEO") {
        const thumbnail = path.join(tempDir, "thumb.jpg");
        if (!await extractVideoThumbnail(source, thumbnail)) throw fail("Could not generate a video preview.", 422);
        thumbnailPath = "media/" + media.id + "_thumb.jpg";
        const uploaded = await bucket.upload(thumbnailPath, await fs.readFile(thumbnail), { contentType: "image/jpeg", upsert: false });
        if (uploaded.error) throw fail("Could not save video preview.", 502);
      }
    }
    if (buffer.length > media.sizeBytes && buffer.length > MAX_BYTES) throw fail("Processed file is too large.", 413);
    const saved = await bucket.upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (saved.error) throw fail("Could not save verified media.", 502);
    const ready = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${req.user.id} FOR UPDATE`;
      const used = await tx.media.aggregate({ where: { userId: req.user.id, id: { not: media.id } }, _sum: { sizeBytes: true } });
      const quota = media.wasPremiumUpload ? 10 * 1024 ** 3 : 100 * 1024 ** 2;
      if ((used._sum.sizeBytes || 0) + buffer.length > quota) throw fail("Storage quota exceeded after processing.", 413);
      return tx.media.update({ where: { id: media.id }, data: {
        status: "ready", storagePath, mimeType, sizeBytes: buffer.length, durationSeconds, thumbnailPath,
        expiresAt: media.purpose === "chat" ? media.expiresAt : media.type === "VIDEO" && !media.wasPremiumUpload ? new Date(Date.now() + 10 * 86400000) : null,
      } });
    });
    // Upload tickets can still write to staging for two hours. Cleanup retains
    // that staging reference until the ticket expires, preventing orphan uploads.
    return res.status(201).json(result(ready));
  } catch (error) {
    await prisma.media.updateMany({ where: { id: media.id }, data: { status: "failed" } });
    throw error.status ? error : fail("Invalid or unsupported media. Please upload a valid file.", 422);
  } finally {
    if (path.dirname(path.resolve(tempDir)) !== path.resolve(os.tmpdir()) || !path.basename(tempDir).startsWith("veil-media-")) throw new Error("Unexpected media scratch path");
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}));

router.delete("/:mediaId", requireAuth, route(async (req, res) => {
  const deleted = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Media" WHERE id = ${req.params.mediaId} FOR UPDATE`;
    const media = await tx.media.findFirst({ where: { id: req.params.mediaId, userId: req.user.id } });
    if (!media) return false;
    if (media.status === "processing") throw fail("Upload is processing. Please retry shortly.", 409);
    await queueMediaDeletion(tx, media);
    await tx.media.delete({ where: { id: media.id } });
    return true;
  });
  if (!deleted) throw fail("Media not found.", 404);
  safeWaitUntil(drainStorageDeletions());
  return res.json({ success: true, message: "Media removed; stored objects are queued for cleanup." });
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Media request failed:", error.message);
  res.status(error.status || 500).json({ error: error.status ? error.message : "Media request failed." });
});
export default router;
