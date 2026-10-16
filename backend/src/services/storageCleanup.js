import prisma from "../config/prisma.js";
import { supabase } from "../config/supabase.js";

export async function queueMediaDeletion(tx, media) {
  const paths = [...new Set([media.storagePath, media.thumbnailPath, media.uploadPath].filter(p => p && !p.startsWith("data:")))];
  for (const path of paths) await tx.storageDeletion.upsert({
    where: { bucket_path: { bucket: media.bucket, path } },
    create: { bucket: media.bucket, path, notBefore: (path === media.uploadPath || media.status === "processing") && media.uploadExpiresAt ? media.uploadExpiresAt : new Date() }, update: {},
  });
}

export async function deleteAccountData(tx, userId, inactiveBefore, deadline) {
  // Lock before the final eligibility check. An activity update that wins this
  // lock cancels deletion; an earlier deletion prevents a new authenticated action.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || (inactiveBefore && (!user.pendingDeletionAt || user.pendingDeletionAt > deadline || user.lastActiveAt > inactiveBefore))) return false;
  const threads = await tx.thread.findMany({ where: { participants: { some: { userId } } }, select: { id: true } });
  const threadIds = threads.map(t => t.id);
  const media = await tx.media.findMany({ where: { OR: [{ userId }, { threadId: { in: threadIds } }] } });
  for (const item of media) await queueMediaDeletion(tx, item);
  await tx.thread.deleteMany({ where: { id: { in: threadIds } } });
  await tx.user.delete({ where: { id: userId } });
  return true;
}

export async function drainStorageDeletions(limit = 50) {
  if (!supabase) return { removed: 0 };
  const entries = await prisma.storageDeletion.findMany({ where: { notBefore: { lte: new Date() } }, take: limit, orderBy: { createdAt: "asc" } });
  let removed = 0;
  for (const entry of entries) {
    const { error } = await supabase.storage.from(entry.bucket).remove([entry.path]);
    if (!error) {
      await prisma.storageDeletion.deleteMany({ where: { id: entry.id } });
      removed++;
    } else console.error("Storage cleanup deferred:", error.message);
  }
  return { removed };
}
