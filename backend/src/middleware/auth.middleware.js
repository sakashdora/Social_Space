import prisma from "../config/prisma.js";
import { verifyToken } from "../utils/jwt.js";
import { verifyPassphrase } from "../utils/crypto.js";

/**
 * Authentication middleware — verifies JWT and checks tokenVersion against the DB.
 * A tokenVersion mismatch means the user's sessions have been invalidated
 * (passphrase change, logout-all, or recovery code redemption).
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, handle: true, isBanned: true, tokenVersion: true, totpEnabled: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Unauthorized. User no longer exists." });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Forbidden. Account has been suspended." });
    }

    // Validate tokenVersion — mismatches indicate the session has been invalidated
    if (payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    // Refresh lastActiveAt asynchronously
    prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    }).catch((err) => console.error("Failed to update lastActiveAt:", err.message));

    req.user = {
      id: user.id,
      handle: user.handle,
      isBanned: user.isBanned,
      tokenVersion: user.tokenVersion,
      totpEnabled: user.totpEnabled,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Internal server error during authentication." });
  }
}

/**
 * Step-up authentication middleware for sensitive actions.
 * Requires the request body to include `currentPassphrase`.
 * Verifies it against the stored Argon2id hash before allowing the action.
 *
 * Usage: router.post("/passphrase/change", requireAuth, sensitiveActionLimiter, requireStepUp, handler)
 */
export async function requireStepUp(req, res, next) {
  const { currentPassphrase } = req.body;
  if (!currentPassphrase) {
    return res.status(400).json({
      error: "Re-authentication required. Include your current passphrase in currentPassphrase.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { recoveryHash: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    const valid = await verifyPassphrase(currentPassphrase, user.recoveryHash);
    if (!valid) {
      return res.status(401).json({ error: "Re-authentication failed. Incorrect passphrase." });
    }

    next();
  } catch (error) {
    console.error("requireStepUp error:", error);
    return res.status(500).json({ error: "Internal server error during re-authentication." });
  }
}
