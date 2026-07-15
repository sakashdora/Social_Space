import { Router } from "express";
import {
  setupTotp,
  enableTotp,
  disableTotp,
  getTotpStatus,
} from "../controllers/totp.controller.js";
import { requireAuth, requireStepUp } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { totpEnableSchema, sensitiveActionSchema } from "../schemas/auth.schema.js";
import { pgRateLimit } from "../config/rateLimiters.js";

const router = Router();

// All TOTP routes require authentication
router.use(requireAuth);

router.get("/status", getTotpStatus);
router.post("/setup", setupTotp);
router.post("/enable", pgRateLimit("totp"), validateBody(totpEnableSchema), enableTotp);

// Disable TOTP: sensitive action — requires passphrase re-auth
router.post(
  "/disable",
  pgRateLimit("sensitive"),
  validateBody(sensitiveActionSchema),
  requireStepUp,
  disableTotp
);

export default router;
