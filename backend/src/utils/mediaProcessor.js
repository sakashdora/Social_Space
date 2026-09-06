import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

const execFileAsync = promisify(execFile);

/**
 * Server-authoritative video duration probe using ffprobe.
 * Fails closed if duration is unreadable or non-positive.
 * 
 * @param {string} filePath - Path to video file on disk
 * @param {boolean} isPremium - Whether user has premium account
 * @returns {Promise<{ valid: boolean, durationSeconds?: number, error?: string, message?: string, status?: number, maxSeconds?: number }>}
 */
export async function probeVideoDuration(filePath, isPremium) {
  try {
    const { stdout } = await execFileAsync(ffprobePath.path || "ffprobe", [
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
    return {
      valid: false,
      error: "INVALID_VIDEO_FILE",
      message: "Invalid or unsupported video file. Unable to verify duration.",
      status: 400
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
  try {
    await execFileAsync(ffmpegPath || "ffmpeg", [
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
      await execFileAsync(ffmpegPath || "ffmpeg", [
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
