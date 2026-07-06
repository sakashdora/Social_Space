import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { generateToken } from "../utils/jwt.js";

/**
 * Register a new anonymous user.
 * POST /v1/auth/register
 */
export async function register(req, res) {
  try {
    const { handle, passphrase } = req.body;

    if (!handle || !passphrase) {
      return res.status(400).json({ error: "Handle and recovery passphrase are required." });
    }

    const cleanHandle = handle.trim().toLowerCase();
    if (cleanHandle.length < 3 || cleanHandle.length > 20) {
      return res.status(400).json({ error: "Handle must be between 3 and 20 characters." });
    }

    // Check if handle already taken
    const existing = await prisma.user.findUnique({
      where: { handle: cleanHandle }
    });

    if (existing) {
      return res.status(409).json({ error: "Handle already taken. Choose another." });
    }

    // Salt and hash the passphrase
    const salt = await bcrypt.genSalt(10);
    const recoveryHash = await bcrypt.hash(passphrase, salt);

    // Default system avatar
    const randomAvatarNum = Math.floor(Math.random() * 8) + 1;
    const avatarUrl = `/assets/avatars/avatar-${randomAvatarNum}.png`;

    // Create user
    const user = await prisma.user.create({
      data: {
        handle: cleanHandle,
        recoveryHash,
        avatarUrl
      }
    });

    // Generate JWT
    const token = generateToken(user.id);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        handle: user.handle,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Failed to register anonymous account." });
  }
}

/**
 * Login with existing handle and recovery passphrase.
 * POST /v1/auth/login
 */
export async function login(req, res) {
  try {
    const { handle, passphrase } = req.body;

    if (!handle || !passphrase) {
      return res.status(400).json({ error: "Handle and recovery passphrase are required." });
    }

    const cleanHandle = handle.trim().toLowerCase();

    // Find user
    const user = await prisma.user.findUnique({
      where: { handle: cleanHandle }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid handle or recovery passphrase." });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "This account has been suspended." });
    }

    // Verify recovery passphrase
    const isMatch = await bcrypt.compare(passphrase, user.recoveryHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid handle or recovery passphrase." });
    }

    // Update lastActiveAt on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });

    // Generate JWT
    const token = generateToken(user.id);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        handle: user.handle,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Failed to verify credentials." });
  }
}

/**
 * Update the recovery passphrase (security key).
 * PATCH /v1/auth/security-key
 */
export async function updateSecurityKey(req, res) {
  try {
    const { newPassphrase } = req.body;
    if (!newPassphrase || newPassphrase.trim().length < 3) {
      return res.status(400).json({ error: "New recovery passphrase is required and must be at least 3 characters." });
    }

    const salt = await bcrypt.genSalt(10);
    const recoveryHash = await bcrypt.hash(newPassphrase, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { recoveryHash, lastActiveAt: new Date() }
    });

    return res.status(200).json({ message: "Security key updated successfully." });
  } catch (error) {
    console.error("Update security key error:", error);
    return res.status(500).json({ error: "Failed to update security key." });
  }
}

/**
 * Delete account permanently.
 * DELETE /v1/auth/account
 */
export async function deleteAccount(req, res) {
  try {
    // Permanent deletion, triggers cascading delete of posts, comments, reactions, threads, messages
    await prisma.user.delete({
      where: { id: req.user.id }
    });
    return res.status(200).json({ message: "Account and all associated data permanently deleted." });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ error: "Failed to delete account." });
  }
}

