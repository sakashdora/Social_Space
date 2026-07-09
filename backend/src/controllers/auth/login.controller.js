/**
 * src/controllers/auth/login.controller.js
 *
 * Login and MFA login verification handlers with Zod validation
 * and standardized error response shapes.
 */

import crypto from "crypto";
import prisma from "../../config/prisma.js";
import { generateToken } from "../../utils/jwt.js";
import { verifyPassphrase, decrypt } from "../../utils/crypto.js";
import { verify } from "otplib";
import { recordFailedAttempt, clearFailedAttempts } from "../../middleware/rateLimiter.js";
import { store } from "../../config/challengeStore.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";

const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * POST /v1/auth/login
 * Body: { handle, passphrase }
 * Returns:
 *   If no TOTP: { token, user }
 *   If TOTP enabled: { mfaRequired: true, challengeToken, message }
 */
export async function login(req, res) {
  try {
    const { handle, passphrase } = req.body;
    const cleanHandle = handle.trim().toLowerCase();

    // Lookup user — always run password verification to prevent timing-based user enumeration
    const user = await prisma.user.findUnique({
      where: { handle: cleanHandle },
      select: {
        id: true,
        handle: true,
        recoveryHash: true,
        isBanned: true,
        tokenVersion: true,
        totpEnabled: true,
        avatarUrl: true,
      },
    });

    // Dummy hash to prevent timing attacks when user doesn't exist
    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=1$dummysaltdummysalt$dummyhashvalue00000000000000000000000000000";
    const hashToVerify = user ? user.recoveryHash : dummyHash;
    const isMatch = await verifyPassphrase(passphrase, hashToVerify);

    if (!user || !isMatch) {
      // Always record failure against handle
      await recordFailedAttempt(cleanHandle, req.ip);
      return res.status(401).json({
        error: {
          message: "Invalid handle or passphrase.",
          code: "INVALID_CREDENTIALS",
        },
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        error: {
          message: "This account has been suspended.",
          code: "ACCOUNT_BANNED",
        },
      });
    }

    await clearFailedAttempts(cleanHandle, req.ip);

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
    return res.status(500).json({
      error: {
        message: "Failed to verify credentials.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * POST /v1/auth/login/totp
 * Body: { challengeToken, totpCode }
 */
export async function loginVerifyTotp(req, res) {
  try {
    const { challengeToken, totpCode } = req.body;

    const challenge = await store.get(`mfa:${challengeToken}`);
    if (!challenge) {
      return res.status(401).json({
        error: {
          message: "Challenge expired or invalid. Please sign in again.",
          code: "CHALLENGE_EXPIRED",
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: { id: true, handle: true, avatarUrl: true, tokenVersion: true, totpSecret: true, isBanned: true },
    });

    if (!user || !user.totpSecret) {
      return res.status(401).json({
        error: {
          message: "MFA configuration error.",
          code: "MFA_CONFIG_ERROR",
        },
      });
    }

    if (user.isBanned) {
      await store.del(`mfa:${challengeToken}`);
      return res.status(403).json({
        error: {
          message: "Account suspended.",
          code: "ACCOUNT_BANNED",
        },
      });
    }

    const secret = decrypt(user.totpSecret);
    const result = await verify({ secret, token: totpCode });
    const valid = result.valid;

    if (!valid) {
      await recordFailedAttempt(user.handle, req.ip);
      return res.status(401).json({
        error: {
          message: "Invalid TOTP code.",
          code: "INVALID_TOTP_CODE",
        },
      });
    }

    await store.del(`mfa:${challengeToken}`);
    await clearFailedAttempts(user.handle, req.ip);
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    await logSecurityEvent(user.id, "LOGIN_TOTP_SUCCESS", req);

    const token = generateToken(user.id, user.tokenVersion);
    return res.status(200).json({
      token,
      user: { id: user.id, handle: user.handle, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error("loginVerifyTotp error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to verify MFA code.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
