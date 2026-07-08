import { Router } from "express";
import { register } from "../controllers/auth/register.controller.js";
import { login, loginVerifyTotp } from "../controllers/auth/login.controller.js";
import { redeemRecoveryCode, regenerateRecoveryCodes } from "../controllers/auth/recovery.controller.js";
import { logoutAll, changePassphrase, deleteAccount, getSecurityEvents, updateSecurityKey, getMe, updateChatPublicKey } from "../controllers/auth/profile.controller.js";

import { requireAuth, requireStepUp } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  registerSchema,
  loginSchema,
  loginTotpSchema,
  redeemRecoveryCodeSchema,
  changePassphraseSchema,
  sensitiveActionSchema,
} from "../schemas/auth.schema.js";
import {
  loginLimiter,
  registrationLimiter,
  sensitiveActionLimiter,
  recoveryLimiter,
  accountLockoutGuard,
} from "../middleware/rateLimiter.js";

const router = Router();

// ─── Public: Registration & Login ────────────────────────────────────────────
router.post("/register", registrationLimiter, validateBody(registerSchema), register);
router.post("/login", loginLimiter, validateBody(loginSchema), accountLockoutGuard, login);
router.post("/login/totp", loginLimiter, validateBody(loginTotpSchema), loginVerifyTotp);

// ─── Recovery code redemption (IP-capped, no session required) ───────────────
router.post("/recovery-codes/redeem", recoveryLimiter, validateBody(redeemRecoveryCodeSchema), redeemRecoveryCode);

// ─── Authenticated session management ────────────────────────────────────────
router.post("/logout-all", requireAuth, logoutAll);

// ─── Sensitive: passphrase change (re-auth required) ─────────────────────────
router.post(
  "/passphrase/change",
  requireAuth,
  sensitiveActionLimiter,
  validateBody(changePassphraseSchema),
  requireStepUp,
  changePassphrase
);

// ─── Sensitive: recovery code regeneration (re-auth required) ────────────────
router.post(
  "/recovery-codes/regenerate",
  requireAuth,
  sensitiveActionLimiter,
  validateBody(sensitiveActionSchema),
  requireStepUp,
  regenerateRecoveryCodes
);

// ─── Current user profile (includes pendingDeletionAt for inactivity warning) ──
router.get("/me", requireAuth, getMe);
router.patch("/chat-public-key", requireAuth, updateChatPublicKey);

// ─── Security event timeline (anonymity-preserving substitute for email alerts)
router.get("/security-events", requireAuth, getSecurityEvents);

// ─── Sensitive: account deletion (re-auth required) ──────────────────────────
router.delete(
  "/account",
  requireAuth,
  sensitiveActionLimiter,
  validateBody(sensitiveActionSchema),
  requireStepUp,
  deleteAccount
);

// ─── Deprecated compatibility shims ──────────────────────────────────────────
router.patch("/security-key", requireAuth, updateSecurityKey);

export default router;
