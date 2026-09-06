import crypto from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import prisma from "../config/prisma.js";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { isUserPremium } from "../services/subscription.service.js";
import { probeVideoDuration, extractVideoThumbnail } from "../utils/mediaProcessor.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm"
]);

const router = Router();

/**
 * GET /api/media/stream/:postId
 * Access-controlled short-lived signed streaming endpoint (15-minute expiry).
 * Supports ?thumb=true for video posters.
 * Security: no-store, private prevents CDN caching across moderation/block state changes.
 */
router.get("/stream/:postId", async (req, res) => {
  const { postId } = req.params;
  const isThumb = req.query.thumb === "true" || req.query.thumb === "1";

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: { id: true, isBanned: true }
        },
        media: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found." });
    }

    // Access check 1: Post must not be soft-deleted
    if (post.isDeleted) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Access check 2: Author must not be banned
    if (post.user?.isBanned) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Access check 3: Moderation check
    const activeModeration = await prisma.moderationLog.findFirst({
      where: { targetPostId: postId, actionTaken: "blocked" }
    });
    if (activeModeration) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Resolve target storage path
    let targetPath = isThumb
      ? (post.thumbStoragePath || post.media?.thumbnailPath)
      : (post.storagePath || post.media?.storagePath);

    if (!targetPath) {
      // If thumb requested but none exists, fall back to main storagePath if image
      if (isThumb && (post.storagePath || post.media?.storagePath)) {
        targetPath = post.storagePath || post.media?.storagePath;
      } else {
        return res.status(404).json({ error: "Media not found." });
      }
    }

    if (!supabase) {
      return res.status(500).json({ error: "Storage service is not configured." });
    }

    const bucketName = post.media?.bucket || env.SUPABASE_STORAGE_BUCKET || "veil-media";

    // Generate signed URL with 15-minute (900 seconds) expiry
    const { data: signedData, error: signError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(targetPath, 900);

    if (signError || !signedData?.signedUrl) {
      if (signError?.statusCode === "404" || signError?.status === 400 || signError?.message?.includes("not found")) {
        return res.status(404).json({ error: "Media file not found in storage." });
      }
      console.error(`[mediaStream] Failed to sign URL for ${targetPath}:`, signError);
      return res.status(500).json({ error: "Failed to generate stream ticket." });
    }

    // Security header: Ensure CDNs and proxies never cache this endpoint keyed on postId
    res.set("Cache-Control", "no-store, private");

    // 302 redirect for direct <video src="..." poster="..."> consumption
    return res.redirect(302, signedData.signedUrl);
  } catch (err) {
    console.error("[mediaStream] Error:", err);
    return res.status(500).json({ error: "Stream error." });
  }
});

/**
 * POST /api/media/upload-url
 * Generates a presigned upload URL for direct client-to-Supabase upload.
 * Client uploads raw video directly to Supabase Storage.
 * Frontend thumbnail upload is removed (thumbnails are generated server-side).
 */
router.post("/upload-url", requireAuth, async (req, res) => {
  const { filename, mimeType, sizeBytes } = req.body;
  const userId = req.user.id;

  if (!filename || !mimeType || !sizeBytes) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "filename, mimeType, and sizeBytes are required." });
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return res.status(415).json({
      error: "INVALID_MIME_TYPE",
      message: `File type '${mimeType}' is not supported.`
    });
  }

  try {
    const premium = await isUserPremium(userId);

    // Enforce user storage quota
    const totalUsed = await prisma.media.aggregate({
      where: { userId },
      _sum: { sizeBytes: true }
    });
    const usedBytes = totalUsed._sum.sizeBytes || 0;
    const quotaLimit = premium ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 10GB premium / 100MB free

    if (usedBytes + sizeBytes > quotaLimit) {
      return res.status(413).json({
        error: "STORAGE_QUOTA_EXCEEDED",
        message: `Upload exceeds your storage quota. Using ${(usedBytes / (1024 * 1024)).toFixed(2)} MB of ${(quotaLimit / (1024 * 1024)).toFixed(0)} MB quota.`
      });
    }

    const mediaId = crypto.randomUUID();
    const ext = path.extname(filename) || (mimeType.startsWith("video/") ? ".mp4" : ".webp");
    const bucketName = env.SUPABASE_STORAGE_BUCKET || "veil-media";
    const storagePath = `media/${userId}/${mediaId}${ext}`;

    if (!supabase) {
      return res.status(200).json({
        mediaId,
        storagePath,
        bucket: bucketName,
        isLocalFallback: true
      });
    }

    // Generate signed upload URL for media file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(storagePath);

    if (uploadError) {
      console.error("Failed to generate signed upload URL:", uploadError);
      return res.status(500).json({ error: "UPLOAD_URL_FAILED", message: uploadError.message });
    }

    return res.status(200).json({
      mediaId,
      storagePath,
      bucket: bucketName,
      signedUrl: uploadData.signedUrl,
      token: uploadData.token
    });
  } catch (err) {
    console.error("Upload URL generation failure:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: "Failed to initialize upload session." });
  }
});

/**
 * POST /api/media/confirm
 * Server-authoritative confirmation:
 * 1. Downloads uploaded file to inspect with ffprobe (server-authoritative duration enforcement).
 * 2. Extracts ~0.5s thumbnail frame using ffmpeg and uploads to thumbStoragePath.
 * 3. Never generates or persists public or long-lived URLs.
 */
router.post("/confirm", requireAuth, async (req, res) => {
  const {
    mediaId,
    storagePath,
    mimeType,
    sizeBytes
  } = req.body;
  const userId = req.user.id;

  if (!mediaId || !storagePath || !mimeType || !sizeBytes) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "mediaId, storagePath, mimeType, and sizeBytes are required." });
  }

  const isVideo = mimeType.startsWith("video/");
  const bucketName = env.SUPABASE_STORAGE_BUCKET || "veil-media";

  let tempVideoPath = null;
  let tempThumbPath = null;

  try {
    const premium = await isUserPremium(userId);
    let authoritativeDuration = null;
    let actualThumbnailPath = null;

    if (isVideo) {
      if (!supabase) {
        throw new Error("Supabase client unavailable for video validation.");
      }

      // Download uploaded video to temp file for ffprobe analysis and thumbnail extraction
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(storagePath);

      if (downloadError || !fileBlob) {
        console.error("Failed to download video from storage for validation:", downloadError);
        return res.status(500).json({
          error: "STORAGE_DOWNLOAD_FAILED",
          message: "Failed to retrieve uploaded video for security verification."
        });
      }

      const ext = path.extname(storagePath) || ".mp4";
      tempVideoPath = path.join(os.tmpdir(), `veil_upload_${mediaId}${ext}`);
      const arrayBuffer = await fileBlob.arrayBuffer();
      await fs.promises.writeFile(tempVideoPath, Buffer.from(arrayBuffer));

      // Task 4: Server-authoritative duration probe (fails closed)
      const probeResult = await probeVideoDuration(tempVideoPath, premium);
      if (!probeResult.valid) {
        // Delete rejected file from storage immediately
        await supabase.storage.from(bucketName).remove([storagePath]).catch(console.error);
        return res.status(probeResult.status || 400).json({
          error: probeResult.error,
          message: probeResult.message,
          maxSeconds: probeResult.maxSeconds
        });
      }

      authoritativeDuration = probeResult.durationSeconds;

      // Task 3: Server-side thumbnail extraction from video
      tempThumbPath = path.join(os.tmpdir(), `veil_thumb_${mediaId}.jpg`);
      const thumbSuccess = await extractVideoThumbnail(tempVideoPath, tempThumbPath);

      if (thumbSuccess && fs.existsSync(tempThumbPath)) {
        const thumbBuffer = await fs.promises.readFile(tempThumbPath);
        const thumbDestPath = `media/${userId}/${mediaId}_thumb.jpg`;
        const { error: thumbUploadError } = await supabase.storage
          .from(bucketName)
          .upload(thumbDestPath, thumbBuffer, {
            contentType: "image/jpeg",
            upsert: true
          });

        if (!thumbUploadError) {
          actualThumbnailPath = thumbDestPath;
        } else {
          console.warn("Failed to upload server-generated thumbnail:", thumbUploadError.message);
        }
      }
    }

    const expiresAt = (isVideo && !premium)
      ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days expiry for free videos
      : null;

    // Create database record
    const mediaRecord = await prisma.media.create({
      data: {
        id: mediaId,
        userId,
        type: isVideo ? "VIDEO" : "IMAGE",
        storagePath,
        thumbnailPath: actualThumbnailPath,
        bucket: bucketName,
        mimeType,
        sizeBytes: parseInt(sizeBytes, 10),
        durationSeconds: isVideo ? authoritativeDuration : null,
        wasPremiumUpload: premium,
        expiresAt
      }
    });

    // Clean up temporary local files
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      await fs.promises.unlink(tempVideoPath).catch(() => {});
    }
    if (tempThumbPath && fs.existsSync(tempThumbPath)) {
      await fs.promises.unlink(tempThumbPath).catch(() => {});
    }

    // Do NOT generate or return signed or public URLs here
    return res.status(201).json({
      success: true,
      mediaId: mediaRecord.id,
      storagePath,
      thumbStoragePath: actualThumbnailPath,
      type: mediaRecord.type
    });
  } catch (err) {
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      await fs.promises.unlink(tempVideoPath).catch(() => {});
    }
    if (tempThumbPath && fs.existsSync(tempThumbPath)) {
      await fs.promises.unlink(tempThumbPath).catch(() => {});
    }
    console.error("Media confirmation failure:", err);
    return res.status(500).json({ error: "CONFIRMATION_FAILED", message: err.message || "Failed to register media." });
  }
});

/**
 * DELETE /api/media/:mediaId
 * Securely deletes media from Supabase Storage and Postgres DB irreversibly.
 */
router.delete("/:mediaId", requireAuth, async (req, res) => {
  const { mediaId } = req.params;

  try {
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    });

    if (!media) {
      return res.status(404).json({ error: "Media not found." });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden. You do not own this media." });
    }

    if (!media.storagePath.startsWith("media/")) {
      await prisma.media.delete({ where: { id: mediaId } });
      return res.status(200).json({ success: true, message: "Media deleted successfully (local fallback)." });
    }

    if (!supabase) {
      return res.status(500).json({ error: "SUPABASE_UNAVAILABLE", message: "Storage service is not configured." });
    }

    const filesToDelete = [media.storagePath];
    if (media.thumbnailPath) {
      filesToDelete.push(media.thumbnailPath);
    }

    const { error: storageError } = await supabase.storage
      .from(media.bucket)
      .remove(filesToDelete);

    if (storageError) {
      console.error(`Failed to delete storage files for media ${mediaId}:`, storageError);
      return res.status(500).json({
        error: "STORAGE_DELETE_FAILED",
        message: "Failed to delete files from storage. Database record remains intact."
      });
    }

    await prisma.media.delete({ where: { id: mediaId } });

    return res.status(200).json({ success: true, message: "Media deleted successfully." });
  } catch (err) {
    console.error("Media delete error:", err);
    return res.status(500).json({ error: "DELETE_FAILED", message: "Failed to delete media." });
  }
});

export default router;
