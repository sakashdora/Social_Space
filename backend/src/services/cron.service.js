import prisma from "../config/prisma.js";

/**
 * Periodically runs data retention cleanup routines.
 * Deletes expired messages (> configured seconds)
 * Deletes dead/inactive accounts (> 30 days since last activity)
 */
export function startRetentionCron() {
  console.log("Data Retention Cron Service Initialized.");
  
  // Run checks every 10 minutes (600,000 ms) for quick updates in dev
  setInterval(async () => {
    try {
      const now = new Date();
      
      // 1. Purge expired messages
      const deletedMessages = await prisma.message.deleteMany({
        where: {
          expiresAt: {
            lt: now
          }
        }
      });
      
      if (deletedMessages.count > 0) {
        console.log(`[Retention Cron] Purged ${deletedMessages.count} expired messages.`);
      }

      // 2. Purge dead accounts (inactive for > 30 days)
      const retentionLimit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const inactiveUsers = await prisma.user.findMany({
        where: {
          lastActiveAt: {
            lt: retentionLimit
          }
        },
        select: {
          id: true,
          handle: true
        }
      });

      if (inactiveUsers.length > 0) {
        for (const u of inactiveUsers) {
          // Cascade delete triggered by schema definitions
          await prisma.user.delete({
            where: { id: u.id }
          });
          console.log(`[Retention Cron] User @${u.handle} deleted due to 30-day inactivity. All associated posts, comments, and chats have been purged.`);
        }
      }
    } catch (err) {
      console.error("[Retention Cron] Cleanup failed:", err.message);
    }
  }, 10 * 60 * 1000);
}
