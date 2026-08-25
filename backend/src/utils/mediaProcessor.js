/**
 * Media Processing Utilities (Vercel Serverless Lightweight Edition)
 * 
 * Server-side FFmpeg and Sharp native binaries have been removed to prevent
 * Vercel function bundle size bloat (>50MB) and 10s execution timeouts.
 * Media compression, duration parsing, and thumbnail extraction are now performed
 * directly in the browser before direct upload to Supabase Storage.
 */

/**
 * Validates basic video parameters passed from client metadata.
 * 
 * @param {number} durationSeconds 
 * @param {boolean} isPremium 
 * @returns {{ valid: boolean, error?: string, code?: string, status?: number }}
 */
export function validateVideoDuration(durationSeconds, isPremium) {
  if (typeof durationSeconds !== "number" || isNaN(durationSeconds) || durationSeconds <= 0) {
    return {
      valid: false,
      error: "INVALID_VIDEO_METADATA",
      message: "Valid video duration in seconds is required.",
      status: 400
    };
  }

  if (!isPremium && durationSeconds > 30) {
    return {
      valid: false,
      error: "VIDEO_TOO_LONG",
      message: "Free accounts are limited to 30-second videos. Upgrade to premium for unlimited length.",
      maxSeconds: 30,
      status: 413
    };
  }

  return { valid: true };
}
