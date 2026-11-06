/**
 * crypto.js — VEIL cryptographic primitives (Cloudflare Workers runtime)
 *
 * Exports:
 *   hashPassphrase, verifyPassphrase, needsRehash — passphrase storage (PBKDF2-HMAC-SHA256)
 *   isPassphraseStrongEnough                      — length + Shannon entropy + pattern checks
 *   checkPassphrasePwned                          — HIBP k-anonymity range API (5-char SHA-1 prefix only)
 *   encrypt, decrypt                              — AES-256-GCM at rest (TOTP secrets, challenges)
 *   hashRecoveryCode, verifyRecoveryCode          — HMAC-SHA256 (recovery code hashing)
 *   deviceFingerprint                             — anonymised SHA-256 of IP + UA + Accept-Language
 *
 * Passphrase hashing
 *   New hashes use PBKDF2-HMAC-SHA256 with 600,000 iterations (OWASP guidance) through
 *   WebCrypto, which is native in Workers. Runtime WASM compilation is refused there,
 *   so Argon2 builds that need it cannot run. Accounts created before the move carry
 *   Argon2id hashes: they still verify (pure JavaScript, legacy only) and are upgraded
 *   to PBKDF2 on their next successful sign-in.
 */

import crypto from "node:crypto";
import { argon2id as legacyArgon2id } from "@noble/hashes/argon2";
import { env } from "../config/env.js";

const PBKDF2_SCHEME = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 600000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
// Fixed salt used only to spend the same work for unknown accounts (timing equalisation).
const DUMMY_SALT = Buffer.alloc(SALT_BYTES, 0x5a);

async function derivePbkdf2(raw, salt, iterations) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(raw),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Hash a passphrase for storage.
 * @param {string} raw
 * @returns {Promise<string>} "pbkdf2-sha256$<iterations>$<salt>$<hash>"
 */
export async function hashPassphrase(raw) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await derivePbkdf2(raw, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_SCHEME}$${PBKDF2_ITERATIONS}$${salt.toString("base64url")}$${Buffer.from(hash).toString("base64url")}`;
}

/** Legacy Argon2id verification for accounts created before the Workers migration. */
function verifyLegacyArgon2(raw, stored) {
  const parts = stored.split("$");
  // ["", "argon2id", "v=19", "m=65536,t=3,p=1", salt, hash]
  const params = Object.fromEntries((parts[3] || "").split(",").map((kv) => kv.split("=")));
  const m = Number(params.m);
  const t = Number(params.t);
  const p = Number(params.p);
  if (!Number.isInteger(m) || !Number.isInteger(t) || !Number.isInteger(p) || !parts[4] || !parts[5]) return false;
  const expected = Buffer.from(parts[5], "base64");
  const salt = Buffer.from(parts[4], "base64");
  const actual = Buffer.from(legacyArgon2id(raw, salt, { t, m, p, dkLen: expected.length }));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * Verifies a passphrase. Never throws. `stored` may be null for unknown accounts;
 * the same amount of work is then spent before returning false.
 * @param {string} raw
 * @param {string | null} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassphrase(raw, stored) {
  if (typeof raw !== "string" || raw.length === 0) return false;
  try {
    if (typeof stored === "string" && stored.startsWith("$argon2id$")) {
      return verifyLegacyArgon2(raw, stored);
    }
    if (typeof stored !== "string" || !stored.startsWith(`${PBKDF2_SCHEME}$`)) {
      await derivePbkdf2(raw, DUMMY_SALT, PBKDF2_ITERATIONS);
      return false;
    }
    const [, iterationText, saltText, hashText] = stored.split("$");
    const iterations = Number(iterationText);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 2_000_000 || !saltText || !hashText) return false;
    const expected = Buffer.from(hashText, "base64url");
    const actual = Buffer.from(await derivePbkdf2(raw, Buffer.from(saltText, "base64url"), iterations));
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** True when a stored hash should be replaced with the current scheme after a successful sign-in. */
export function needsRehash(stored) {
  return typeof stored !== "string" || !stored.startsWith(`${PBKDF2_SCHEME}$${PBKDF2_ITERATIONS}$`);
}

// ─── Passphrase strength ─────────────────────────────────────────────────────

/**
 * Shannon entropy in bits for a string (per-character model).
 * @param {string} str
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
 * Minimum: 12 characters and ~60 bits of per-character entropy.
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
  if (raw.length > 512) {
    return { ok: false, reason: "Passphrase must be at most 512 characters." };
  }
  const entropy = shannonEntropy(raw);
  if (entropy < 60) {
    return {
      ok: false,
      reason: `Passphrase is too weak (${Math.round(entropy)} bits of entropy; minimum 60). Use more varied characters or a longer phrase.`,
    };
  }
  if (/^(.)\1+$/.test(raw)) {
    return { ok: false, reason: "Passphrase cannot be a single repeated character." };
  }
  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg)/i.test(raw)) {
    return { ok: false, reason: "Passphrase contains sequential patterns that are too predictable." };
  }
  return { ok: true };
}

// ─── HaveIBeenPwned k-anonymity range check ──────────────────────────────────

/**
 * Only the first five hex characters of the SHA-1 digest leave the server.
 * Fails open when the service is unreachable so registration is not blocked.
 * @param {string} raw
 * @returns {Promise<{ pwned: boolean, count?: number }>}
 */
export async function checkPassphrasePwned(raw) {
  if (env.HIBP_ENABLED === "false") return { pwned: false };
  try {
    const sha1 = crypto.createHash("sha1").update(raw).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return { pwned: false };
    const lines = (await response.text()).split("\n");
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix) {
        return { pwned: true, count: parseInt(countStr, 10) };
      }
    }
    return { pwned: false };
  } catch {
    return { pwned: false };
  }
}

// ─── AES-256-GCM (at-rest encryption) ────────────────────────────────────────

let cachedKeyHex = null;
let cachedKey = null;

function encryptionKey() {
  if (cachedKeyHex !== env.ENCRYPTION_KEY || !cachedKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY || "")) {
      throw new Error("ENCRYPTION_KEY must be 64 hexadecimal characters.");
    }
    cachedKeyHex = env.ENCRYPTION_KEY;
    cachedKey = Buffer.from(cachedKeyHex, "hex");
  }
  return cachedKey;
}

/**
 * Encrypts with AES-256-GCM. Output: base64(IV[12] || tag[16] || ciphertext).
 * @param {string} plaintext
 */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypts a blob produced by encrypt(). Throws if the tag does not verify.
 * @param {string} blob
 */
export function decrypt(blob) {
  const data = Buffer.from(blob, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ─── Recovery code HMAC-SHA256 ───────────────────────────────────────────────

/**
 * Keyed hash of a normalised recovery code. Raw codes are never stored.
 * @param {string} rawCode
 * @returns {string} hex digest
 */
export function hashRecoveryCode(rawCode) {
  return crypto
    .createHmac("sha256", env.RECOVERY_CODE_SECRET)
    .update(rawCode.toLowerCase().trim())
    .digest("hex");
}

/**
 * Constant-time comparison of a raw code against a stored digest.
 * @param {string} rawCode
 * @param {string} storedHash
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

// ─── Device fingerprint (anonymised) ─────────────────────────────────────────

/**
 * One-way digest of IP + User-Agent + Accept-Language, shown only in the
 * user's own security timeline.
 * @param {{ ip?: string, headers?: Record<string, string> }} req
 */
export function deviceFingerprint(req) {
  const ip = req.ip || "unknown";
  const ua = req.headers?.["user-agent"] || "";
  const lang = req.headers?.["accept-language"] || "";
  return crypto.createHash("sha256").update(`${ip}|${ua}|${lang}`).digest("hex");
}
