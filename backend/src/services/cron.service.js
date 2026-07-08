import prisma from "../config/prisma.js";

/**
 * Periodically runs data retention cleanup routines.
 *
 * Phase 3 Fix #12: Two-phase deletion with 7-day warning window:
 *   Day 23 of inactivity → set pendingDeletionAt (soft-delete flag + stub notification)
 *   Day 30 of inactivity → hard delete (cascade removes all posts, comments, chats)
 *
 * STUBBED: notifyPendingDeletion() is a stub until the notification system is built.
 * When the notification system is ready, implement this function to:
 *   - Show an in-app banner to the user on next login (check pendingDeletionAt in requireAuth)
 *   - OR use a push/email notification if that system is added later
 */

/**
 * STUB: In-app notification hook for pending account deletion.
 * Replace this with real notification logic when the notification system is available.
 *
 * @param {{ id: string, handle: string, pendingDeletionAt: Date }} user
 */
async function notifyPendingDeletion(user) {
  // STUB — notification system not yet implemented.
  // TODO: Implement one of:
  //   1. Set a flag on the user's session that the frontend checks to show a banner
  //   2. Insert a row into a future Notification table
  //   3. Send an in-app push if a push notification system is added
  console.log(
    `[Retention Cron] STUB: Would notify @${user.handle} (id=${user.id}) ` +
    `that their account will be deleted on ${user.pendingDeletionAt?.toISOString()}.`
  );
}

export function startRetentionCron() {
  console.log("Data Retention Cron Service Initialized.");

  // Run checks every 10 minutes (600,000 ms)
  setInterval(async () => {
    try {
      const now = new Date();

      // ── Phase 1: Purge expired messages ──────────────────────────────────────
      const deletedMessages = await prisma.message.deleteMany({
        where: { expiresAt: { lt: now } }
      });

      if (deletedMessages.count > 0) {
        console.log(`[Retention Cron] Purged ${deletedMessages.count} expired messages.`);
      }

      // ── Phase 2a: Soft-delete flag — Day 23 of inactivity ────────────────────
      // Marks accounts as pending deletion and triggers stub notification.
      // Only marks accounts that haven't already been flagged (pendingDeletionAt IS NULL).
      const warnThreshold = new Date(Date.now() - 23 * 24 * 60 * 60 * 1000);
      const deletionDate  = new Date(Date.now() +  7 * 24 * 60 * 60 * 1000); // 7 days from now

      const accountsToWarn = await prisma.user.findMany({
        where: {
          lastActiveAt:      { lt: warnThreshold },
          pendingDeletionAt: null, // Not yet flagged
        },
        select: { id: true, handle: true }
      });

      for (const u of accountsToWarn) {
        await prisma.user.update({
          where: { id: u.id },
          data:  { pendingDeletionAt: deletionDate }
        });
        console.log(
          `[Retention Cron] @${u.handle} inactive 23+ days — ` +
          `pendingDeletionAt set to ${deletionDate.toISOString()}.`
        );
        await notifyPendingDeletion({ ...u, pendingDeletionAt: deletionDate });
      }

      // ── Phase 2b: Hard delete — Day 30 / pendingDeletionAt passed ────────────
      // Only hard-deletes accounts that were soft-flagged AND whose grace period elapsed.
      const accountsToDelete = await prisma.user.findMany({
        where: {
          pendingDeletionAt: { lt: now } // grace period has passed
        },
        select: { id: true, handle: true }
      });

      for (const u of accountsToDelete) {
        await prisma.user.delete({ where: { id: u.id } });
        console.log(
          `[Retention Cron] Hard-deleted @${u.handle} — ` +
          `pendingDeletionAt elapsed. All posts, comments, and chats cascade-deleted.`
        );
      }
    } catch (err) {
      console.error("[Retention Cron] Cleanup failed:", err.message);
    }
  }, 10 * 60 * 1000);
}
