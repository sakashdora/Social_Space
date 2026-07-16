import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { verifyToken } from "../utils/jwt.js";
import prisma from "../config/prisma.js";

const router = Router();

/**
 * GET /v1/users/who-to-follow
 * Suggests active users to follow.
 */
router.get("/who-to-follow", async (req, res) => {
  try {
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const payload = verifyToken(token);
        if (payload && payload.userId) {
          currentUserId = payload.userId;
        }
      } catch (e) {
        // ignore invalid token for optional recommendations
      }
    }

    const activeUsers = await prisma.user.findMany({
      where: {
        isBanned: false,
        ...(currentUserId ? { id: { not: currentUserId } } : {}),
      },
      take: 5,
      orderBy: {
        lastActiveAt: "desc",
      },
      select: {
        handle: true,
      },
    });

    const defaultWhoToFollow = [
      {
        name: "silent_wanderer",
        handle: "@silent_wanderer",
        color: "text-amber-500 bg-amber-500/10",
      },
      {
        name: "thoughts_unfiltered",
        handle: "@thoughts_unfiltered",
        color: "text-purple-500 bg-purple-500/10",
      },
      {
        name: "dream_builder",
        handle: "@dream_builder",
        color: "text-teal-500 bg-teal-500/10",
      },
    ];

    const colors = [
      "text-amber-500 bg-amber-500/10",
      "text-purple-500 bg-purple-500/10",
      "text-teal-500 bg-teal-500/10",
      "text-blue-500 bg-blue-500/10",
      "text-pink-500 bg-pink-500/10",
      "text-emerald-500 bg-emerald-500/10",
    ];

    const list = activeUsers.map((u, idx) => ({
      name: u.handle,
      handle: `@${u.handle}`,
      color: colors[idx % colors.length],
    }));

    let backfillIndex = 0;
    while (list.length < 3 && backfillIndex < defaultWhoToFollow.length) {
      const def = defaultWhoToFollow[backfillIndex];
      if (!list.some((u) => u.name.toLowerCase() === def.name.toLowerCase())) {
        list.push(def);
      }
      backfillIndex++;
    }

    return res.status(200).json(list);
  } catch (error) {
    console.error("Get who to follow suggestions error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to retrieve user suggestions.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

/**
 * GET /v1/users/:id/chat-public-key
 * Returns only the public key details for a specific user ID.
 * Secured via session check.
 */
router.get("/:id/chat-public-key", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        chatPublicKey: true,
        chatPublicKeyAlgo: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          message: "User not found.",
          code: "NOT_FOUND",
        },
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("GET chat-public-key error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to fetch user public key.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

export default router;
