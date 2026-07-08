/**
 * src/utils/securityLogger.js
 *
 * Anonymised security event logging helper.
 */

import prisma from "../config/prisma.js";
import { deviceFingerprint } from "./crypto.js";

/**
 * Log a security event for a user.
 * @param {string} userId
 * @param {string} type
 * @param {import("express").Request} req
 * @param {any} [metadata]
 */
export async function logSecurityEvent(userId, type, req, metadata = null) {
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
