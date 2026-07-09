/**
 * src/controllers/auth/recovery.controller.js
 *
 * Recovery code redemption and regeneration handlers with Zod validation
 * and standardized error response shapes.
 */

import prisma from "../../config/prisma.js";
import { generateToken } from "../../utils/jwt.js";
import {
  hashPassphrase,
  isPassphraseStrongEnough,
  checkPassphrasePwned,
} from "../../utils/crypto.js";
import { generateRecoveryCodes, findMatchingRecoveryCode } from "../../utils/recoveryCodes.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";

/**
 * POST /v1/auth/recovery-codes/redeem
 * Body: { handle, recoveryCode, newPassphrase }
 */
export async function redeemRecoveryCode(req, res) {
  try {
    const { handle, recoveryCode, newPassphrase } = req.body;
    const cleanHandle = handle.trim().toLowerCase();

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
          message: "New passphrase appears in known data breaches. Choose a different one.",
          code: "PWNED_PASSPHRASE",
        },
      });
    }

    // Concurrently hash the new passphrase to prevent timing-based user enumeration/code testing leaks
    const newHashPromise = hashPassphrase(newPassphrase);

    const user = await prisma.user.findUnique({
      where: { handle: cleanHandle },
      include: { recoveryCodes: true },
    });

    const matched = user ? findMatchingRecoveryCode(recoveryCode, user.recoveryCodes) : null;

    // Await the new hash (guarantees Argon2 CPU cost is always paid)
    const newHash = await newHashPromise;

    // Always respond with the same generic error — don't reveal whether handle exists
    if (!user || !matched) {
      return res.status(400).json({
        error: {
          message: "Invalid recovery code.",
          code: "INVALID_RECOVERY_CODE",
        },
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        error: {
          message: "Account suspended.",
          code: "ACCOUNT_BANNED",
        },
      });
    }

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
    return res.status(500).json({
      error: {
        message: "Failed to redeem recovery code.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * POST /v1/auth/recovery-codes/regenerate
 * Body: { currentPassphrase } (validated by requireStepUp middleware)
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
    return res.status(500).json({
      error: {
        message: "Failed to regenerate recovery codes.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
