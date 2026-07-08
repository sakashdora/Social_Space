/**
 * src/controllers/passkey/login.controller.js
 *
 * Passkey login options and verification handlers
 * with standardized error response shapes.
 */

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { generateToken } from "../../utils/jwt.js";
import { store } from "../../config/challengeStore.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";
import crypto from "crypto";

const CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * POST /v1/auth/passkeys/login-options
 */
export async function getLoginOptions(req, res) {
  try {
    const sessionToken = crypto.randomBytes(16).toString("hex");
    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      userVerification: "required",
      allowCredentials: [],
    });

    await store.set(`passkey:auth:${sessionToken}`, { challenge: options.challenge }, CHALLENGE_TTL_SECONDS);

    return res.status(200).json({ ...options, sessionToken });
  } catch (error) {
    console.error("getLoginOptions error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to generate authentication options.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * POST /v1/auth/passkeys/login-verify
 */
export async function verifyLogin(req, res) {
  try {
    const { credential, sessionToken } = req.body;

    const stored = await store.get(`passkey:auth:${sessionToken}`);
    if (!stored) {
      return res.status(400).json({
        error: {
          message: "Authentication challenge expired. Try again.",
          code: "CHALLENGE_EXPIRED",
        },
      });
    }

    // Find the passkey by credentialID
    const passkeyRecord = await prisma.passkey.findUnique({
      where: { credentialID: credential.id },
      include: { user: { select: { id: true, handle: true, avatarUrl: true, tokenVersion: true, isBanned: true } } },
    });

    if (!passkeyRecord || passkeyRecord.isRevoked) {
      return res.status(401).json({
        error: {
          message: "Passkey not found or has been revoked.",
          code: "PASSKEY_NOT_FOUND",
        },
      });
    }

    if (passkeyRecord.user.isBanned) {
      return res.status(403).json({
        error: {
          message: "Account suspended.",
          code: "ACCOUNT_BANNED",
        },
      });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: stored.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
        credential: {
          id: passkeyRecord.credentialID,
          publicKey: Buffer.from(passkeyRecord.publicKey, "base64"),
          counter: Number(passkeyRecord.counter),
          transports: passkeyRecord.transports ? JSON.parse(passkeyRecord.transports) : [],
        },
      });
    } catch (err) {
      return res.status(400).json({
        error: {
          message: `Authentication verification failed: ${err.message}`,
          code: "VERIFICATION_FAILED",
        },
      });
    }

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(400).json({
        error: {
          message: "Authentication not verified.",
          code: "VERIFICATION_FAILED",
        },
      });
    }

    const { newCounter } = verification.authenticationInfo;

    // Check for cloned credential: authenticator counter must strictly increase
    if (newCounter <= Number(passkeyRecord.counter)) {
      await prisma.passkey.update({
        where: { id: passkeyRecord.id },
        data: { isRevoked: true },
      });
      await logSecurityEvent(
        passkeyRecord.userId,
        "CLONE_DETECTED",
        req,
        { passkeyId: passkeyRecord.id, storedCounter: passkeyRecord.counter.toString(), receivedCounter: newCounter.toString() }
      );
      await store.del(`passkey:auth:${sessionToken}`);
      return res.status(401).json({
        error: {
          message: "Passkey rejected: signature counter did not increase. This may indicate a cloned authenticator. The passkey has been revoked and a security alert has been logged.",
          code: "CLONE_DETECTED",
        },
      });
    }

    // Update counter in DB
    await prisma.passkey.update({
      where: { id: passkeyRecord.id },
      data: { counter: newCounter, lastUsedAt: new Date() },
    });

    await store.del(`passkey:auth:${sessionToken}`);
    await logSecurityEvent(passkeyRecord.userId, "PASSKEY_LOGIN_SUCCESS", req, { passkeyId: passkeyRecord.id });

    const token = generateToken(passkeyRecord.user.id, passkeyRecord.user.tokenVersion);
    return res.status(200).json({
      token,
      user: {
        id: passkeyRecord.user.id,
        handle: passkeyRecord.user.handle,
        avatarUrl: passkeyRecord.user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("verifyLogin error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to verify passkey login.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
