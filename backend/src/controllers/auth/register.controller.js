/**
 * src/controllers/auth/register.controller.js
 *
 * Registration endpoint logic with Zod-based validation (via middleware)
 * and standardized error response shapes.
 */

import prisma from "../../config/prisma.js";
import { generateToken } from "../../utils/jwt.js";
import {
  hashPassphrase,
  isPassphraseStrongEnough,
  checkPassphrasePwned,
} from "../../utils/crypto.js";
import { generateRecoveryCodes } from "../../utils/recoveryCodes.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";
import crypto from "node:crypto";

/**
 * POST /v1/auth/register
 * Body: { handle, passphrase }
 * Returns: { token, user, recoveryCodes[] }
 */
export async function register(req, res) {
  try {
    const { handle, passphrase } = req.body;

    const cleanHandle = handle.trim().toLowerCase();

    // Entropy check
    const strengthResult = isPassphraseStrongEnough(passphrase);
    if (!strengthResult.ok) {
      return res.status(400).json({
        error: {
          message: strengthResult.reason,
          code: "WEAK_PASSPHRASE",
        },
      });
    }

    // Run HIBP check (k-anonymity network request) and handle uniqueness check (DB query) concurrently
    const [hibpResult, existing] = await Promise.all([
      checkPassphrasePwned(passphrase),
      prisma.user.findUnique({ where: { handle: cleanHandle } }),
    ]);

    // Check handle collision first
    if (existing) {
      return res.status(409).json({
        error: {
          message: "Handle already taken. Choose another.",
          code: "HANDLE_TAKEN",
        },
      });
    }

    // Check HIBP breach result
    if (hibpResult.pwned) {
      return res.status(400).json({
        error: {
          message: `This passphrase has appeared in ${hibpResult.count?.toLocaleString() ?? "known"} data breach(es). Choose a different one.`,
          code: "PWNED_PASSPHRASE",
        },
      });
    }

    // Hash passphrase (PBKDF2-HMAC-SHA256, see utils/crypto.js)
    const recoveryHash = await hashPassphrase(passphrase);

    // Generate 8 BIP39 recovery codes
    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

    // Random avatar
    const avatarUrl = `/assets/avatars/avatar-${Math.floor(Math.random() * 8) + 1}.png`;

    // User and recovery codes commit atomically as one D1 batch.
    const userId = crypto.randomUUID();
    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: { id: userId, handle: cleanHandle, recoveryHash, avatarUrl },
      }),
      prisma.recoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);

    await logSecurityEvent(user.id, "ACCOUNT_CREATED", req);

    const token = generateToken(user.id, user.tokenVersion);

    return res.status(201).json({
      token,
      user: { id: user.id, handle: user.handle, avatarUrl: user.avatarUrl },
      recoveryCodes: rawCodes,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: { message: "Handle already taken. Choose another.", code: "HANDLE_TAKEN" },
      });
    }
    console.error("Register error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to register account.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
