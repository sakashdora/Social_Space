import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const JWT_SECRET = env.JWT_SECRET;

/**
 * Generates an access token embedding userId AND tokenVersion.
 * tokenVersion allows invalidating all existing sessions by incrementing it in the DB.
 *
 * @param {string} userId
 * @param {number} tokenVersion
 * @returns {string}
 */
export function generateToken(userId, tokenVersion) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verifies the given token and returns the payload (including tokenVersion).
 * Returns null if the token is invalid or expired.
 *
 * @param {string} token
 * @returns {{ userId: string, tokenVersion: number } | null}
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
