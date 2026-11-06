/**
 * src/services/storageCleanup.js
 *
 * Account and media deletion. Object removal is queued in StorageDeletion and
 * drained after the database change is committed, so an object is never deleted
 * while a database row still points at it.
 */

import prisma from "../config/prisma.js";
import { deleteObject, isStorageConfigured } from "./storage.js";

/**
 * @param {{ storagePath?: string|null, thumbnailPath?: string|null, uploadPath?: string|null, bucket: string, status?: string, uploadExpiresAt?: Date|null }} media
 */
export function mediaPaths(media) {
  return [...new Set([media.storagePath, media.thumbnailPath, media.uploadPath].filter((p) => p && !p.startsWith("data:")))];
}

/** Records storage objects for deletion. Safe to call repeatedly for the same path. */
export async function queueMediaDeletion(media) {
  const rows = mediaPaths(media).map((path) => ({
    bucket: media.bucket,
    path,
    notBefore: (path === media.uploadPath || media.status === "processing") && media.uploadExpiresAt
      ? media.uploadExpiresAt
      : new Date(),
  }));
  if (rows.length) await prisma.storageDeletion.createMany({ data: rows, skipDuplicates: true });
}

/**
 * Deletes a user and their data. When `inactiveBefore` is given (scheduled
 * retention), the account is only removed if it is still inactive at the moment
 * of deletion, so a returning user cannot lose data to a race.
 *
 * @returns {Promise<boolean>} true when the account was removed
 */
export async function deleteAccountData(userId, { inactiveBefore, deadline } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (inactiveBefore && (!user.pendingDeletionAt || user.pendingDeletionAt > deadline || user.lastActiveAt > inactiveBefore)) {
    return false;
  }

  const threads = await prisma.thread.findMany({ where: { participants: { some: { userId } } }, select: { id: true } });
  const threadIds = threads.map((t) => t.id);
  const media = await prisma.media.findMany({
    where: { OR: [{ userId }, ...(threadIds.length ? [{ threadId: { in: threadIds } }] : [])] },
  });

  // Conditional delete: the row is removed only if the inactivity conditions still hold.
  const removed = await prisma.user.deleteMany({
    where: inactiveBefore
      ? { id: userId, pendingDeletionAt: { lte: deadline }, lastActiveAt: { lte: inactiveBefore } }
      : { id: userId },
  });
  if (removed.count !== 1) return false;

  for (const item of media) await queueMediaDeletion(item);
  if (threadIds.length) await prisma.thread.deleteMany({ where: { id: { in: threadIds } } });
  return true;
}

/** Deletes queued objects from R2. Failed entries stay queued for the next run. */
export async function drainStorageDeletions(limit = 50) {
  if (!isStorageConfigured()) return { removed: 0 };
  const entries = await prisma.storageDeletion.findMany({
    where: { notBefore: { lte: new Date() } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  let removed = 0;
  for (const entry of entries) {
    try {
      await deleteObject(entry.path);
      await prisma.storageDeletion.deleteMany({ where: { id: entry.id } });
      removed++;
    } catch (error) {
      console.error("Storage cleanup deferred:", error?.message);
    }
  }
  return { removed };
}
