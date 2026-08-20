import { Router } from "express";
import { runRetentionCleanup } from "../services/cron.service.js";

const router = Router();

/**
 * GET /api/cron/retention
 * POST /api/cron/retention
 *
 * Route target for Vercel Cron Jobs.
 * Vercel automatically sends `x-vercel-cron: 1` header on scheduled invocations.
 */
async function handleRetentionCron(req, res) {
  const isVercelCron = req.headers["x-vercel-cron"] === "1" || req.headers["x-vercel-cron"] === "true";
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  // Verify request authenticity if CRON_SECRET is configured
  if (cronSecret && !isVercelCron) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized cron trigger" });
    }
  }

  try {
    await runRetentionCleanup();
    return res.status(200).json({
      status: "success",
      message: "Retention cleanup executed successfully",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("[Cron Route] Retention cleanup error:", err.message);
    return res.status(500).json({
      status: "error",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

router.get("/retention", handleRetentionCron);
router.post("/retention", handleRetentionCron);

export default router;
