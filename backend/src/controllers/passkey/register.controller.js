/**
 * src/controllers/passkey/register.controller.js
 *
 * Passkey registration options and verification handlers
 * with standardized error response shapes.
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { store } from "../../config/challengeStore.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";

const CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * POST /v1/auth/passkeys/register-options
 */
export async function getRegisterOptions(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { passkeys: { where: { isRevoked: false } } },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          message: "User not found.",
          code: "USER_NOT_FOUND",
        },
      });
    }

    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userID: Buffer.from(user.id, "utf8"),
      userName: user.handle,
      userDisplayName: `@${user.handle}`,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialID,
        type: "public-key",
        transports: pk.transports ? JSON.parse(pk.transports) : [],
      })),
    });

    await store.set(`passkey:reg:${req.user.id}`, { challenge: options.challenge }, CHALLENGE_TTL_SECONDS);

    return res.status(200).json(options);
  } catch (error) {
    console.error("getRegisterOptions error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to generate registration options.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * POST /v1/auth/passkeys/register-verify
 */
export async function verifyRegistration(req, res) {
  try {
    const { credential, nickname } = req.body;

    const stored = await store.get(`passkey:reg:${req.user.id}`);
    if (!stored) {
      return res.status(400).json({
        error: {
          message: "Registration challenge expired. Start again.",
          code: "CHALLENGE_EXPIRED",
        },
      });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: stored.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
      });
    } catch (err) {
      return res.status(400).json({
        error: {
          message: `Registration verification failed: ${err.message}`,
          code: "VERIFICATION_FAILED",
        },
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        error: {
          message: "Registration not verified.",
          code: "VERIFICATION_FAILED",
        },
      });
    }

    const { credential: regCred } = verification.registrationInfo;

    // Store passkey
    const passkey = await prisma.passkey.create({
      data: {
        userId: req.user.id,
        credentialID: regCred.id,
        publicKey: Buffer.from(regCred.publicKey).toString("base64"),
        counter: BigInt(regCred.counter),
        transports: credential.response.transports
          ? JSON.stringify(credential.response.transports)
          : null,
        nickname: nickname?.trim() || null,
      },
    });

    await store.del(`passkey:reg:${req.user.id}`);
    await logSecurityEvent(req.user.id, "PASSKEY_ADDED", req, { passkeyId: passkey.id, nickname: passkey.nickname });

    return res.status(201).json({ message: "Passkey registered successfully.", passkeyId: passkey.id });
  } catch (error) {
    console.error("verifyRegistration error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to verify passkey registration.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
