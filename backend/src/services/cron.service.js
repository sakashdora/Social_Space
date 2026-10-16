import prisma from "../config/prisma.js";
import { deleteAccountData, queueMediaDeletion, drainStorageDeletions } from "./storageCleanup.js";

export async function runRetentionCleanup() {
  const now = new Date();
  const warnThreshold = new Date(now.getTime() - 23 * 86400000);
  const inactiveThreshold = new Date(now.getTime() - 30 * 86400000);
  const result = await prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(839172) AS acquired`;
    if (!lock.acquired) return { skipped: true };
    await tx.user.updateMany({
      where: { lastActiveAt: { lt: warnThreshold }, pendingDeletionAt: null },
      data: { pendingDeletionAt: new Date(now.getTime() + 7 * 86400000) },
    });
    const accounts = await tx.user.findMany({
      where: { pendingDeletionAt: { lte: now }, lastActiveAt: { lte: inactiveThreshold } },
      select: { id: true }, take: 25,
    });
    let deletedAccounts = 0;
    for (const account of accounts) {
      if (await deleteAccountData(tx, account.id, inactiveThreshold, now)) deletedAccounts++;
    }
    await tx.post.updateMany({ where: { isDeleted: false, expiresAt: { lte: now } }, data: { isDeleted: true } });
    const expired = await tx.media.findMany({
      where: { OR: [
        { expiresAt: { lte: now } },
        { status: { in: ["pending", "failed", "processing"] }, uploadExpiresAt: { lte: now } },
        { purpose: "post", createdAt: { lt: new Date(now.getTime() - 86400000) }, posts: { every: { isDeleted: true } } },
      ] }, take: 50,
    });
    for (const media of expired) {
      await queueMediaDeletion(tx, media);
      await tx.media.delete({ where: { id: media.id } });
    }
    const staged = await tx.media.findMany({ where: { status: "ready", uploadPath: { not: null }, uploadExpiresAt: { lte: now } }, take: 50 });
    for (const media of staged) {
      await tx.storageDeletion.upsert({ where: { bucket_path: { bucket: media.bucket, path: media.uploadPath } }, create: { bucket: media.bucket, path: media.uploadPath }, update: {} });
      await tx.media.update({ where: { id: media.id }, data: { uploadPath: null, uploadExpiresAt: null } });
    }
    const messages = await tx.message.deleteMany({ where: { expiresAt: { lte: now } } });
    await tx.authChallenge.deleteMany({ where: { expiresAt: { lte: now } } });
    await tx.$executeRaw`DELETE FROM "rate_limit_counters" WHERE "expire" < ${BigInt(now.getTime())}`;
    return { deletedAccounts, deletedMedia: expired.length, deletedMessages: messages.count };
  }, { timeout: 20000 });
  const storage = await drainStorageDeletions();
  return { ...result, storage };
}

export function startRetentionCron() {
  const run = () => runRetentionCleanup().catch(error => console.error("Retention cleanup failed:", error.message));
  run();
  const timer = setInterval(run, 600000);
  timer.unref();
  return timer;
}
