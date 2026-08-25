import crypto from "crypto";
import path from "path";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import prisma from "../config/prisma.js";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { isUserPremium } from "../services/subscription.service.js";
import { validateVideoDuration } from "../utils/mediaProcessor.js";

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
 * POST /api/media/upload-url
 * Generates a presigned upload URL for direct client-to-Supabase upload.
 * Bypasses Vercel serverless function request body limits and timeouts.
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
    const isVideo = mimeType.startsWith("video/");
    const thumbnailPath = isVideo ? `media/${userId}/${mediaId}_thumb.jpg` : null;

    if (!supabase) {
      // Local development fallback mode
      return res.status(200).json({
        mediaId,
        storagePath,
        thumbnailPath,
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

    // Generate signed upload URL for thumbnail if video
    let thumbUploadUrl = null;
    if (isVideo && thumbnailPath) {
      const { data: thumbData } = await supabase.storage
        .from(bucketName)
        .createSignedUploadUrl(thumbnailPath);
      thumbUploadUrl = thumbData?.signedUrl || null;
    }

    return res.status(200).json({
      mediaId,
      storagePath,
      thumbnailPath,
      bucket: bucketName,
      signedUrl: uploadData.signedUrl,
      token: uploadData.token,
      thumbUploadUrl
    });
  } catch (err) {
    console.error("Upload URL generation failure:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: "Failed to initialize upload session." });
  }
});

/**
 * POST /api/media/confirm
 * Registers media metadata in database after direct upload to Supabase completes.
 */
router.post("/confirm", requireAuth, async (req, res) => {
  const {
    mediaId,
    storagePath,
    thumbnailPath,
    mimeType,
    sizeBytes,
    durationSeconds
  } = req.body;
  const userId = req.user.id;

  if (!mediaId || !storagePath || !mimeType || !sizeBytes) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "mediaId, storagePath, mimeType, and sizeBytes are required." });
  }

  const isVideo = mimeType.startsWith("video/");

  try {
    const premium = await isUserPremium(userId);

    // Validate video duration for free accounts
    if (isVideo) {
      const durationValidation = validateVideoDuration(durationSeconds, premium);
      if (!durationValidation.valid) {
        return res.status(durationValidation.status || 400).json({
          error: durationValidation.error,
          message: durationValidation.message,
          maxSeconds: durationValidation.maxSeconds
        });
      }
    }

    const bucketName = env.SUPABASE_STORAGE_BUCKET || "veil-media";
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
        thumbnailPath: thumbnailPath || null,
        bucket: bucketName,
        mimeType,
        sizeBytes: parseInt(sizeBytes, 10),
        durationSeconds: isVideo ? parseFloat(durationSeconds) : null,
        wasPremiumUpload: premium,
        expiresAt
      }
    });

    // Generate signed download URL for client viewing
    let signedUrl = storagePath;
    if (supabase && storagePath.startsWith("media/")) {
      const { data: signedData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storagePath, 3600);
      signedUrl = signedData?.signedUrl || storagePath;
    }

    return res.status(201).json({
      media: mediaRecord,
      url: signedUrl
    });
  } catch (err) {
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
