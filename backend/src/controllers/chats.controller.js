import prisma from "../config/prisma.js";
import { notifyChat } from "../services/realtime.service.js";
import { safeWaitUntil } from "../utils/lifecycle.js";

const messageView = (message, userId) => ({
  id: message.id, body: message.body, mediaId: message.mediaId, senderId: message.senderId,
  mine: message.senderId === userId, createdAt: message.createdAt, expiresAt: message.expiresAt,
  time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});
const fail = (res, message, status = 500) => res.status(status).json({ error: message });

export async function getChats(req, res) {
  try {
    const threads = await prisma.thread.findMany({
      where: { participants: { some: { userId: req.user.id } } },
      take: 100, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: { participants: { include: { user: { select: { id: true, handle: true, avatarUrl: true } } } },
        messages: { where: { expiresAt: { gt: new Date() } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 } },
    });
    return res.json(threads.map(thread => {
      const peer = thread.participants.find(p => p.userId !== req.user.id)?.user;
      const last = thread.messages[0];
      return { id: thread.id, handle: peer?.handle || "Deleted account", recipientId: peer?.id,
        avatarUrl: peer?.avatarUrl, color: "#8B5CF6", preview: last?.body || "No messages yet",
        previewMine: last?.senderId === req.user.id, time: last ? messageView(last, req.user.id).time : "New",
        disappearing: thread.deleteAfterSeconds >= 86400 ? Math.round(thread.deleteAfterSeconds / 86400) + "d" : Math.round(thread.deleteAfterSeconds / 60) + "m",
        deleteAfterSeconds: thread.deleteAfterSeconds, unread: 0 };
    }));
  } catch (error) { return fail(res, "Could not load conversations."); }
}

export async function getChatMessages(req, res) {
  try {
    const threadId = req.params.threadId;
    if (!await prisma.threadParticipant.findFirst({ where: { threadId, userId: req.user.id } })) return fail(res, "Conversation unavailable.", 403);
    const where = { threadId, expiresAt: { gt: new Date() } };
    const cursorId = req.query.after || req.query.before;
    if (typeof cursorId === "string") {
      const cursor = await prisma.message.findFirst({ where: { id: cursorId, threadId } });
      if (cursor) {
        const direction = req.query.after ? "gt" : "lt";
        where.OR = [{ createdAt: { [direction]: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { [direction]: cursor.id } }];
      }
    }
    const ascending = !!req.query.after;
    const messages = await prisma.message.findMany({ where, take: 50,
      orderBy: [{ createdAt: ascending ? "asc" : "desc" }, { id: ascending ? "asc" : "desc" }] });
    if (!ascending) messages.reverse();
    res.set("Cache-Control", "private, no-store");
    return res.json(messages.map(message => messageView(message, req.user.id)));
  } catch (error) { return fail(res, "Could not load messages."); }
}

export async function startChat(req, res) {
  try {
    const target = await prisma.user.findFirst({ where: { handle: req.body.targetHandle.trim().toLowerCase().replace(/^@/, ""), isBanned: false } });
    if (!target || target.id === req.user.id) return fail(res, "Unable to start conversation.", 400);
    const pairKey = [req.user.id, target.id].sort().join(":");
    let thread = await prisma.thread.findFirst({ where: { AND: [
      { participants: { some: { userId: req.user.id } } }, { participants: { some: { userId: target.id } } },
      { participants: { every: { userId: { in: [req.user.id, target.id] } } } },
    ] } });
    if (!thread) {
      try {
        thread = await prisma.thread.upsert({ where: { pairKey }, update: {}, create: { pairKey, participants: { create: [{ userId: req.user.id }, { userId: target.id }] } } });
      } catch (error) {
        if (error.code !== "P2002") throw error;
        thread = await prisma.thread.findUnique({ where: { pairKey } });
      }
    }
    safeWaitUntil(notifyChat(thread.id, [req.user.id, target.id]));
    return res.status(201).json({ threadId: thread.id });
  } catch (error) { return fail(res, "Could not start conversation."); }
}

export async function sendChatMessage(req, res) {
  try {
    const threadId = req.params.threadId;
    const thread = await prisma.thread.findUnique({ where: { id: threadId }, include: { participants: { include: { user: { select: { chatPublicKey: true, isBanned: true } } } } } });
    if (!thread || !thread.participants.some(p => p.userId === req.user.id) || thread.participants.some(p => p.user.isBanned)) return fail(res, "Conversation unavailable.", 403);
    let envelope;
    try { envelope = JSON.parse(req.body.body); } catch { return fail(res, "An encrypted message is required.", 400); }
    const sender = thread.participants.find(p => p.userId === req.user.id);
    const peer = thread.participants.find(p => p.userId !== req.user.id);
    if (envelope.v !== 2 || typeof envelope.ciphertext !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext) || typeof envelope.iv !== "string" || Buffer.from(envelope.iv, "base64").length !== 12) return fail(res, "Invalid encrypted message.", 400);
    if (envelope.senderKey !== sender.user.chatPublicKey || envelope.recipientKey !== peer?.user.chatPublicKey) return fail(res, "Chat keys changed. Refresh and send again.", 409);
    const expiresAt = new Date(Date.now() + thread.deleteAfterSeconds * 1000);
    const message = await prisma.$transaction(async tx => {
      if (req.body.mediaId) {
        await tx.$queryRaw`SELECT id FROM "Media" WHERE id = ${req.body.mediaId} FOR UPDATE`;
        const media = await tx.media.findFirst({ where: { id: req.body.mediaId, userId: req.user.id, threadId, purpose: "chat", status: "ready", expiresAt: { gt: new Date() }, message: null } });
        if (!media) throw Object.assign(new Error("Attachment is unavailable or belongs to another message."), { status: 403 });
        await tx.media.update({ where: { id: media.id }, data: { expiresAt } });
      }
      const created = await tx.message.create({ data: { threadId, senderId: req.user.id, body: req.body.body, mediaId: req.body.mediaId || null, expiresAt } });
      await tx.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      return created;
    });
    safeWaitUntil(notifyChat(threadId, thread.participants.map(p => p.userId)));
    return res.status(201).json(messageView(message, req.user.id));
  } catch (error) { return fail(res, error.status ? error.message : "Could not send message.", error.status || 500); }
}

export async function updateChatTimer(req, res) {
  try {
    const threadId = req.params.threadId;
    const participant = await prisma.threadParticipant.findFirst({ where: { threadId, userId: req.user.id } });
    if (!participant) return fail(res, "Conversation unavailable.", 403);
    await prisma.thread.update({ where: { id: threadId }, data: { deleteAfterSeconds: req.body.seconds } });
    const members = await prisma.threadParticipant.findMany({ where: { threadId } });
    safeWaitUntil(notifyChat(threadId, members.map(p => p.userId)));
    return res.json({ message: "Timer updated for new messages. Existing messages keep their original expiry." });
  } catch (error) { return fail(res, "Could not update timer."); }
}
