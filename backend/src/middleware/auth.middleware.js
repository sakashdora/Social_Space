import prisma from "../config/prisma.js";
import { verifyToken } from "../utils/jwt.js";

/**
 * Authentication middleware that verifies JWT and attaches user to req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized. Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: "Unauthorized. Token expired or invalid." });
    }

    // Verify user exists and is not banned
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return res.status(401).json({ error: "Unauthorized. User no longer exists." });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Forbidden. Account has been suspended." });
    }

    // Refresh user activity timestamp asynchronously to keep session fresh
    prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    }).catch(err => console.error("Failed to update user lastActiveAt:", err.message));

    // Attach user information to request
    req.user = {
      id: user.id,
      handle: user.handle,
      isBanned: user.isBanned,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Internal server error during authentication." });
  }
}
