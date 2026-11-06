/**
 * src/config/challengeStore.js
 *
 * Short-lived authentication challenges (MFA sign-in, passkey ceremonies, TOTP
 * enrolment). Values are encrypted at rest with AES-256-GCM and stored in D1.
 * `take()` is single-use: the row is claimed with a conditional delete, so two
 * concurrent verifications cannot both succeed.
 */

import prisma from "./prisma.js";
import { encrypt, decrypt } from "../utils/crypto.js";

const wrap = (value) => JSON.stringify({ encryptedValue: encrypt(JSON.stringify(value)) });

const unwrap = (stored) => {
  if (!stored) return null;
  const parsed = JSON.parse(stored);
  return parsed?.encryptedValue ? JSON.parse(decrypt(parsed.encryptedValue)) : parsed;
};

export const store = {
  async set(key, value, ttlSeconds) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const data = { value: wrap(value), expiresAt };
    await prisma.authChallenge.upsert({ where: { key }, create: { key, ...data }, update: data });
  },

  async get(key) {
    const entry = await prisma.authChallenge.findUnique({ where: { key } });
    if (!entry || entry.expiresAt <= new Date()) return null;
    return unwrap(entry.value);
  },

  async del(key) {
    await prisma.authChallenge.deleteMany({ where: { key } });
  },

  /** Atomically claims and returns the challenge, or null if missing, expired or already used. */
  async take(key) {
    const entry = await prisma.authChallenge.findUnique({ where: { key } });
    if (!entry) return null;
    const claimed = await prisma.authChallenge.deleteMany({
      where: { key, expiresAt: { gt: new Date() } },
    });
    if (claimed.count !== 1) return null;
    return unwrap(entry.value);
  },
};
