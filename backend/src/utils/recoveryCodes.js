/**
 * recoveryCodes.js — BIP39-based recovery code generation and verification
 *
 * Each recovery code = 4 BIP39 English words, dash-separated.
 * Example: "abandon-ability-able-about"
 * Entropy: log2(2048^4) ≈ 44 bits per code. 8 codes total.
 *
 * WHY BIP39 WORDS?
 *   - Human-readable and easy to write down (unlike hex strings)
 *   - Well-known wordlist, widely available for verification
 *   - Each 4-word code has ~44 bits of entropy — strong enough for a single-use code
 *   - Lowercase + dash format is consistent and easy to type
 *
 * WHY HMAC-SHA256 (not Argon2id) for hashing?
 *   - At redemption time we scan up to 8 hashes looking for a match
 *   - Argon2id at 64 MiB / 3 rounds = ~200ms per hash → 1.6 seconds total
 *   - HMAC-SHA256 with a secret key provides equivalent security (secret acts as salt)
 *   - Constant-time comparison via crypto.timingSafeEqual prevents timing attacks
 */

import crypto from "crypto";
import { wordlists } from "bip39";
import { hashRecoveryCode, verifyRecoveryCode } from "./crypto.js";

const WORDLIST = wordlists.english; // 2048 words

/**
 * Generate `count` recovery codes.
 * Returns both raw codes (shown to user ONCE) and their HMAC hashes (stored in DB).
 * Raw codes are NEVER persisted — they live only in this function's return value.
 *
 * @param {number} count — number of codes to generate (default: 8)
 * @returns {{ rawCodes: string[], hashedCodes: string[] }}
 */
export function generateRecoveryCodes(count = 8) {
  const rawCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    // Pick 4 random words from the 2048-word BIP39 English list
    const words = [];
    for (let w = 0; w < 4; w++) {
      // crypto.randomInt is cryptographically secure
      const idx = crypto.randomInt(WORDLIST.length);
      words.push(WORDLIST[idx]);
    }
    const raw = words.join("-");
    rawCodes.push(raw);
    hashedCodes.push(hashRecoveryCode(raw));
  }

  return { rawCodes, hashedCodes };
}

/**
 * Find which stored RecoveryCode record matches the raw code.
 * Scans all unused codes using constant-time comparison.
 *
 * @param {string} rawCode — the code the user typed
 * @param {Array<{ id: string, codeHash: string, usedAt: Date|null }>} dbRecords
 * @returns {{ id: string } | null} the matched unused record, or null
 */
export function findMatchingRecoveryCode(rawCode, dbRecords) {
  if (!rawCode || !Array.isArray(dbRecords)) return null;
  const normalised = rawCode.toLowerCase().trim();

  // Compute candidate hash ONCE to prevent redundant hashing and timing leak
  const candidateHash = hashRecoveryCode(normalised);
  const candidateBuf = Buffer.from(candidateHash, "hex");

  let matchedRecord = null;

  for (const record of dbRecords) {
    try {
      const storedBuf = Buffer.from(record.codeHash, "hex");
      if (candidateBuf.length === storedBuf.length) {
        if (crypto.timingSafeEqual(candidateBuf, storedBuf)) {
          if (record.usedAt === null) {
            matchedRecord = record;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return matchedRecord;
}
