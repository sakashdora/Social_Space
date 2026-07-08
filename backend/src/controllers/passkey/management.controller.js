/**
 * src/controllers/passkey/management.controller.js
 *
 * Passkey management endpoints (listing, removal)
 * with standardized error response shapes.
 */

import prisma from "../../config/prisma.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";

/**
 * GET /v1/auth/passkeys
 */
export async function listPasskeys(req, res) {
  try {
    const passkeys = await prisma.passkey.findMany({
      where: { userId: req.user.id, isRevoked: false },
      select: { id: true, nickname: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(passkeys);
  } catch (error) {
    console.error("listPasskeys error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to list passkeys.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * DELETE /v1/auth/passkeys/:id
 * Body: { currentPassphrase } (validated by requireStepUp middleware)
 */
export async function removePasskey(req, res) {
  try {
    const { id } = req.params;

    const passkey = await prisma.passkey.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!passkey) {
      return res.status(404).json({
        error: {
          message: "Passkey not found.",
          code: "PASSKEY_NOT_FOUND",
        },
      });
    }

    await prisma.passkey.delete({ where: { id } });
    await logSecurityEvent(req.user.id, "PASSKEY_REMOVED", req, { passkeyId: id, nickname: passkey.nickname });

    return res.status(200).json({ message: "Passkey removed." });
  } catch (error) {
    console.error("removePasskey error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to remove passkey.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
