import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import prisma from "../config/prisma.js";

const router = Router();

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
