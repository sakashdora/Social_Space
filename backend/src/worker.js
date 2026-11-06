/**
 * src/worker.js
 *
 * Cloudflare Worker entry point.
 *   fetch:      HTTP API (see app.js)
 *   scheduled:  daily retention job (cron trigger in wrangler.toml)
 */

import { handleRequest } from "./app.js";
import { loadRuntimeEnv } from "./config/env.js";
import { setRuntime } from "./config/runtime.js";
import { setDatabase } from "./config/db.js";
import { runRetentionCleanup } from "./services/cron.service.js";

export default {
  fetch(request, bindings, ctx) {
    return handleRequest(request, bindings, ctx);
  },

  async scheduled(controller, bindings, ctx) {
    const job = (async () => {
      loadRuntimeEnv(bindings);
      setRuntime(bindings, ctx);
      await setDatabase(bindings);
      const result = await runRetentionCleanup();
      console.log("[scheduled] retention", JSON.stringify(result));
    })().catch((error) => {
      console.error("[scheduled] retention failed:", error?.message);
    });
    ctx.waitUntil(job);
    await job;
  },
};
