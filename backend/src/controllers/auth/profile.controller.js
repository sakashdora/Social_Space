/**
 * src/controllers/auth/profile.controller.js
 *
 * User account, passphrase updates, device session invalidations,
 * and security event log handlers with standardized error response shapes.
 */

import prisma from "../../config/prisma.js";
import { generateToken } from "../../utils/jwt.js";
import {
  hashPassphrase,
  isPassphraseStrongEnough,
  checkPassphrasePwned,
} from "../../utils/crypto.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";

/**
 * POST /v1/auth/logout-all
 * Increments tokenVersion, invalidating all existing JWTs.
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
      token: newToken,
    });
  } catch (error) {
    console.error("logoutAll error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to invalidate sessions.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * POST /v1/auth/passphrase/change
 * Body: { newPassphrase } (currentPassphrase validated by requireStepUp middleware)
 */
export async function changePassphrase(req, res) {
  try {
    const { newPassphrase } = req.body;

    const strengthResult = isPassphraseStrongEnough(newPassphrase);
    if (!strengthResult.ok) {
      return res.status(400).json({
        error: {
          message: strengthResult.reason,
          code: "WEAK_PASSPHRASE",
        },
      });
    }

    const hibpResult = await checkPassphrasePwned(newPassphrase);
    if (hibpResult.pwned) {
      return res.status(400).json({
        error: {
          message: `This passphrase appears in ${hibpResult.count?.toLocaleString() ?? "known"} data breach(es). Choose a different one.`,
          code: "PWNED_PASSPHRASE",
        },
      });
    }

    const newHash = await hashPassphrase(newPassphrase);
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { recoveryHash: newHash, tokenVersion: { increment: 1 } },
    });

    await logSecurityEvent(req.user.id, "PASSPHRASE_CHANGED", req);

    const token = generateToken(updated.id, updated.tokenVersion);
    return res.status(200).json({
      message: "Passphrase updated. All other sessions have been signed out.",
      token,
    });
  } catch (error) {
    console.error("changePassphrase error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to change passphrase.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * DELETE /v1/auth/account
 * Body: { currentPassphrase } (validated by requireStepUp middleware)
 */
export async function deleteAccount(req, res) {
  try {
    await logSecurityEvent(req.user.id, "ACCOUNT_DELETED", req);
    await prisma.user.delete({ where: { id: req.user.id } });
    return res.status(200).json({ message: "Account and all associated data permanently deleted." });
  } catch (error) {
    console.error("deleteAccount error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to delete account.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * GET /v1/auth/security-events
 * Returns the security event timeline for the current user.
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
    return res.status(500).json({
      error: {
        message: "Failed to fetch security events.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * GET /v1/auth/me
 * Returns the authenticated user's public profile including pendingDeletionAt
 * so the frontend can surface an inactivity-deletion warning.
 */
export async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        handle: true,
        createdAt: true,
        pendingDeletionAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: { message: "User not found.", code: "NOT_FOUND" },
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({
      error: { message: "Failed to fetch profile.", code: "INTERNAL_SERVER_ERROR" },
    });
  }
}

/**
 * Legacy: update security key (deprecated)
 */
export async function updateSecurityKey(req, res) {
  return res.status(410).json({
    error: {
      message: "This endpoint is deprecated. Use POST /v1/auth/passphrase/change instead.",
      code: "GONE",
    },
  });
}
