/**
 * totp.controller.js — TOTP (Time-based One-Time Password) management
 *
 * Setup flow:
 *   1. POST /v1/auth/mfa/totp/setup   → returns QR code data URL + otpauth URI
 *   2. POST /v1/auth/mfa/totp/enable  → verify a test code, activate TOTP
 *
 * Disable:
 *   POST /v1/auth/mfa/totp/disable   → requires passphrase re-auth (requireStepUp)
 */

import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import prisma from "../config/prisma.js";
import { encrypt } from "../utils/crypto.js";
import { store } from "../config/challengeStore.js";
import { env } from "../config/env.js";
import { logSecurityEvent } from "../utils/securityLogger.js";

const TOTP_PENDING_TTL_SECONDS = 10 * 60;

/**
 * POST /v1/auth/mfa/totp/setup
 * Generates a new TOTP secret and returns a QR code data URL.
 */
export async function setupTotp(req, res) {
  try {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      secret,
      label: req.user.handle,
      issuer: env.TOTP_ISSUER,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store pending secret with TTL (not in DB) — expires in 10 minutes
    await store.set(`totp:pending:${req.user.id}`, { secret }, TOTP_PENDING_TTL_SECONDS);

    return res.status(200).json({
      qrCodeDataUrl,
      otpauthUrl, // for manual entry in authenticator apps
      message: "Scan the QR code in your authenticator app, then call /enable with a test code.",
    });
  } catch (error) {
    console.error("setupTotp error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to generate TOTP setup.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * POST /v1/auth/mfa/totp/enable
 * Body: { totpCode }
 */
export async function enableTotp(req, res) {
  try {
    const { totpCode } = req.body;

    const pending = await store.get(`totp:pending:${req.user.id}`);
    if (!pending) {
      return res.status(400).json({
        error: {
          message: "No pending TOTP setup found. Call /setup first.",
          code: "NO_PENDING_SETUP",
        },
      });
    }

    const result = await verify({ secret: pending.secret, token: totpCode });
    if (!result.valid) {
      return res.status(401).json({
        error: {
          message: "Invalid TOTP code. Make sure your authenticator app time is synced.",
          code: "INVALID_TOTP_CODE",
        },
      });
    }

    // Encrypt the confirmed secret and save to DB
    const encryptedSecret = encrypt(pending.secret);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { totpSecret: encryptedSecret, totpEnabled: true },
    });

    await store.del(`totp:pending:${req.user.id}`);
    await logSecurityEvent(req.user.id, "TOTP_ENABLED", req);

    return res.status(200).json({ message: "TOTP two-factor authentication is now active." });
  } catch (error) {
    console.error("enableTotp error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to enable TOTP.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * POST /v1/auth/mfa/totp/disable
 * Body: { currentPassphrase } (validated by requireStepUp)
 */
export async function disableTotp(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { totpEnabled: true },
    });

    if (!user?.totpEnabled) {
      return res.status(400).json({
        error: {
          message: "TOTP is not currently enabled.",
          code: "TOTP_NOT_ENABLED",
        },
      });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { totpSecret: null, totpEnabled: false },
    });

    await logSecurityEvent(req.user.id, "TOTP_DISABLED", req);
    return res.status(200).json({ message: "TOTP two-factor authentication has been disabled." });
  } catch (error) {
    console.error("disableTotp error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to disable TOTP.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * GET /v1/auth/mfa/totp/status
 */
export async function getTotpStatus(req, res) {
  try {
    return res.status(200).json({ totpEnabled: req.user.totpEnabled });
  } catch (error) {
    console.error("getTotpStatus error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to get TOTP status.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
