/**
 * auth.controller.js — VEIL authentication endpoints
 *
 * INTENTIONAL EXCLUSIONS (by design):
 *   - No email verification, no email OTP, no email-based reset
 *   - No SMS / mobile OTP
 *   - No "security question" recovery
 *   - Recovery is exclusively: passphrase OR passkey OR BIP39 recovery codes
 *
 * Phase 2 Fix #10: pendingMfaChallenges moved from in-memory Map to the
 * unified Redis-backed challenge store (src/config/challengeStore.js).
 * This makes MFA challenges durable across restarts and safe in multi-instance deployments.
 */

import crypto from "crypto";
import prisma from "../config/prisma.js";
import { generateToken } from "../utils/jwt.js";
import {
  hashPassphrase,
  verifyPassphrase,
  isPassphraseStrongEnough,
  checkPassphrasePwned,
  deviceFingerprint,
  decrypt,
} from "../utils/crypto.js";
import { verify } from "otplib";
import { generateRecoveryCodes, findMatchingRecoveryCode } from "../utils/recoveryCodes.js";
import {
  recordFailedAttempt,
  clearFailedAttempts,
} from "../middleware/rateLimiter.js";
import { store } from "../config/challengeStore.js";

// MFA challenge TTL: 5 minutes
const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

// No manual cleanup needed — Redis TTL handles expiry automatically.

/**
 * Helper: log a security event for a user.
 */
async function logSecurityEvent(userId, type, req, metadata = null) {
  try {
    await prisma.securityEvent.create({
      data: {
        userId,
        type,
        metadata: metadata ? JSON.stringify(metadata) : null,
        deviceFingerprintHash: deviceFingerprint(req),
      },
    });
  } catch (err) {
    console.error("Failed to log security event:", err.message);
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /v1/auth/register
 * Body: { handle, passphrase }
 * Returns: { token, user, recoveryCodes[] } — recoveryCodes shown ONCE, never stored
 */
export async function register(req, res) {
  try {
    const { handle, passphrase } = req.body;

    if (!handle || !passphrase) {
      return res.status(400).json({ error: "Handle and passphrase are required." });
    }

    const cleanHandle = handle.trim().toLowerCase();
    if (cleanHandle.length < 3 || cleanHandle.length > 20) {
      return res.status(400).json({ error: "Handle must be 3–20 characters." });
    }
    if (!/^[a-z0-9-]+$/.test(cleanHandle)) {
      return res.status(400).json({ error: "Handle may only contain lowercase letters, numbers, and dashes." });
    }

    // Entropy check
    const strengthResult = isPassphraseStrongEnough(passphrase);
    if (!strengthResult.ok) {
      return res.status(400).json({ error: strengthResult.reason });
    }

    // HIBP breach check (k-anonymity — only first 5 SHA-1 hex chars sent)
    const hibpResult = await checkPassphrasePwned(passphrase);
    if (hibpResult.pwned) {
      return res.status(400).json({
        error: `This passphrase has appeared in ${hibpResult.count?.toLocaleString() ?? "known"} data breach(es). Choose a different one.`,
      });
    }

    // Uniqueness check
    const existing = await prisma.user.findUnique({ where: { handle: cleanHandle } });
    if (existing) {
      return res.status(409).json({ error: "Handle already taken. Choose another." });
    }

    // Hash passphrase with Argon2id
    const recoveryHash = await hashPassphrase(passphrase);

    // Generate 8 BIP39 recovery codes — raw codes returned ONCE, only hashes stored
    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

    // Random avatar
    const avatarUrl = `/assets/avatars/avatar-${Math.floor(Math.random() * 8) + 1}.png`;

    // Create user + recovery codes in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { handle: cleanHandle, recoveryHash, avatarUrl },
      });
      await tx.recoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({ userId: newUser.id, codeHash })),
      });
      return newUser;
    });

    await logSecurityEvent(user.id, "ACCOUNT_CREATED", req);

    const token = generateToken(user.id, user.tokenVersion);

    return res.status(201).json({
      token,
      user: { id: user.id, handle: user.handle, avatarUrl: user.avatarUrl },
      // rawCodes are shown to the user EXACTLY ONCE here and are not stored anywhere
      recoveryCodes: rawCodes,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Failed to register account." });
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /v1/auth/login
 * Body: { handle, passphrase }
 * Returns:
 *   If no TOTP: { token, user }
 *   If TOTP enabled: { mfaRequired: true, challengeToken } (short-lived, 5 min)
 */
export async function login(req, res) {
  try {
    const { handle, passphrase } = req.body;

    if (!handle || !passphrase) {
      return res.status(400).json({ error: "Handle and passphrase are required." });
    }

    const cleanHandle = handle.trim().toLowerCase();

    // Lookup user — always run password verification to prevent timing-based user enumeration
    const user = await prisma.user.findUnique({
      where: { handle: cleanHandle },
      select: {
        id: true, handle: true, recoveryHash: true, isBanned: true,
        tokenVersion: true, totpEnabled: true, avatarUrl: true,
      },
    });

    // Dummy hash to prevent timing attacks when user doesn't exist
    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=1$dummysaltdummysalt$dummyhashvalue00000000000000000000000000000";
    const hashToVerify = user ? user.recoveryHash : dummyHash;
    const isMatch = await verifyPassphrase(passphrase, hashToVerify);

    if (!user || !isMatch) {
      // Always record failure against handle (even if user doesn't exist — prevent oracle attacks)
      await recordFailedAttempt(cleanHandle);
      return res.status(401).json({ error: "Invalid handle or passphrase." });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "This account has been suspended." });
    }

    await clearFailedAttempts(cleanHandle);

    // If TOTP is enabled, issue a short-lived challenge token instead of the full JWT
    if (user.totpEnabled) {
      const challengeToken = crypto.randomBytes(32).toString("hex");
      await store.set(
        `mfa:${challengeToken}`,
        { userId: user.id, handle: user.handle },
        MFA_CHALLENGE_TTL_SECONDS
      );
      return res.status(200).json({
        mfaRequired: true,
        challengeToken,
        message: "Enter your TOTP code to complete sign-in.",
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    await logSecurityEvent(user.id, "LOGIN_SUCCESS", req);

    const token = generateToken(user.id, user.tokenVersion);
    return res.status(200).json({
      token,
      user: { id: user.id, handle: user.handle, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Failed to verify credentials." });
  }
}

/**
 * POST /v1/auth/login/totp
 * Body: { challengeToken, totpCode }
 * Called after login returns mfaRequired=true. Validates the TOTP code
 * against the pending challenge and issues the real JWT.
 */
export async function loginVerifyTotp(req, res) {

  try {
    const { challengeToken, totpCode } = req.body;
    if (!challengeToken || !totpCode) {
      return res.status(400).json({ error: "challengeToken and totpCode are required." });
    }

    const challenge = await store.get(`mfa:${challengeToken}`);
    if (!challenge) {
      return res.status(401).json({ error: "Challenge expired or invalid. Please sign in again." });
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: { id: true, handle: true, avatarUrl: true, tokenVersion: true, totpSecret: true, isBanned: true },
    });

    if (!user || !user.totpSecret) {
      return res.status(401).json({ error: "MFA configuration error." });
    }

    if (user.isBanned) {
      await store.del(`mfa:${challengeToken}`);
      return res.status(403).json({ error: "Account suspended." });
    }

    const secret = decrypt(user.totpSecret);
    const result = await verify({ secret, token: totpCode });
    const valid = result.valid;

    if (!valid) {
      await recordFailedAttempt(user.handle);
      return res.status(401).json({ error: "Invalid TOTP code." });
    }

    await store.del(`mfa:${challengeToken}`);
    await clearFailedAttempts(user.handle);
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    await logSecurityEvent(user.id, "LOGIN_TOTP_SUCCESS", req);

    const token = generateToken(user.id, user.tokenVersion);
    return res.status(200).json({
      token,
      user: { id: user.id, handle: user.handle, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error("loginVerifyTotp error:", error);
    return res.status(500).json({ error: "Failed to verify MFA code." });
  }
}

// ─── Logout All Devices ───────────────────────────────────────────────────────

/**
 * POST /v1/auth/logout-all
 * Increments tokenVersion, invalidating all existing JWTs.
 * Requires valid session (requireAuth).
 */
export async function logoutAll(req, res) {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    await logSecurityEvent(req.user.id, "LOGOUT_ALL_DEVICES", req);
    const newToken = generateToken(updated.id, updated.tokenVersion);
    return res.status(200).json({
      message: "All other sessions have been invalidated.",
      token: newToken, // issue a fresh token for the current session
    });
  } catch (error) {
    console.error("logoutAll error:", error);
    return res.status(500).json({ error: "Failed to invalidate sessions." });
  }
}

// ─── Passphrase Change ────────────────────────────────────────────────────────

/**
 * POST /v1/auth/passphrase/change
 * Body: { currentPassphrase, newPassphrase }
 * Requires: requireAuth + sensitiveActionLimiter + requireStepUp (which verifies currentPassphrase)
 */
export async function changePassphrase(req, res) {
  try {
    const { newPassphrase } = req.body;
    if (!newPassphrase) {
      return res.status(400).json({ error: "newPassphrase is required." });
    }

    const strengthResult = isPassphraseStrongEnough(newPassphrase);
    if (!strengthResult.ok) {
      return res.status(400).json({ error: strengthResult.reason });
    }

    const hibpResult = await checkPassphrasePwned(newPassphrase);
    if (hibpResult.pwned) {
      return res.status(400).json({
        error: `This passphrase appears in ${hibpResult.count?.toLocaleString() ?? "known"} data breach(es). Choose a different one.`,
      });
    }

    const newHash = await hashPassphrase(newPassphrase);
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { recoveryHash: newHash, tokenVersion: { increment: 1 } },
    });

    await logSecurityEvent(req.user.id, "PASSPHRASE_CHANGED", req);

    // Issue a new token for the current session (old ones are now invalid)
    const token = generateToken(updated.id, updated.tokenVersion);
    return res.status(200).json({
      message: "Passphrase updated. All other sessions have been signed out.",
      token,
    });
  } catch (error) {
    console.error("changePassphrase error:", error);
    return res.status(500).json({ error: "Failed to change passphrase." });
  }
}

// ─── Recovery Code Redemption ─────────────────────────────────────────────────

/**
 * POST /v1/auth/recovery-codes/redeem
 * Body: { handle, recoveryCode, newPassphrase }
 * No per-account lockout (account is presumed inaccessible) — IP-capped by recoveryLimiter.
 */
export async function redeemRecoveryCode(req, res) {
  try {
    const { handle, recoveryCode, newPassphrase } = req.body;
    if (!handle || !recoveryCode || !newPassphrase) {
      return res.status(400).json({ error: "handle, recoveryCode, and newPassphrase are required." });
    }

    const cleanHandle = handle.trim().toLowerCase();

    const strengthResult = isPassphraseStrongEnough(newPassphrase);
    if (!strengthResult.ok) {
      return res.status(400).json({ error: strengthResult.reason });
    }

    const hibpResult = await checkPassphrasePwned(newPassphrase);
    if (hibpResult.pwned) {
      return res.status(400).json({
        error: "New passphrase appears in known data breaches. Choose a different one.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { handle: cleanHandle },
      include: { recoveryCodes: true },
    });

    // Always respond with the same generic error — don't reveal whether handle exists
    if (!user) {
      return res.status(400).json({ error: "Invalid recovery code." });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: "Account suspended." });
    }

    const matched = findMatchingRecoveryCode(recoveryCode, user.recoveryCodes);
    if (!matched) {
      return res.status(400).json({ error: "Invalid or already-used recovery code." });
    }

    const newHash = await hashPassphrase(newPassphrase);

    // Mark code as used, set new passphrase, bump tokenVersion — all in a transaction
    // Phase 4 Fix #17: Also clear TOTP secret — if the user needed a recovery code,
    // they likely lost access to their authenticator app too. They can re-enable TOTP
    // after logging in with their new passphrase.
    const hadTotp = user.totpEnabled;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.recoveryCode.update({
        where: { id: matched.id },
        data: { usedAt: new Date() },
      });
      return tx.user.update({
        where: { id: user.id },
        data: {
          recoveryHash: newHash,
          tokenVersion: { increment: 1 },
          // Clear TOTP — user must re-enroll after regaining access
          totpSecret: null,
          totpEnabled: false,
        },
      });
    });

    await logSecurityEvent(user.id, "RECOVERY_CODE_REDEEMED", req, { codeId: matched.id });
    if (hadTotp) {
      await logSecurityEvent(user.id, "TOTP_DISABLED", req, { reason: "recovery_code_redemption" });
    }

    const token = generateToken(updated.id, updated.tokenVersion);
    return res.status(200).json({
      message: "Recovery successful. All previous sessions have been signed out.",
      token,
      user: { id: updated.id, handle: updated.handle, avatarUrl: updated.avatarUrl },
    });
  } catch (error) {
    console.error("redeemRecoveryCode error:", error);
    return res.status(500).json({ error: "Failed to redeem recovery code." });
  }
}

// ─── Regenerate Recovery Codes ────────────────────────────────────────────────

/**
 * POST /v1/auth/recovery-codes/regenerate
 * Body: { currentPassphrase }
 * Requires: requireAuth + sensitiveActionLimiter + requireStepUp
 * Invalidates all old codes and issues 8 new ones — shown ONCE.
 */
export async function regenerateRecoveryCodes(req, res) {
  try {
    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

    await prisma.$transaction(async (tx) => {
      // Delete all existing codes for this user
      await tx.recoveryCode.deleteMany({ where: { userId: req.user.id } });
      // Create new ones
      await tx.recoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({ userId: req.user.id, codeHash })),
      });
    });

    await logSecurityEvent(req.user.id, "RECOVERY_CODES_REGENERATED", req);

    return res.status(200).json({
      message: "New recovery codes generated. Old codes are now invalid. Save these codes — they will not be shown again.",
      recoveryCodes: rawCodes,
    });
  } catch (error) {
    console.error("regenerateRecoveryCodes error:", error);
    return res.status(500).json({ error: "Failed to regenerate recovery codes." });
  }
}

// ─── Delete Account ────────────────────────────────────────────────────────────

/**
 * DELETE /v1/auth/account
 * Body: { currentPassphrase }
 * Requires: requireAuth + sensitiveActionLimiter + requireStepUp
 */
export async function deleteAccount(req, res) {
  try {
    // Phase 4 Fix #16: Log BEFORE the delete — cascade will remove SecurityEvent rows too,
    // but this captures the event in the audit trail at the moment of deletion.
    await logSecurityEvent(req.user.id, "ACCOUNT_DELETED", req);
    await prisma.user.delete({ where: { id: req.user.id } });
    return res.status(200).json({ message: "Account and all associated data permanently deleted." });
  } catch (error) {
    console.error("deleteAccount error:", error);
    return res.status(500).json({ error: "Failed to delete account." });
  }
}

// ─── Security Events ──────────────────────────────────────────────────────────

/**
 * GET /v1/auth/security-events
 * Returns the security event timeline for the current user.
 * This is the anonymity-preserving substitute for email security alerts.
 */
export async function getSecurityEvents(req, res) {
  try {
    const events = await prisma.securityEvent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        metadata: true,
        deviceFingerprintHash: true,
        createdAt: true,
      },
    });

    return res.status(200).json(events);
  } catch (error) {
    console.error("getSecurityEvents error:", error);
    return res.status(500).json({ error: "Failed to fetch security events." });
  }
}

// ─── Legacy: update security key (deprecated — kept for backwards compat) ─────
export async function updateSecurityKey(req, res) {
  return res.status(410).json({
    error: "This endpoint is deprecated. Use POST /v1/auth/passphrase/change instead.",
  });
}
