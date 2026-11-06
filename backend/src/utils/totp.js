/**
 * src/utils/totp.js
 *
 * RFC 6238 time-based one-time passwords (HMAC-SHA1, 6 digits, 30 s step), the
 * settings every mainstream authenticator app expects. Verification accepts
 * one step either side to absorb clock drift and compares codes in constant time.
 */

import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = ((value << 8) | byte) & 0xffffff;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text) {
  const clean = text.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character.");
    value = ((value << 5) | index) & 0xffffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit random secret, base32 encoded (RFC 4226 recommends at least 128 bits). */
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function generateUri({ secret, label, issuer }) {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${label}`)}?${params.toString()}`;
}

function codeAt(secretBytes, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", secretBytes).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Code for the given instant. Used by tests and by enrolment helpers. */
export function totpCodeAt(secret, nowMs = Date.now()) {
  const counter = Math.floor(nowMs / 1000 / STEP_SECONDS);
  return codeAt(base32Decode(secret), counter);
}

/**
 * @param {string} secret base32 secret
 * @param {string} token six-digit code supplied by the user
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function verifyTotp(secret, token, nowMs = Date.now()) {
  if (typeof token !== "string" || !/^\d{6}$/.test(token)) return false;
  let secretBytes;
  try {
    secretBytes = base32Decode(secret);
  } catch {
    return false;
  }
  const counter = Math.floor(nowMs / 1000 / STEP_SECONDS);
  const candidate = Buffer.from(token);
  let valid = false;
  for (let drift = -1; drift <= 1; drift++) {
    const expected = Buffer.from(codeAt(secretBytes, counter + drift));
    if (crypto.timingSafeEqual(expected, candidate)) valid = true;
  }
  return valid;
}
