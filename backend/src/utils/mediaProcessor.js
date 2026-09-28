import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

const execFileAsync = promisify(execFile);

/**
 * Ensures binary files packaged in serverless bundles have executable permissions on Linux.
 * 
 * @param {string} binPath 
 */
async function ensureExecutable(binPath) {
  if (!binPath || process.platform === "win32") return;
  try {
    const stat = await fs.promises.stat(binPath);
    if ((stat.mode & 0o111) === 0) {
      await fs.promises.chmod(binPath, 0o755);
    }
  } catch {
    // Read-only filesystem or missing binary; let execution attempt proceed or fail explicitly
  }
}

/**
 * Server-authoritative video duration probe using ffprobe.
 * Fails closed if duration is unreadable or non-positive.
 * Differentiates missing server binaries (500) from invalid user videos (400).
 * 
 * @param {string} filePath - Path to video file on disk
 * @param {boolean} isPremium - Whether user has premium account
 * @returns {Promise<{ valid: boolean, durationSeconds?: number, error?: string, message?: string, status?: number, maxSeconds?: number }>}
 */
export async function probeVideoDuration(filePath, isPremium) {
  try {
    const resolvedFfprobe = ffprobePath?.path || "ffprobe";
    await ensureExecutable(resolvedFfprobe);

    const { stdout } = await execFileAsync(resolvedFfprobe, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);

    const duration = parseFloat(stdout.trim());

    if (isNaN(duration) || duration <= 0) {
      return {
        valid: false,
        error: "INVALID_VIDEO_FILE",
        message: "Invalid or unsupported video file. Unable to verify duration.",
        status: 400
      };
    }

    if (!isPremium && duration > 60) {
      return {
        valid: false,
        error: "VIDEO_TOO_LONG",
        message: "Free accounts are limited to 60-second videos. Upgrade to premium for unlimited length.",
        maxSeconds: 60,
        status: 413
      };
    }

    return {
      valid: true,
      durationSeconds: duration
    };
  } catch (err) {
    console.error("[mediaProcessor] ffprobe execution error:", err.message);
    const isBinaryMissing = err.code === "ENOENT";
    return {
      valid: false,
      error: isBinaryMissing ? "SERVER_BINARY_MISSING" : "INVALID_VIDEO_FILE",
      message: isBinaryMissing
        ? "Video verification binary (ffprobe) is missing or not executable on this server deployment."
        : "Invalid or unsupported video file. Unable to verify duration.",
      status: isBinaryMissing ? 500 : 400
    };
  }
}

/**
 * Extracts a single thumbnail frame at ~0.5s from the video file using ffmpeg.
 * 
 * @param {string} videoPath - Input video path
 * @param {string} outputPath - Output image path (e.g. .jpg)
 * @returns {Promise<boolean>} - True if thumbnail was extracted, false if failed
 */
export async function extractVideoThumbnail(videoPath, outputPath) {
  const resolvedFfmpeg = ffmpegPath || "ffmpeg";
  await ensureExecutable(resolvedFfmpeg);

  try {
    await execFileAsync(resolvedFfmpeg, [
      "-ss", "0.5",
      "-i", videoPath,
      "-frames:v", "1",
      "-y",
      outputPath
    ]);
    return true;
  } catch (err) {
    console.warn("[mediaProcessor] Thumbnail extraction failed at 0.5s, trying at 0.0s:", err.message);
    try {
      await execFileAsync(resolvedFfmpeg, [
        "-ss", "0.0",
        "-i", videoPath,
        "-frames:v", "1",
        "-y",
        outputPath
      ]);
      return true;
    } catch (fallbackErr) {
      console.error("[mediaProcessor] Thumbnail frame extraction permanently failed:", fallbackErr.message);
      return false;
    }
  }
}

/**
 * Legacy validator maintained for backwards compatibility.
 * Server-authoritative probeVideoDuration should be used instead.
 */
export function validateVideoDuration(durationSeconds, isPremium) {
  if (typeof durationSeconds !== "number" || isNaN(durationSeconds) || durationSeconds <= 0) {
    return {
      valid: false,
      error: "INVALID_VIDEO_FILE",
      message: "Invalid video metadata. Duration could not be verified.",
      status: 400
    };
  }

  if (!isPremium && durationSeconds > 60) {
    return {
      valid: false,
      error: "VIDEO_TOO_LONG",
      message: "Free accounts are limited to 60-second videos. Upgrade to premium for unlimited length.",
      maxSeconds: 60,
      status: 413
    };
  }

  return { valid: true };
}
