import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import prisma from "../config/prisma.js";
import { supabase } from "../config/supabase.js";
import { isUserPremium } from "../services/subscription.service.js";
import { runFaceAnonymization } from "../services/anonymization.service.js";
import {
  getVideoDuration,
  compressImage,
  transcodeVideo,
  extractVideoThumbnail
} from "../utils/mediaProcessor.js";

// Ensure local temporary directory exists for processing uploads
const tempDir = path.join(process.cwd(), "tmp", "uploads");
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `raw-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm"
]);

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limits (larger to accommodate videos)
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(
      Object.assign(new Error(`File type '${file.mimetype}' is not allowed.`), {
        code: "INVALID_MIME_TYPE",
        status: 415
      }),
      false
    );
  }
});

const router = Router();

/**
 * POST /api/media/upload
 * Securely uploads and optimizes media. Free videos capped at 30 seconds and expire after 10 days.
 */
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided." });
  }

  const rawFilePath = req.file.path;

  // Verify magic bytes (prevent MIME spoofing)
  let isMagicValid = false;
  try {
    const fd = fs.openSync(rawFilePath, "r");
    const sigBuffer = Buffer.alloc(12);
    fs.readSync(fd, sigBuffer, 0, 12, 0);
    fs.closeSync(fd);
    
    const hex = sigBuffer.toString("hex").toUpperCase();
    const mimeType = req.file.mimetype;
    
    if (mimeType === "image/jpeg") {
      isMagicValid = hex.startsWith("FFD8FF");
    } else if (mimeType === "image/png") {
      isMagicValid = hex.startsWith("89504E470D0A1A0A");
    } else if (mimeType === "image/gif") {
      isMagicValid = hex.startsWith("474946383761") || hex.startsWith("474946383961");
    } else if (mimeType === "image/webp") {
      isMagicValid = hex.startsWith("52494646") && hex.substring(16, 24) === "57454250";
    } else if (mimeType === "video/mp4") {
      isMagicValid = hex.substring(8, 16) === "66747970";
    } else if (mimeType === "image/heic") {
      isMagicValid = hex.substring(8, 24) === "6674797068656963" || hex.substring(8, 24) === "667479706D534631";
    } else if (mimeType === "video/quicktime") {
      isMagicValid = hex.substring(8, 20) === "667479707174" || hex.startsWith("00000014667479707174");
    } else if (mimeType === "video/webm") {
      isMagicValid = hex.startsWith("1A45DFA3");
    }
  } catch (err) {
    console.error("Magic bytes read error:", err);
    isMagicValid = false;
  }

  if (!isMagicValid) {
    try {
      fs.unlinkSync(rawFilePath);
    } catch {}
    return res.status(415).json({
      error: "INVALID_FILE_SIGNATURE",
      message: `File content verification failed. The file signature does not match mimetype '${req.file.mimetype}'.`
    });
  }

  const isVideo = req.file.mimetype.startsWith("video/");
  const userId = req.user.id;
  const mediaId = crypto.randomUUID(); // Node global crypto is available
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "staging";
  
  let processedFilePath = null;
  let localThumbPath = null;

  try {
    // 1. Determine subscription status
    const premium = await isUserPremium(userId);

    // 2. Process based on media type
    let duration = null;
    let storagePath = "";
    let thumbnailPath = null;
    let finalMimeType = "";

    if (isVideo) {
      // 2a. Server-side validation of video duration using ffprobe
      try {
        duration = await getVideoDuration(rawFilePath);
      } catch (err) {
        return res.status(400).json({ error: "INVALID_VIDEO", message: "Failed to parse video metadata." });
      }

      if (!premium && duration > 30) {
        return res.status(413).json({
          error: "VIDEO_TOO_LONG",
          message: "Free accounts are limited to 30-second videos. Upgrade to premium for unlimited length.",
          maxSeconds: 30
        });
      }

      // 2b. Transcode video (720p H.264 CRF 28)
      const transcodeSuffix = `${Date.now()}-${mediaId}.mp4`;
      processedFilePath = path.join(tempDir, `processed-${transcodeSuffix}`);
      await transcodeVideo(rawFilePath, processedFilePath);
      finalMimeType = "video/mp4";
      storagePath = `media/${userId}/${mediaId}.mp4`;

      // 2c. Extract video thumbnail frame (poster) at 1s
      const thumbFilename = `thumb-${mediaId}.jpg`;
      localThumbPath = await extractVideoThumbnail(processedFilePath, tempDir, thumbFilename);
      thumbnailPath = `media/${userId}/${mediaId}_thumb.jpg`;
    } else {
      // 2d. Compress image (max 1600px WebP)
      const imageSuffix = `${Date.now()}-${mediaId}.webp`;
      processedFilePath = path.join(tempDir, `processed-${imageSuffix}`);
      await compressImage(rawFilePath, processedFilePath);
      finalMimeType = "image/webp";
      storagePath = `media/${userId}/${mediaId}.webp`;
    }

    // 3. Upload to Supabase Storage if configured, otherwise fall back to local dev base64 URL
    if (supabase) {
      await runFaceAnonymization(processedFilePath, bucketName, storagePath, finalMimeType);

      // 4. Upload thumbnail if video
      if (isVideo && localThumbPath) {
        const thumbBuffer = await fs.promises.readFile(localThumbPath);
        const { error: thumbUploadError } = await supabase.storage
          .from(bucketName)
          .upload(thumbnailPath, thumbBuffer, { contentType: "image/jpeg", cacheControl: "3600", upsert: true });

        if (thumbUploadError) {
          console.error("Warning: Failed to upload video thumbnail:", thumbUploadError.message);
          thumbnailPath = null;
        }
      }
    } else {
      // Local fallback: read file and convert to base64 Data URL
      const processedBuffer = await fs.promises.readFile(processedFilePath);
      const b64 = processedBuffer.toString("base64");
      storagePath = `data:${finalMimeType};base64,${b64}`;

      if (isVideo && localThumbPath) {
        const thumbBuffer = await fs.promises.readFile(localThumbPath);
        thumbnailPath = `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`;
      }
    }

    // 5. Get file size of processed file
    const stats = await fs.promises.stat(processedFilePath);
    const sizeBytes = stats.size;

    // 6. Expiry rule (10 days for free tier videos, null for premium or images)
    const expiresAt = (isVideo && !premium)
      ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      : null;

    // 7. Write Media record to database
    const mediaRecord = await prisma.media.create({
      data: {
        id: mediaId,
        userId,
        type: isVideo ? "VIDEO" : "IMAGE",
        storagePath,
        thumbnailPath,
        bucket: bucketName,
        mimeType: finalMimeType,
        sizeBytes,
        durationSeconds: duration,
        wasPremiumUpload: premium,
        expiresAt
      }
    });

    // 8. Generate signed URL for retrieval if using Supabase
    let signedUrl = storagePath;
    if (supabase && storagePath.startsWith("media/")) {
      const { data: signedData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storagePath, 3600);
      signedUrl = signedData?.signedUrl || "";
    }

    return res.status(201).json({
      media: mediaRecord,
      url: signedUrl
    });
  } catch (err) {
    console.error("Media upload failure:", err);
    return res.status(500).json({ error: "UPLOAD_FAILED", message: err.message || "Failed to process and upload media." });
  } finally {
    // 9. Clean up all local temporary files under all circumstances
    fs.unlink(rawFilePath, () => {});
    if (processedFilePath) {
      fs.unlink(processedFilePath, () => {});
    }
    if (localThumbPath) {
      fs.unlink(localThumbPath, () => {});
    }
  }
});

/**
 * DELETE /api/media/:mediaId
 * Securely deletes media from Supabase Storage and Postgres DB irreversibly.
 */
router.delete("/:mediaId", requireAuth, async (req, res) => {
  const { mediaId } = req.params;

  try {
    // 1. Fetch the media record
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    });

    if (!media) {
      return res.status(404).json({ error: "Media not found." });
    }

    // 2. Ownership authorization check
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden. You do not own this media." });
    }

    // If it's a local/base64 dev fallback, skip Supabase storage delete and delete row directly
    if (!media.storagePath.startsWith("media/")) {
      await prisma.media.delete({
        where: { id: mediaId }
      });
      return res.status(200).json({ success: true, message: "Media deleted successfully (local fallback)." });
    }

    if (!supabase) {
      return res.status(500).json({ error: "SUPABASE_UNAVAILABLE", message: "Storage service is not configured." });
    }

    // 3. Delete from Supabase Storage first to avoid orphaned storage leak
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

    // 4. Delete the database row only after storage is successfully cleared
    await prisma.media.delete({
      where: { id: mediaId }
    });

    return res.status(200).json({ success: true, message: "Media deleted successfully." });
  } catch (err) {
    console.error("Media delete error:", err);
    return res.status(500).json({ error: "DELETE_FAILED", message: "Failed to delete media." });
  }
});

// Multer error handler for file constraints
router.use((err, req, res, next) => {
  if (err.code === "INVALID_MIME_TYPE") {
    return res.status(415).json({ error: err.message });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File exceeds the 50 MB size limit." });
  }
  next(err);
});

export default router;
