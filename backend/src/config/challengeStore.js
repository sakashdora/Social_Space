import { Redis } from "@upstash/redis";
import { env } from "./env.js";
import prisma from "./prisma.js";
import { encrypt, decrypt } from "../utils/crypto.js";

const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }) : null;
const decode = value => {
  const stored = typeof value === "string" ? JSON.parse(value) : value;
  // Existing short-lived challenges can finish during a rolling deployment.
  return stored?.encryptedValue ? JSON.parse(decrypt(stored.encryptedValue)) : stored;
};

export const store = {
  async set(key, value, ttlSeconds) {
    const encrypted = { encryptedValue: encrypt(JSON.stringify(value)) };
    if (redis) return redis.set(key, JSON.stringify(encrypted), { ex: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await prisma.authChallenge.upsert({ where: { key }, create: { key, value: encrypted, expiresAt }, update: { value: encrypted, expiresAt } });
  },
  async get(key) {
    if (redis) return decode(await redis.get(key));
    const entry = await prisma.authChallenge.findUnique({ where: { key } });
    return entry && entry.expiresAt > new Date() ? decode(entry.value) : null;
  },
  async del(key) {
    if (redis) return redis.del(key);
    await prisma.authChallenge.deleteMany({ where: { key } });
  },
  async take(key) {
    if (redis) return decode(await redis.getdel(key));
    const entries = await prisma.$queryRaw`DELETE FROM "AuthChallenge" WHERE "key" = ${key} AND "expiresAt" > (NOW() AT TIME ZONE 'UTC') RETURNING "value"`;
    return decode(entries[0]?.value ?? null);
  },
};
