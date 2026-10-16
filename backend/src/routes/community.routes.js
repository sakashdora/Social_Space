import { Router } from "express";
import { z } from "zod";
import prisma from "../config/prisma.js";
import { requireAuth, requireStepUp } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { pgRateLimit } from "../config/rateLimiters.js";

const router = Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
export const isModerator = handle => (process.env.MODERATOR_HANDLES || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean).includes(handle);
router.use(requireAuth);
const reportSchema = z.object({ target: z.string().trim().min(1).max(500), category: z.string().trim().min(1).max(100), reason: z.string().trim().min(1).max(5000) });
const appealSchema = z.object({ reference: z.string().trim().min(1).max(120), reason: z.string().trim().min(1).max(5000) });
const formatReport = report => ({ ...report, userId: undefined, submittedAt: report.createdAt });

router.get("/reports", route(async (req, res) => res.json((await prisma.safetyReport.findMany({ where: { userId: req.user.id }, take: 100, orderBy: { createdAt: "desc" } })).map(formatReport))));
router.post("/reports", pgRateLimit("social"), validateBody(reportSchema), route(async (req, res) => {
  const report = await prisma.safetyReport.create({ data: { userId: req.user.id, ...req.body } });
  res.status(201).json(formatReport(report));
}));
router.get("/appeals", route(async (req, res) => res.json(await prisma.appeal.findMany({ where: { userId: req.user.id }, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, reference: true, reason: true, status: true, createdAt: true } }))));
router.post("/appeals", pgRateLimit("social"), validateBody(appealSchema), route(async (req, res) => {
  const appeal = await prisma.appeal.create({ data: { userId: req.user.id, ...req.body } });
  res.status(201).json({ id: appeal.id, status: appeal.status });
}));
router.get("/waitlist", route(async (req, res) => res.json({ joined: !!await prisma.waitlistEntry.findUnique({ where: { userId: req.user.id } }) })));
router.post("/waitlist", route(async (req, res) => {
  await prisma.waitlistEntry.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id }, update: {} });
  res.json({ joined: true });
}));

router.get("/moderation", route(async (req, res) => {
  if (!isModerator(req.user.handle)) return res.status(403).json({ error: "Moderator access required." });
  const [reports, appeals] = await Promise.all([
    prisma.safetyReport.findMany({ where: { status: { in: ["received", "reviewing"] } }, take: 100, orderBy: { createdAt: "asc" } }),
    prisma.appeal.findMany({ where: { status: { in: ["received", "reviewing"] } }, take: 100, orderBy: { createdAt: "asc" } }),
  ]);
  res.json({ reports, appeals });
}));
router.patch("/moderation/:kind/:id", (req, res, next) => isModerator(req.user.handle) ? next() : res.status(403).json({ error: "Moderator access required." }), pgRateLimit("sensitive"), requireStepUp,
  validateBody(z.object({ status: z.enum(["reviewing", "action", "no-violation"]), currentPassphrase: z.string() })), route(async (req, res) => {
    const model = req.params.kind === "reports" ? prisma.safetyReport : req.params.kind === "appeals" ? prisma.appeal : null;
    if (!model) return res.status(404).json({ error: "Unknown queue." });
    const updated = await model.updateMany({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.status(updated.count ? 200 : 404).json({ updated: updated.count === 1 });
  }));
export default router;
