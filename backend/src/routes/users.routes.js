import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { pgRateLimit } from "../config/rateLimiters.js";
import prisma from "../config/prisma.js";

const router = Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.get("/who-to-follow", optionalAuth, route(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { isBanned: false, ...(req.user ? { id: { not: req.user.id } } : {}) },
    take: 5, orderBy: { lastActiveAt: "desc" },
    select: { id: true, handle: true, followers: { where: { followerId: req.user?.id || "" }, select: { followerId: true } } },
  });
  res.json(users.map(user => ({ id: user.id, name: user.handle, handle: "@" + user.handle,
    following: user.followers.length > 0, color: "text-amber-500 bg-amber-500/10" })));
}));
router.put("/:handle/follow", requireAuth, pgRateLimit("social"), route(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { handle: req.params.handle.replace(/^@/, "").toLowerCase(), isBanned: false } });
  if (!user || user.id === req.user.id) return res.status(400).json({ error: "Cannot follow this account." });
  await prisma.follow.upsert({ where: { followerId_followingId: { followerId: req.user.id, followingId: user.id } }, create: { followerId: req.user.id, followingId: user.id }, update: {} });
  res.json({ following: true });
}));
router.delete("/:handle/follow", requireAuth, route(async (req, res) => {
  await prisma.follow.deleteMany({ where: { followerId: req.user.id, following: { handle: req.params.handle.replace(/^@/, "").toLowerCase() } } });
  res.json({ following: false });
}));
router.get("/:id/chat-public-key", requireAuth, route(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, isBanned: false },
    select: { id: true, chatPublicKey: true, chatPublicKeyAlgo: true } });
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
}));
export default router;
