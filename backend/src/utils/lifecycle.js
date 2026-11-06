/**
 * src/utils/lifecycle.js
 *
 * Runs non-blocking work (AI moderation, storage cleanup, realtime fan-out)
 * after the HTTP response has been sent. Workers freeze the isolate once the
 * response is returned unless the promise is registered with ctx.waitUntil,
 * so that is used whenever an execution context is available.
 */

import { runtime } from "../config/runtime.js";

/**
 * @param {Promise<unknown>} promise
 */
export function safeWaitUntil(promise) {
  if (!promise || typeof promise.then !== "function") return;
  const logged = promise.catch((error) => {
    console.error("[lifecycle] Background task failed:", error?.message || error);
  });
  if (runtime.ctx && typeof runtime.ctx.waitUntil === "function") {
    runtime.ctx.waitUntil(logged);
  }
}
