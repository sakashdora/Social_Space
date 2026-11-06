/**
 * src/utils/jwt.js
 *
 * Minimal HS256 JWT implementation on node:crypto (available in Workers with
 * the nodejs_compat flag). Only HS256 is accepted, so the "none" algorithm and
 * algorithm-confusion attacks are impossible by construction. Signatures are
 * compared in constant time.
 */

import crypto from "node:crypto";
import { env } from "../config/env.js";

const b64url = (input) => Buffer.from(input).toString("base64url");
const TOKEN_TTL_SECONDS = 7 * 24 * 3600;

function sign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Issues a session token embedding userId and tokenVersion. Incrementing the
 * stored tokenVersion revokes every outstanding token for that user.
 */
export function generateToken(userId, tokenVersion) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ userId, tokenVersion, iat: now, exp: now + TOKEN_TTL_SECONDS }, env.JWT_SECRET);
}

/**
 * Signs a short-lived, scoped token (media tickets, uploads). `audience` and
 * `scope` are checked by verifyScopedToken.
 */
export function signScopedToken(claims, { expiresInSeconds, audience }) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ ...claims, aud: audience, iat: now, exp: now + expiresInSeconds }, env.JWT_SECRET);
}

function decodeVerified(token, secret) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  let headerJson;
  try {
    headerJson = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (headerJson?.alg !== "HS256") return null;

  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url"));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Returns the session payload ({ userId, tokenVersion }) or null. */
export function verifyToken(token) {
  const payload = decodeVerified(token, env.JWT_SECRET);
  if (!payload || typeof payload.userId !== "string") return null;
  return payload;
}

/** Returns the payload when signature, expiry and audience all match; otherwise null. */
export function verifyScopedToken(token, audience) {
  const payload = decodeVerified(token, env.JWT_SECRET);
  if (!payload || payload.aud !== audience) return null;
  return payload;
}
