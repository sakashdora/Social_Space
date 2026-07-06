import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "veil_shine_jwt_secret_key_123_456_789";

/**
 * Generates an access token for the given user ID.
 * @param {string} userId
 * @returns {string}
 */
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verifies the given token and returns the payload.
 * @param {string} token
 * @returns {object|null}
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
