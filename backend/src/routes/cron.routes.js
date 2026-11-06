/**
 * src/routes/cron.routes.js
 *
 * Manual trigger for the retention job. The scheduled Worker handler runs the
 * same job on the cron trigger; this endpoint requires the CRON_SECRET bearer.
 */

import { Router } from "../http/express-lite.js";
import { runRetentionCleanup } from "../services/cron.service.js";
import { env } from "../config/env.js";
import { timingSafeEqual } from "node:crypto";

const router = Router();

async function handleRetentionCron(req, res) {
  if (!env.CRON_SECRET) return res.status(503).json({ error: "Retention authentication is not configured." });
  const actual = Buffer.from(req.headers.authorization || "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: "Unauthorized cron trigger" });
  }
  try {
    const result = await runRetentionCleanup();
    return res.status(200).json({ status: "success", result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Cron Route] Retention cleanup error:", err?.message);
    return res.status(500).json({ status: "error", timestamp: new Date().toISOString() });
  }
}

router.get("/retention", handleRetentionCron);
router.post("/retention", handleRetentionCron);

export default router;
