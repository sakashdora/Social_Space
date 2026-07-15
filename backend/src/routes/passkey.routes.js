import { Router } from "express";
import { getRegisterOptions, verifyRegistration } from "../controllers/passkey/register.controller.js";
import { getLoginOptions, verifyLogin } from "../controllers/passkey/login.controller.js";
import { listPasskeys, removePasskey } from "../controllers/passkey/management.controller.js";
import { requireAuth, requireStepUp } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  passkeyVerifyLoginSchema,
  passkeyVerifyRegisterSchema,
  sensitiveActionSchema,
} from "../schemas/auth.schema.js";
import { pgRateLimit } from "../config/rateLimiters.js";

const router = Router();

// ─── Discoverable login (no session required) ─────────────────────────────────
router.post("/login-options", pgRateLimit("login"), getLoginOptions);
router.post("/login-verify", pgRateLimit("login"), validateBody(passkeyVerifyLoginSchema), verifyLogin);

// ─── Registration (session required) ─────────────────────────────────────────
router.post("/register-options", requireAuth, getRegisterOptions);
router.post("/register-verify", requireAuth, validateBody(passkeyVerifyRegisterSchema), verifyRegistration);

// ─── Passkey management (session required) ────────────────────────────────────
router.get("/", requireAuth, listPasskeys);

// Remove passkey: sensitive action -- requires passphrase step-up
router.delete(
  "/:id",
  requireAuth,
  pgRateLimit("sensitive"),
  validateBody(sensitiveActionSchema),
  requireStepUp,
  removePasskey
);

export default router;
