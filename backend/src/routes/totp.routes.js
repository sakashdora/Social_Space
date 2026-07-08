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
import { totpVerifyLimiter, sensitiveActionLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// All TOTP routes require authentication
router.use(requireAuth);

router.get("/status", getTotpStatus);
router.post("/setup", setupTotp);
router.post("/enable", totpVerifyLimiter, validateBody(totpEnableSchema), enableTotp);

// Disable TOTP: sensitive action — requires passphrase re-auth
router.post(
  "/disable",
  sensitiveActionLimiter,
  validateBody(sensitiveActionSchema),
  requireStepUp,
  disableTotp
);

export default router;
