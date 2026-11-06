/**
 * src/services/cron.service.js
 *
 * Retention job, run by the Worker's scheduled handler (and by the authenticated
 * /api/cron/retention endpoint for manual runs). Responsibilities:
 *   - warn inactive accounts and delete accounts that stayed inactive
 *   - expire posts and media, delete expired chat messages
 *   - purge stale challenges and rate-limit counters
 *   - drain queued object deletions from R2
 *
 * Only one run executes at a time: a short-lived claim row is inserted into
 * AuthChallenge with a fixed key. A second run finds the claim and exits.
 */

import prisma from "../config/prisma.js";
import { deleteAccountData, queueMediaDeletion, drainStorageDeletions } from "./storageCleanup.js";
import { purgeExpiredCounters } from "../config/rateLimiters.js";

const CLAIM_KEY = "job:retention";
const CLAIM_TTL_MS = 10 * 60 * 1000;
const DAY = 86400000;

async function claimRun(now) {
  await prisma.authChallenge.deleteMany({ where: { key: CLAIM_KEY, expiresAt: { lte: now } } });
  try {
    await prisma.authChallenge.create({
      data: { key: CLAIM_KEY, value: "{}", expiresAt: new Date(now.getTime() + CLAIM_TTL_MS) },
    });
    return true;
  } catch (error) {
    if (error?.code === "P2002") return false;
    throw error;
  }
}

export async function runRetentionCleanup() {
  const now = new Date();
  if (!(await claimRun(now))) return { skipped: true };

  try {
    const warnThreshold = new Date(now.getTime() - 23 * DAY);
    const inactiveThreshold = new Date(now.getTime() - 30 * DAY);

    await prisma.user.updateMany({
      where: { lastActiveAt: { lt: warnThreshold }, pendingDeletionAt: null },
      data: { pendingDeletionAt: new Date(now.getTime() + 7 * DAY) },
    });

    const accounts = await prisma.user.findMany({
      where: { pendingDeletionAt: { lte: now }, lastActiveAt: { lte: inactiveThreshold } },
      select: { id: true },
      take: 25,
    });
    let deletedAccounts = 0;
    for (const account of accounts) {
      if (await deleteAccountData(account.id, { inactiveBefore: inactiveThreshold, deadline: now })) deletedAccounts++;
    }

    await prisma.post.updateMany({ where: { isDeleted: false, expiresAt: { lte: now } }, data: { isDeleted: true } });

    const expired = await prisma.media.findMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { status: { in: ["pending", "failed", "processing"] }, uploadExpiresAt: { lte: now } },
          { purpose: "post", createdAt: { lt: new Date(now.getTime() - DAY) }, posts: { every: { isDeleted: true } } },
        ],
      },
      take: 50,
    });
    for (const media of expired) {
      await queueMediaDeletion(media);
      await prisma.media.delete({ where: { id: media.id } });
    }

    const staged = await prisma.media.findMany({
      where: { status: "ready", uploadPath: { not: null }, uploadExpiresAt: { lte: now } },
      take: 50,
    });
    for (const media of staged) {
      await prisma.storageDeletion.createMany({
        data: [{ bucket: media.bucket, path: media.uploadPath }],
        skipDuplicates: true,
      });
      await prisma.media.update({ where: { id: media.id }, data: { uploadPath: null, uploadExpiresAt: null } });
    }

    const messages = await prisma.message.deleteMany({ where: { expiresAt: { lte: now } } });
    await prisma.authChallenge.deleteMany({ where: { expiresAt: { lte: now }, key: { not: CLAIM_KEY } } });
    const counters = await purgeExpiredCounters(now.getTime());
    const storage = await drainStorageDeletions();

    return {
      deletedAccounts,
      deletedMedia: expired.length,
      deletedMessages: messages.count,
      purgedCounters: counters,
      storage,
    };
  } finally {
    await prisma.authChallenge.deleteMany({ where: { key: CLAIM_KEY } });
  }
}
