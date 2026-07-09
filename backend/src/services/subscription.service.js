import prisma from "../config/prisma.js";

/**
 * Checks if a user has active Premium tier.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isUserPremium(userId) {
  if (!userId) return false;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true }
  });
  
  return !!user?.isPremium;
}
