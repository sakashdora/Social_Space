/**
 * crypto.js — VEIL cryptographic primitives
 *
 * Exports:
 *   hashPassphrase, verifyPassphrase            — Argon2id (passphrase storage)
 *   isPassphraseStrongEnough                    — Shannon entropy + pattern checks (~60 bit min)
 *   checkPassphrasePwned                        — HIBP k-anonymity range API (first 5 SHA-1 hex chars only)
 *   encrypt, decrypt                            — AES-256-GCM (TOTP secret at-rest encryption)
 *   hashRecoveryCode, verifyRecoveryCode        — HMAC-SHA256 (recovery code hashing)
 *   deviceFingerprint                           — anonymised SHA-256 of IP + UA + Accept-Language
 *
 * INTENTIONAL EXCLUSIONS (by design — VEIL is email/SMS-free):
 *   - No email OTP
 *   - No SMS OTP
 *   - No TOTP is generated here — otplib handles that in totp.controller.js
 */

import argon2 from "argon2";
import crypto from "crypto";
import axios from "axios";
import { env } from "../config/env.js";

// ─── Argon2id parameters ─────────────────────────────────────────────────────
// PRODUCTION: Consider memoryCost: 2**17 (128 MiB) if server RAM allows
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

/**
 * Hash a passphrase with Argon2id.
 * @param {string} raw
 * @returns {Promise<string>} Argon2id encoded hash string
 */
export async function hashPassphrase(raw) {
  return argon2.hash(raw, ARGON2_OPTIONS);
}

/**
 * Verify a passphrase against an Argon2id hash.
 * @param {string} raw
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassphrase(raw, hash) {
  try {
    return await argon2.verify(hash, raw, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

// ─── Passphrase Strength ─────────────────────────────────────────────────────

/**
 * Calculate Shannon entropy in bits for a given string.
 * @param {string} str
 * @returns {number} bits of entropy
 */
function shannonEntropy(str) {
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  return Object.values(freq).reduce((sum, count) => {
    const p = count / len;
    return sum - p * Math.log2(p);
  }, 0) * len;
}

/**
 * Check whether a passphrase meets the minimum strength requirement.
 * Minimum: ~60 bits of entropy (rejects anything weaker).
 *
 * @param {string} raw
 * @returns {{ ok: boolean, reason?: string }}
 */
export function isPassphraseStrongEnough(raw) {
  if (!raw || typeof raw !== "string") {
    return { ok: false, reason: "Passphrase is required." };
  }

  if (raw.length < 12) {
    return { ok: false, reason: "Passphrase must be at least 12 characters." };
  }

  const entropy = shannonEntropy(raw);
  if (entropy < 60) {
    return {
      ok: false,
      reason: `Passphrase is too weak (${Math.round(entropy)} bits of entropy; minimum 60). Use more varied characters or a longer phrase.`,
    };
  }

  // Reject obvious low-entropy patterns even if character count is high
  if (/^(.)\1+$/.test(raw)) {
    return { ok: false, reason: "Passphrase cannot be a single repeated character." };
  }
  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg)/i.test(raw)) {
    return { ok: false, reason: "Passphrase contains sequential patterns that are too predictable." };
  }

  return { ok: true };
}

// ─── HaveIBeenPwned k-anonymity range check ───────────────────────────────────

/**
 * Check if a passphrase appears in the HaveIBeenPwned breach database.
 * Only the FIRST 5 HEX CHARACTERS of the SHA-1 hash are sent to the API.
 * The full SHA-1 is never sent to a third party.
 *
 * @param {string} raw plaintext passphrase
 * @returns {Promise<{ pwned: boolean, count?: number }>}
 */
export async function checkPassphrasePwned(raw) {
  try {
    const sha1 = crypto.createHash("sha1").update(raw).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
      timeout: 4000,
      headers: { "Add-Padding": "true" }, // Padding prevents traffic analysis
    });

    const lines = response.data.split("\n");
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix) {
        return { pwned: true, count: parseInt(countStr, 10) };
      }
    }
    return { pwned: false };
  } catch {
    // If HIBP is unreachable, fail open (don't block registration)
    return { pwned: false };
  }
}

// ─── AES-256-GCM Encryption (for TOTP secret at-rest) ────────────────────────

const ENCRYPTION_KEY_HEX = env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY_HEX && env.NODE_ENV === "production") {
  throw new Error("ENCRYPTION_KEY env var is required in production.");
}
const ENC_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns a base64 string: IV (12 bytes) + authTag (16 bytes) + ciphertext.
 *
 * @param {string} plaintext
 * @returns {string} base64-encoded encrypted blob
 */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt an AES-256-GCM blob produced by encrypt().
 *
 * @param {string} blob base64-encoded encrypted blob
 * @returns {string} plaintext
 */
export function decrypt(blob) {
  const data = Buffer.from(blob, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ─── Recovery Code HMAC-SHA256 ────────────────────────────────────────────────

const RECOVERY_SECRET = env.RECOVERY_CODE_SECRET;

/**
 * HMAC-SHA256 hash of a raw recovery code segment.
 * Fast and safe for scanning 8 codes at redemption time.
 * Raw codes are NEVER stored anywhere after this function returns.
 *
 * @param {string} rawCode
 * @returns {string} hex-encoded HMAC-SHA256
 */
export function hashRecoveryCode(rawCode) {
  return crypto
    .createHmac("sha256", RECOVERY_SECRET)
    .update(rawCode.toLowerCase().trim())
    .digest("hex");
}

/**
 * Constant-time comparison of a raw code against a stored HMAC hash.
 *
 * @param {string} rawCode
 * @param {string} storedHash hex-encoded HMAC-SHA256
 * @returns {boolean}
 */
export function verifyRecoveryCode(rawCode, storedHash) {
  try {
    const candidate = Buffer.from(hashRecoveryCode(rawCode), "hex");
    const stored = Buffer.from(storedHash, "hex");
    if (candidate.length !== stored.length) return false;
    return crypto.timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

// ─── Device Fingerprint (anonymised) ─────────────────────────────────────────

/**
 * Produces a SHA-256 hash of IP + User-Agent + Accept-Language.
 * This is a one-way digest — cannot be reversed to identify the user.
 * Used only for display in the security event timeline.
 *
 * @param {import('express').Request} req
 * @returns {string} hex SHA-256
 */
export function deviceFingerprint(req) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const ua = req.headers["user-agent"] || "";
  const lang = req.headers["accept-language"] || "";
  return crypto.createHash("sha256").update(`${ip}|${ua}|${lang}`).digest("hex");
}
