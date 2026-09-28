import { waitUntil as vercelWaitUntil } from "@vercel/functions";

/**
 * Executes a non-blocking background promise in a serverless-safe manner.
 * 
 * On Vercel, serverless containers freeze immediately once an HTTP response is returned,
 * killing or suspending unawaited promises mid-flight. When the container is reused, the
 * suspended promise resumes and steals CPU cycles from the next incoming request.
 * 
 * safeWaitUntil uses @vercel/functions waitUntil to signal the platform runtime to keep
 * the invocation alive until the promise resolves, without blocking the user-facing HTTP response.
 * If called outside of Vercel (e.g. local dev, unit tests, or Docker/Azure), it safely handles the promise
 * and ensures any rejections are logged without crashing.
 * 
 * @param {Promise<any>} promise - The asynchronous background task to execute
 */
export function safeWaitUntil(promise) {
  if (!promise || typeof promise.then !== "function") {
    return;
  }

  try {
    vercelWaitUntil(promise);
  } catch (err) {
    // In environments where waitUntil cannot be scheduled, ensure rejections are caught
    promise.catch((e) => {
      console.error("[lifecycle] Background task error (fallback handler):", e);
    });
  }
}
